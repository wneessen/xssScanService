import Express from 'express';
import Puppeteer from 'puppeteer';
import Getopt from 'node-getopt';
import { IXssScanConfig, IXssObj, IXssDataObj, IXssReqObj, IXssResObj, IReturnResourceError } from './xssInterfaces';
import { nextTick } from 'process';

export default class XssScanner {
    private browserObj: Puppeteer.Browser;
    private browserCtx: Puppeteer.BrowserContext;
    private configObj: IXssScanConfig;
    private xssReqData: IXssReqObj = null;
    private xssResData: IXssResObj = null;
    private xssObj: IXssObj = null;
    
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

    public async processRequest(reqObj: Express.Request, resObj: Express.Response) {
        reqObj.setTimeout(this.configObj.reqTimeout * 1000);
        const dateObj = new Date();
        let benchMark = Date.now();
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
        this.processPage();

        resObj.send(this.xssObj);
    }


    private async processPage() {

        // Initialize Webbrowser page object
        const pageObj = this.configObj.allowCache === true ? await this.browserObj.newPage() : await this.browserCtx.newPage();
        await pageObj.setUserAgent(this.configObj.userAgent).catch();
        await pageObj.setRequestInterception(true);
        
        // Event handler
        pageObj.on('request', requestObj => this.checkBlocklist(requestObj));         

        await pageObj.goto('https://shop.avira.com/30/purl-in_appsp_2019?cart=215180', { waitUntil: 'networkidle2' } ).catch(errorMsg => {
            console.error(`An error occured during "Page Goto" => ${errorMsg}`)
                    throw new Error(`An error occured during "Page object create" => ${errorMsg}`);
        });
        const navPerfObj = await pageObj.$('perfObj').catch(errorMsg => {
            console.error(`An error occured during "Page object create" => ${errorMsg}`);
                    throw new Error(`An error occured during "Page object create" => ${errorMsg}`);
        });
        if(typeof navPerfObj !== 'object') return;
        const perfJson = await pageObj.evaluate(perfObj => {
            return JSON.stringify(performance.getEntriesByType('navigation'));
        }, navPerfObj).catch(errorMsg => {
            console.error(`An error occured "Page evaluation" => ${errorMsg}`)
                    throw new Error(`An error occured during "Page object create" => ${errorMsg}`);
        });

        return perfJson;

    }

    private async checkBlocklist(requestObj: Puppeteer.Request) {
        const isBlocklisted = (blockListItem: string) => {
            let regEx = new RegExp(blockListItem, 'g');
            return requestObj.url().match(regEx);
        };
        if(this.configObj.resBlockList.some(isBlocklisted)) {
            if(this.configObj.debugMode) {
                console.log(`${requestObj.url()} is blocklisted. Not loading resource.`);
            }
            this.xssObj.blockedUrls.push(requestObj.url());
            await requestObj.abort().catch(errorMsg => {
                console.error(`An error occured while aborting request for ${requestObj.url()}: ${errorMsg}`);
                throw new Error(`Unable to abort network request: ${errorMsg}`);
            });
        }
        else {
            await requestObj.continue().catch(errorMsg => {
                console.error(`An error occured while continuing request for ${requestObj.url()}: ${errorMsg}`);
                throw new Error(`Unable to perform network request: ${errorMsg}`);
            });
        }
    }
}