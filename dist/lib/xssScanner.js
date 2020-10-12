"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const xssTools_1 = __importDefault(require("./xssTools"));
class XssScanner {
    constructor(browserObj, browserCtx, configObj) {
        this.xssReqData = null;
        this.xssResData = null;
        this.xssObj = null;
        this.requestData = {};
        this.toolsObj = new xssTools_1.default();
        this.browserObj = browserObj;
        this.browserCtx = browserCtx;
        this.configObj = configObj;
    }
    async processRequest(reqObj, resObj, nextFunc) {
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
            resourceErrors: [],
            consoleWarnings: [],
            requestId: null,
        };
        if (this.configObj.debugMode) {
            console.log('Received new HTTP request');
            if (reqObj.body) {
                console.log('postData:', reqObj.body);
            }
        }
        if (reqObj.body.searchfor) {
            this.xssObj.requestData.searchString = reqObj.body.searchfor;
        }
        if (reqObj.body.everyevent && reqObj.body.everyevent === 'true') {
            this.xssObj.requestData.alertOnAnyEvent = true;
        }
        if (reqObj.body.reqmethod) {
            if (reqObj.body.reqmethod.toUpperCase() !== 'POST' && reqObj.body.reqmethod.toUpperCase() !== 'GET') {
                this.xssObj.requestData.reqMethod = `${reqObj.body.reqmethod.toUpperCase()}_NOT_SUPPORTED`;
            }
            else {
                this.xssObj.requestData.reqMethod = reqObj.body.reqmethod.toUpperCase();
            }
        }
        if (reqObj.body.url) {
            this.xssObj.requestData.checkUrl = reqObj.body.url;
        }
        else {
            nextFunc(this.xssObj);
            return;
        }
        if (reqObj.body.querystring) {
            this.xssObj.requestData.queryString = reqObj.body.url.includes('?') ? `&${reqObj.body.querystring}` : `?${reqObj.body.querystring}`;
        }
        else {
            nextFunc(this.xssObj);
            return;
        }
        if ((!this.xssObj.requestData.checkUrl || this.xssObj.requestData.checkUrl === '') ||
            this.xssObj.requestData.reqMethod.match(/_NOT_SUPPORTED$/) ||
            (this.xssObj.requestData.queryString === null && this.xssObj.requestData.alertOnAnyEvent === false)) {
            this.xssObj.responseData.statusCode = 400;
            this.xssObj.responseData.errorMsg = 'Missing or invalid request parameters';
            return resObj.status(400).json(this.xssObj);
        }
        else {
            this.xssObj.requestId = this.toolsObj.shaDigest('sha1', `${Date.now()}${this.xssObj.requestData.checkUrl}${this.xssObj.requestData.queryString}`);
            await this.processPage();
            if (this.configObj.debugMode) {
                console.debug(`Request to ${this.xssObj.requestData.checkUrl} completed in ${(this.xssObj.responseData.requestTime / 1000).toFixed(3)} sec`);
            }
            if (resObj.writableFinished === false) {
                return resObj.json(this.xssObj);
            }
            else {
                nextFunc();
                return;
            }
        }
    }
    async processPage() {
        const pageObj = this.configObj.allowCache === true ? await this.browserObj.newPage() : await this.browserCtx.newPage();
        await pageObj.setUserAgent(this.configObj.userAgent).catch();
        await pageObj.setRequestInterception(true);
        await pageObj.setDefaultTimeout(this.configObj.reqTimeout * 1000);
        pageObj.once('request', requestObj => this.modifyRequest(requestObj));
        pageObj.on('request', requestObj => this.checkBlocklist(requestObj));
        pageObj.on('console', eventObj => this.eventTriggered(eventObj));
        pageObj.on('dialog', eventObj => this.eventTriggered(eventObj));
        pageObj.on('requestfailed', requestObj => this.errorTriggered(requestObj));
        const httpResponse = await pageObj.goto(this.xssObj.requestData.checkUrl, { waitUntil: 'networkidle0' }).catch(errorMsg => {
            this.xssObj.responseData.errorMsg = `${errorMsg}`;
            this.xssObj.responseData.statusCode = 400;
            this.xssObj.responseData.statusMsg = 'Bad request';
            console.error(`An error occured during "Page Goto" => ${errorMsg}`);
        });
        if (!httpResponse)
            return;
        const perfElementHandler = await pageObj.$('pageData').catch(errorMsg => {
            console.error(`An error occured during "Performance Element Handling" => ${errorMsg}`);
        });
        if (typeof perfElementHandler !== 'object')
            return;
        const perfJson = await pageObj.evaluate(pageData => {
            return JSON.stringify(performance.getEntriesByType('navigation'));
        }, perfElementHandler).catch(errorMsg => {
            console.error(`An error occured "Page evaluation" => ${errorMsg}`);
        });
        if (perfJson) {
            let perfData = this.processPerformanceData(perfJson);
            if (this.configObj.perfMode) {
                this.xssObj.performanceData = perfData;
            }
            this.xssObj.responseData.requestTime = perfData.totalDurTime;
        }
        pageObj.close();
        this.xssObj.requestData.queryString = this.xssObj.requestData.queryString.substr(1);
        this.xssObj.responseData.statusCode = httpResponse.status();
        this.xssObj.responseData.statusMsg = httpResponse.statusText();
    }
    async modifyRequest(requestObj) {
        if (this.xssObj.requestData.reqMethod === 'POST') {
            this.requestData.method = this.xssObj.requestData.reqMethod;
            this.requestData.postData = this.xssObj.requestData.queryString;
            this.requestData.headers = {
                ...requestObj.headers(),
                'Content-Type': 'application/x-www-form-urlencoded'
            };
        }
        else {
            this.requestData.method = this.xssObj.requestData.reqMethod;
            this.requestData.url = `${this.xssObj.requestData.checkUrl}${this.xssObj.requestData.queryString}`;
        }
    }
    async checkBlocklist(requestObj) {
        let continueData = this.requestData;
        this.requestData = {};
        const isBlocklisted = (blockListItem) => {
            let regEx = new RegExp(blockListItem, 'g');
            return requestObj.url().match(regEx);
        };
        if (this.configObj.resBlockList.some(isBlocklisted)) {
            const errorObj = 'blockedbyclient';
            if (this.configObj.debugMode) {
                console.log(`${requestObj.url()} is blocklisted. Not loading resource.`);
            }
            this.xssObj.blockedUrls.push(requestObj.url());
            await requestObj.abort(errorObj);
        }
        else {
            if (continueData !== null) {
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
    async eventTriggered(eventObj) {
        let eventMsg = null;
        let eventType = null;
        if (this.toolsObj.eventIsDialog(eventObj)) {
            eventMsg = eventObj.message();
            eventType = eventObj.type();
            eventObj.dismiss();
        }
        else {
            eventMsg = eventObj.text();
            eventType = eventObj.type();
        }
        if (eventType === 'error')
            return;
        if (eventType === 'warning') {
            if (this.configObj.returnWarnings === true) {
                let consoleWarning = eventObj;
                const warnObj = {
                    line: consoleWarning.location().lineNumber,
                    url: consoleWarning.location().url,
                    warnText: consoleWarning.text()
                };
                this.xssObj.consoleWarnings.push(warnObj);
            }
            return;
        }
        if (this.configObj.debugMode) {
            console.log(`An event has been executed on ${this.xssObj.requestData.checkUrl}`);
            console.log(`==> EventType: "${eventType}" // EventData: "${eventMsg}"`);
        }
        if (eventMsg === this.xssObj.requestData.searchString || this.xssObj.requestData.alertOnAnyEvent === true) {
            if (this.configObj.debugMode) {
                console.log(`Possible XSS! The eventMsg matches the search string: "${this.xssObj.requestData.searchString}"`);
            }
            this.xssObj.hasXss = true;
            this.xssObj.xssData.push({ eventType: eventType, eventMsg: eventMsg });
        }
    }
    async errorTriggered(requestObj) {
        if (this.configObj.debugMode) {
            console.error(`Unable to load resource URL => ${requestObj.url()}`);
            console.error(`Request failed with an "${requestObj.failure().errorText}" error`);
            if (requestObj.response()) {
                console.error(`Resulting status: ${requestObj.response().status()} ${requestObj.response().statusText()}`);
            }
        }
        if (this.configObj.returnErrors && this.configObj.resErrorIgnoreCodes.indexOf(requestObj.failure().errorText) === -1) {
            this.xssObj.resourceErrors.push({
                url: requestObj.url(),
                errorCode: requestObj.failure().errorText,
                statusCode: requestObj.response() ? requestObj.response().status() : null,
                statusText: requestObj.response() ? requestObj.response().statusText() : null,
            });
        }
    }
    processPerformanceData(perfJson) {
        let perfData = Object.assign({});
        let perfEntries = JSON.parse(perfJson);
        if (perfEntries !== null && perfEntries[0]) {
            let perfEntry = perfEntries[0];
            perfData.totalDurTime = perfEntry.duration;
            perfData.dnsTime = (perfEntry.domainLookupEnd - perfEntry.domainLookupStart);
            perfData.connectTime = (perfEntry.connectEnd - perfEntry.connectStart);
            perfData.ttfbTime = (perfEntry.responseStart - perfEntry.requestStart);
            perfData.downloadTime = (perfEntry.responseEnd - perfEntry.responseStart);
            perfData.domIntTime = (perfEntry.domInteractive - perfEntry.responseEnd);
            perfData.domContentTime = (perfEntry.domContentLoadedEventEnd - perfEntry.domContentLoadedEventStart);
            perfData.domCompleteTime = (perfEntry.domComplete - perfEntry.domContentLoadedEventEnd);
        }
        return perfData;
    }
}
exports.default = XssScanner;
