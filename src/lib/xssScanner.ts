import Express from 'express';
import Puppeteer, { ErrorCode } from 'puppeteer';
import XssTools from './xssTools';
import { IXssScanConfig, IXssObj, IXssDataObj, IXssReqObj, IXssResObj, IReturnResourceError, IRequestData, IPerformanceData, IReturnConsoleWarning, IXssObjArray } from './xssInterfaces';

export default class XssScanner {
    private browserObj: Puppeteer.Browser;
    private browserCtx: Puppeteer.BrowserContext;
    private configObj: IXssScanConfig;
    public xssObj: IXssObjArray = {};
    private requestData: IRequestData = {};
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
    public async processRequest(reqObj: Express.Request, resObj: Express.Response, nextFunc: Express.NextFunction): Promise<Express.Response> {
        reqObj.setTimeout(this.configObj.reqTimeout * 1000);
        const curReqId = this.toolsObj.shaDigest('sha1', `${Date.now()}${reqObj.body.url}${reqObj.body.queryString}`);
        const dateObj = new Date();
        let xssReqData: IXssReqObj = {
            alertOnAnyEvent: false,
            checkUrl: null,
            queryString: null,
            reqMethod: 'GET',
            searchString: 'XSSed!',
        };
        let xssResData: IXssResObj = {
            requestTime: 0,
            statusMsg: null,
            statusCode: 0,
        };
        this.xssObj[curReqId] = {
            blockedUrls: [],
            checkTime: dateObj,
            responseData: xssResData,
            requestData: xssReqData,
            hasXss: false,
            xssData: [],
            resourceErrors: [],
            consoleWarnings: [],
            requestId: curReqId
        };
        if(this.configObj.debugMode) {
            console.log('Received new HTTP request');
            if(reqObj.body) {
                console.log('postData:',  reqObj.body);
            }
        }
        if(reqObj.body.searchfor) {
            this.xssObj[curReqId].requestData.searchString = reqObj.body.searchfor;
        }
        if(reqObj.body.everyevent && reqObj.body.everyevent === 'true') {
            this.xssObj[curReqId].requestData.alertOnAnyEvent = true;
        }
        if(reqObj.body.reqmethod) {
            if(reqObj.body.reqmethod.toUpperCase() !== 'POST' && reqObj.body.reqmethod.toUpperCase() !== 'GET') {
                this.xssObj[curReqId].requestData.reqMethod = `${reqObj.body.reqmethod.toUpperCase()}_NOT_SUPPORTED`;
            }
            else {
                this.xssObj[curReqId].requestData.reqMethod = reqObj.body.reqmethod.toUpperCase();
            }
        }
        if(reqObj.body.url) {
            this.xssObj[curReqId].requestData.checkUrl = reqObj.body.url;
        }
        else {
            nextFunc(this.xssObj);
            return;
        }
        if(reqObj.body.querystring) {
            this.xssObj[curReqId].requestData.queryString = reqObj.body.url.includes('?') ? `&${reqObj.body.querystring}` : `?${reqObj.body.querystring}`
        }
        else {
            nextFunc(this.xssObj[curReqId]);
            return;
        }

        if(
            (!this.xssObj[curReqId].requestData.checkUrl || this.xssObj[curReqId].requestData.checkUrl === '') ||
            this.xssObj[curReqId].requestData.reqMethod.match(/_NOT_SUPPORTED$/) ||
            (this.xssObj[curReqId].requestData.queryString === null && this.xssObj[curReqId].requestData.alertOnAnyEvent === false)
        ) {
            this.xssObj[curReqId].responseData.statusCode = 400;
            this.xssObj[curReqId].responseData.errorMsg = 'Missing or invalid request parameters';
            return resObj.status(400).json(this.xssObj);
        }
        else {
            await this.processPage(curReqId);
            if(this.configObj.debugMode) {
                console.debug(`Request to ${this.xssObj[curReqId].requestData.checkUrl} completed in ${(this.xssObj[curReqId].responseData.requestTime / 1000).toFixed(3)} sec (RequestID: ${curReqId})`);
            }
            if(resObj.writableFinished === false) {
                return resObj.json(this.xssObj[curReqId]);
            }
            else {
                nextFunc();
                return
            }
        }
    }

    /**
     * Perform the web request and process the page
     *
     * @returns {Promise<void>}
     * @memberof XssScanner
    */
    private async processPage(curReqId: string): Promise<void> {
        // Initialize Webbrowser page object
        const pageObj = this.configObj.allowCache === true ? await this.browserObj.newPage() : await this.browserCtx.newPage();
        await pageObj.setUserAgent(this.configObj.userAgent).catch();
        await pageObj.setRequestInterception(true);
        await pageObj.setDefaultTimeout(this.configObj.reqTimeout * 1000);
        
        // Event handler
        pageObj.once('request', requestObj => this.modifyRequest(requestObj, curReqId));         
        pageObj.on('request', requestObj => this.checkBlocklist(requestObj, curReqId));         
        pageObj.on('console', eventObj => this.eventTriggered(eventObj, curReqId));
        pageObj.on('dialog', eventObj => this.eventTriggered(eventObj, curReqId));
        pageObj.on('requestfailed', requestObj => this.errorTriggered(requestObj, curReqId));

        // Open the website
        const httpResponse = await pageObj.goto(this.xssObj[curReqId].requestData.checkUrl, { waitUntil: 'networkidle0' } ).catch(errorMsg => {
            this.xssObj[curReqId].responseData.errorMsg = `${errorMsg}`;
            this.xssObj[curReqId].responseData.statusCode = 400;
            this.xssObj[curReqId].responseData.statusMsg = 'Bad request';
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
                this.xssObj[curReqId].performanceData = perfData;
            }
            this.xssObj[curReqId].responseData.requestTime = perfData.totalDurTime;
        }

        // Close the page
        //pageObj.close();

        // Finalize response data
        this.xssObj[curReqId].requestData.queryString = this.xssObj[curReqId].requestData.queryString.substr(1);
        this.xssObj[curReqId].responseData.statusCode = httpResponse.status();
        this.xssObj[curReqId].responseData.statusMsg = httpResponse.statusText();
    }

    /**
     * Modify the request before processing
     * This is especially important to perform POST requests
     *
     * @param {Puppeteer.Request} requestObj The Puppeteer request object
     * @returns {Promise<void>}
     * @memberof XssScanner
    */
    private async modifyRequest(requestObj: Puppeteer.Request, curReqId: string): Promise<void> {
        if(this.xssObj[curReqId].requestData.reqMethod === 'POST') {
            this.requestData.method = this.xssObj[curReqId].requestData.reqMethod;
            this.requestData.postData = this.xssObj[curReqId].requestData.queryString;
            this.requestData.headers = {
                ...requestObj.headers(),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
        else {
            this.requestData.method = this.xssObj[curReqId].requestData.reqMethod;
            this.requestData.url = `${this.xssObj[curReqId].requestData.checkUrl}${this.xssObj[curReqId].requestData.queryString}`;
        }
    }

    /**
     * Check if a resource is on the blocklist and abort the call accordingly
     *
     * @param {Puppeteer.Request} requestObj The Puppeteer request object
     * @returns {Promise<void>}
     * @memberof XssScanner
    */
    private async checkBlocklist(requestObj: Puppeteer.Request, curReqId: string): Promise<void> {
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
            this.xssObj[curReqId].blockedUrls.push(requestObj.url());
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
    private async eventTriggered(eventObj: Puppeteer.ConsoleMessage | Puppeteer.Dialog, curReqId: string): Promise<void> {
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

        if(eventType === 'warning') {
            if(this.configObj.returnWarnings === true) {
                let consoleWarning = eventObj as Puppeteer.ConsoleMessage;
                const warnObj: IReturnConsoleWarning = {
                    line: consoleWarning.location().lineNumber,
                    url: consoleWarning.location().url,
                    warnText: consoleWarning.text()
                }
                this.xssObj[curReqId].consoleWarnings.push(warnObj);
            }
            return;
        }

        if(this.configObj.debugMode) {
            console.log(`An event has been executed on ${this.xssObj[curReqId].requestData.checkUrl}`);
            console.log(`==> EventType: "${eventType}" // EventData: "${eventMsg}"`);
        }
        if(eventMsg === this.xssObj[curReqId].requestData.searchString || this.xssObj[curReqId].requestData.alertOnAnyEvent === true) {
            if(this.configObj.debugMode) {
                console.log(`Possible XSS! The eventMsg matches the search string: "${this.xssObj[curReqId].requestData.searchString}"`);
            }
            this.xssObj[curReqId].hasXss = true;
            this.xssObj[curReqId].xssData.push({eventType: eventType, eventMsg: eventMsg});
        }
    }

    /**
     * Eventhandler for when an error in the website fired
     *
     * @param {Puppeteer.Request} requestObj The Puppeteer request object
     * @returns {Promise<void>}
     * @memberof XssScanner
    */
    private async errorTriggered(requestObj: Puppeteer.Request, curReqId: string): Promise<void> {
        if(this.configObj.debugMode) {
            console.error(`Unable to load resource URL => ${requestObj.url()}`);
            console.error(`Request failed with an "${requestObj.failure().errorText}" error`)
            if(requestObj.response()) {
                console.error(`Resulting status: ${requestObj.response().status()} ${requestObj.response().statusText()}`);
            }
            
        }
        if(this.configObj.returnErrors && this.configObj.resErrorIgnoreCodes.indexOf(requestObj.failure().errorText) === -1) {
            this.xssObj[curReqId].resourceErrors.push({
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