import Express from 'express';
import Puppeteer, { ErrorCode } from 'puppeteer';
import XssTools from './xssTools';
import { IXssScanConfig, IXssObj, IXssDataObj, IXssReqObj, IXssResObj, IReturnResourceError, IRequestData, IPerformanceData } from './xssInterfaces';

export default class XssScanner {
    private browserObj: Puppeteer.Browser;
    private browserCtx: Puppeteer.BrowserContext;
    private configObj: IXssScanConfig;
    private xssReqData: IXssReqObj = null;
    private xssResData: IXssResObj = null;
    public xssObj: IXssObj = null;
    private requestData: IRequestData = {};
    private benchMark: number = null;
    private toolsObj: XssTools = new XssTools();
    
    /**
     * Constructor
     *
     * @constructor
     * @memberof XssScanner
    */
    constructor(browserObj: Puppeteer.Browser, browserCtx: Puppeteer.BrowserContext, configObj: IXssScanConfig) {
        this.browserObj = browserObj;
        this.browserCtx = browserCtx;
        this.configObj  = configObj;
    }

    /**
     * Process the incomping ExpressJS request
     *
     * @param {Express.Request} reqObj The ExpressJS HTTP request object
     * @param {Express.Response} reqObj The ExpressJS HTTP response object
     * @returns {Promise<Express.Response>}
     * @memberof XssScanner
    */
    public async processRequest(reqObj: Express.Request, resObj: Express.Response): Promise<Express.Response> {
        reqObj.setTimeout(this.configObj.reqTimeout * 1000);
        const dateObj = new Date();
        this.xssReqData = {
            alertOnAnyEvent: false,
            checkUrl: null,
            queryString: null,
            reqMethod: 'GET',
            searchString: 'XSSed!',
        };
        this.xssResData = {
            requestTime: 0,
            statusMsg: null,
            statusCode: 0,
        };
        this.xssObj = {
            blockedUrls: [],
            checkTime: dateObj,
            responseData: this.xssResData,
            requestData: this.xssReqData,
            hasXss: false,
            xssData: [],
            resourceErrors: []
        };
        if(this.configObj.debugMode) {
            console.log('Received new HTTP request');
            if(reqObj.body) {
                console.log('postData:',  reqObj.body);
            }
        }
        if(reqObj.body.searchfor) {
            this.xssObj.requestData.searchString = reqObj.body.searchfor;
        }
        if(reqObj.body.everyevent && reqObj.body.everyevent === 'true') {
            this.xssObj.requestData.alertOnAnyEvent = true;
        }
        if(reqObj.body.reqmethod) {
            if(reqObj.body.reqmethod.toUpperCase() !== 'POST' && reqObj.body.reqmethod.toUpperCase() !== 'GET') {
                this.xssObj.requestData.reqMethod = `${reqObj.body.reqmethod.toUpperCase()}_NOT_SUPPORTED`;
            }
            else {
                this.xssObj.requestData.reqMethod = reqObj.body.reqmethod.toUpperCase();
            }
        }
        if(reqObj.body.url) {
            this.xssObj.requestData.checkUrl = reqObj.body.url;
        }
        if(reqObj.body.querystring) {
            this.xssObj.requestData.queryString = reqObj.body.url.includes('?') ? `&${reqObj.body.querystring}` : `?${reqObj.body.querystring}`
        }

        if(
            (!this.xssObj.requestData.checkUrl || this.xssObj.requestData.checkUrl === '') ||
            this.xssObj.requestData.reqMethod.match(/_NOT_SUPPORTED$/) ||
            (this.xssObj.requestData.queryString === null && this.xssObj.requestData.alertOnAnyEvent === false)
        ) {
            this.xssObj.responseData.statusCode = 400;
            this.xssObj.responseData.errorMsg = 'Missing or invalid request parameters';
            return resObj.status(400).json(this.xssObj);
        }
        else {
            await this.processPage();
            if(this.configObj.debugMode) {
                console.debug(`Request to ${this.xssObj.requestData.checkUrl} completed in ${(this.xssObj.responseData.requestTime / 1000).toFixed(3)} sec`);
            }
            return resObj.json(this.xssObj);
        }

    }

    /**
     * Perform the web request and process the page
     *
     * @returns {Promise<void>}
     * @memberof XssScanner
    */
    private async processPage(): Promise<void> {
        // Initialize Webbrowser page object
        const pageObj = this.configObj.allowCache === true ? await this.browserObj.newPage() : await this.browserCtx.newPage();
        await pageObj.setUserAgent(this.configObj.userAgent).catch();
        await pageObj.setRequestInterception(true);
        await pageObj.setDefaultTimeout(this.configObj.reqTimeout * 1000);
        
        // Event handler
        pageObj.once('request', requestObj => this.modifyRequest(requestObj));         
        pageObj.on('request', requestObj => this.checkBlocklist(requestObj));         
        pageObj.on('console', eventObj => this.eventTriggered(eventObj));
        pageObj.on('dialog', eventObj => this.eventTriggered(eventObj));
        pageObj.on('requestfailed', requestObj => this.errorTriggered(requestObj));

        // Open the website
        const httpResponse = await pageObj.goto(this.xssObj.requestData.checkUrl, { waitUntil: 'networkidle0' } ).catch(errorMsg => {
            console.error(`An error occured during "Page Goto" => ${errorMsg}`)
        });
        if(!httpResponse) return;

        // Evaluate the page (with or without performance data)
        const perfElementHandler = await pageObj.$('pageData').catch(errorMsg => {
            console.error(`An error occured during "Performance Element Handling" => ${errorMsg}`);
        });
        if(typeof perfElementHandler !== 'object') return;
        const perfJson = await pageObj.evaluate(pageData => {
            return JSON.stringify(performance.getEntriesByType('navigation'));
        }, perfElementHandler).catch(errorMsg => {
            console.error(`An error occured "Page evaluation" => ${errorMsg}`)
        });
        if(perfJson) {
            let perfData = this.processPerformanceData(perfJson);
            if(this.configObj.perfMode) {
                this.xssObj.performanceData = perfData;
            }
            this.xssObj.responseData.requestTime = perfData.totalDurTime;
        }

        // Finalize response data
        this.xssObj.requestData.queryString = this.xssObj.requestData.queryString.substr(1);
        this.xssObj.responseData.statusCode = httpResponse.status();
        this.xssObj.responseData.statusMsg = httpResponse.statusText();
    }

    /**
     * Modify the request before processing
     * This is especially important to perform POST requests
     *
     * @param {Puppeteer.Request} requestObj The Puppeteer request object
     * @returns {Promise<void>}
     * @memberof XssScanner
    */
    private async modifyRequest(requestObj: Puppeteer.Request): Promise<void> {
        if(this.xssObj.requestData.reqMethod === 'POST') {
            this.requestData.method = this.xssObj.requestData.reqMethod;
            this.requestData.postData = this.xssObj.requestData.queryString;
            this.requestData.headers = {
                ...requestObj.headers(),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
        else {
            this.requestData.method = this.xssObj.requestData.reqMethod;
            this.requestData.url = `${this.xssObj.requestData.checkUrl}${this.xssObj.requestData.queryString}`;
        }
    }

    /**
     * Check if a resource is on the blocklist and abort the call accordingly
     *
     * @param {Puppeteer.Request} requestObj The Puppeteer request object
     * @returns {Promise<void>}
     * @memberof XssScanner
    */
    private async checkBlocklist(requestObj: Puppeteer.Request): Promise<void> {
        let continueData = this.requestData as Object;
        this.requestData = {};

        const isBlocklisted = (blockListItem: string) => {
            let regEx = new RegExp(blockListItem, 'g');
            return requestObj.url().match(regEx);
        };
        if(this.configObj.resBlockList.some(isBlocklisted)) {
            const errorObj: ErrorCode = 'blockedbyclient';
            if(this.configObj.debugMode) {
                console.log(`${requestObj.url()} is blocklisted. Not loading resource.`);
            }
            this.xssObj.blockedUrls.push(requestObj.url());
            await requestObj.abort(errorObj);
        }
        else {
            if(continueData !== null) {
                await requestObj.continue(continueData).catch(errorMsg => {
                    console.error(`Unable to continue on ${requestObj.url()}: ${errorMsg}`);
                });
            }
            else {
                await requestObj.continue().catch(errorMsg => {
                    console.error(`Unable to continue on ${requestObj.url()}: ${errorMsg}`);
                });
            }
        }
    }

    /**
     * Eventhandler for when an event in the website fired
     *
     * @param {Puppeteer.ConsoleMessage|Puppeteer.Dialog} eventObj The Puppeteer event object
     * @returns {Promise<void>}
     * @memberof XssScanner
    */
    private async eventTriggered(eventObj: Puppeteer.ConsoleMessage | Puppeteer.Dialog): Promise<void> {
        let eventMsg: string = null;
        let eventType: string = null;
        if(this.toolsObj.eventIsDialog(eventObj)) {
            eventMsg = eventObj.message();
            eventType = eventObj.type();
            eventObj.dismiss();
        }
        else {
            eventMsg = eventObj.text();
            eventType = eventObj.type();
        }
        if(eventType === 'error') return;

        if(this.configObj.debugMode) {
            console.log(`An event has been executed on ${this.xssObj.requestData.checkUrl}`);
            console.log(`==> EventType: "${eventType}" // EventData: "${eventMsg}"`);
        }
        if(eventMsg === this.xssObj.requestData.searchString || this.xssObj.requestData.alertOnAnyEvent === true) {
            if(this.configObj.debugMode) {
                console.log(`Possible XSS! The eventMsg matches the search string: "${this.xssObj.requestData.searchString}"`);
            }
            this.xssObj.hasXss = true;
            this.xssObj.xssData.push({eventType: eventType, eventMsg: eventMsg});
        }
    }

    /**
     * Eventhandler for when an error in the website fired
     *
     * @param {Puppeteer.Request} requestObj The Puppeteer request object
     * @returns {Promise<void>}
     * @memberof XssScanner
    */
    private async errorTriggered(requestObj: Puppeteer.Request): Promise<void> {
        if(this.configObj.debugMode) {
            console.error(`Unable to load resource URL => ${requestObj.url()}`);
            console.error(`Request failed with an "${requestObj.failure().errorText}" error`)
            if(requestObj.response()) {
                console.error(`Resulting status: ${requestObj.response().status()} ${requestObj.response().statusText()}`);
            }
            
        }
        if(this.configObj.returnErrors && this.configObj.resErrorIgnoreCodes.indexOf(requestObj.failure().errorText) === -1) {
            this.xssObj.resourceErrors.push({
                url: requestObj.url(),
                errorCode: requestObj.failure().errorText,
                statusCode: requestObj.response() ? requestObj.response().status() : null,
                statusText: requestObj.response() ? requestObj.response().statusText() : null,
            });
        }
    }

    /**
     * Process the performance data into usable format
     *
     * @param {string} perfJson Stringified JSON data of the Performance object
     * @returns {IPerformanceData}
     * @memberof XssScanner
    */
    private processPerformanceData(perfJson: string): IPerformanceData {
        let perfData = Object.assign({});
        let perfEntries = JSON.parse(perfJson);
        if(perfEntries !== null && perfEntries[0]) {
            let perfEntry = perfEntries[0] as PerformanceNavigationTiming;
            perfData.totalDurTime = perfEntry.duration;
            perfData.dnsTime = (perfEntry.domainLookupEnd - perfEntry.domainLookupStart);
            perfData.connectTime =(perfEntry.connectEnd - perfEntry.connectStart);
            perfData.ttfbTime = (perfEntry.responseStart - perfEntry.requestStart);
            perfData.downloadTime = (perfEntry.responseEnd - perfEntry.responseStart);
            perfData.domIntTime = (perfEntry.domInteractive - perfEntry.responseEnd);
            perfData.domContentTime = (perfEntry.domContentLoadedEventEnd - perfEntry.domContentLoadedEventStart);
            perfData.domCompleteTime = (perfEntry.domComplete - perfEntry.domContentLoadedEventEnd);
        }

        return perfData;
    }

}