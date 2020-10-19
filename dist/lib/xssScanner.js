"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const xssTools_1 = __importDefault(require("./xssTools"));
class XssScanner {
    constructor(browserObj, browserCtx, configObj) {
        this.xssObj = {};
        this.requestData = {};
        this.toolsObj = new xssTools_1.default();
        this.browserObj = browserObj;
        this.browserCtx = browserCtx;
        this.configObj = configObj;
    }
    async processRequest(reqObj, resObj, nextFunc) {
        reqObj.setTimeout(this.configObj.reqTimeout * 1000);
        const curReqId = this.toolsObj.shaDigest('sha1', `${Date.now()}${reqObj.body.url}${reqObj.body.queryString}`);
        const dateObj = new Date();
        let xssReqData = {
            alertOnAnyEvent: false,
            checkUrl: null,
            queryString: null,
            reqMethod: 'GET',
            searchString: 'XSSed!',
        };
        let xssResData = {
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
        if (this.configObj.debugMode) {
            console.log('Received new HTTP request');
            if (reqObj.body) {
                console.log('postData:', reqObj.body);
            }
        }
        if (reqObj.body.searchfor) {
            this.xssObj[curReqId].requestData.searchString = reqObj.body.searchfor;
        }
        if (reqObj.body.everyevent && reqObj.body.everyevent === 'true') {
            this.xssObj[curReqId].requestData.alertOnAnyEvent = true;
        }
        if (reqObj.body.reqmethod) {
            if (reqObj.body.reqmethod.toUpperCase() !== 'POST' && reqObj.body.reqmethod.toUpperCase() !== 'GET') {
                this.xssObj[curReqId].requestData.reqMethod = `${reqObj.body.reqmethod.toUpperCase()}_NOT_SUPPORTED`;
            }
            else {
                this.xssObj[curReqId].requestData.reqMethod = reqObj.body.reqmethod.toUpperCase();
            }
        }
        if (reqObj.body.url) {
            this.xssObj[curReqId].requestData.checkUrl = reqObj.body.url;
        }
        else {
            nextFunc(this.xssObj);
            return;
        }
        if (reqObj.body.querystring) {
            this.xssObj[curReqId].requestData.queryString = reqObj.body.url.includes('?') ? `&${reqObj.body.querystring}` : `?${reqObj.body.querystring}`;
        }
        else {
            nextFunc(this.xssObj[curReqId]);
            return;
        }
        if ((!this.xssObj[curReqId].requestData.checkUrl || this.xssObj[curReqId].requestData.checkUrl === '') ||
            this.xssObj[curReqId].requestData.reqMethod.match(/_NOT_SUPPORTED$/) ||
            (this.xssObj[curReqId].requestData.queryString === null && this.xssObj[curReqId].requestData.alertOnAnyEvent === false)) {
            this.xssObj[curReqId].responseData.statusCode = 400;
            this.xssObj[curReqId].responseData.errorMsg = 'Missing or invalid request parameters';
            return resObj.status(400).json(this.xssObj);
        }
        else {
            await this.processPage(curReqId);
            if (this.configObj.debugMode) {
                console.debug(`Request to ${this.xssObj[curReqId].requestData.checkUrl} completed in ${(this.xssObj[curReqId].responseData.requestTime / 1000).toFixed(3)} sec (RequestID: ${curReqId})`);
            }
            if (resObj.writableFinished === false) {
                return resObj.json(this.xssObj[curReqId]);
            }
            else {
                nextFunc();
                return;
            }
        }
    }
    async processPage(curReqId) {
        const pageObj = this.configObj.allowCache === true ? await this.browserObj.newPage() : await this.browserCtx.newPage();
        await pageObj.setUserAgent(this.configObj.userAgent).catch();
        await pageObj.setRequestInterception(true);
        await pageObj.setDefaultTimeout(this.configObj.reqTimeout * 1000);
        pageObj.once('request', requestObj => this.modifyRequest(requestObj, curReqId));
        pageObj.on('request', requestObj => this.checkBlocklist(requestObj, curReqId));
        pageObj.on('console', eventObj => this.eventTriggered(eventObj, curReqId));
        pageObj.on('dialog', eventObj => this.eventTriggered(eventObj, curReqId));
        pageObj.on('requestfailed', requestObj => this.errorTriggered(requestObj, curReqId));
        const httpResponse = await pageObj.goto(this.xssObj[curReqId].requestData.checkUrl, { waitUntil: 'networkidle0' }).catch(errorMsg => {
            this.xssObj[curReqId].responseData.errorMsg = `${errorMsg}`;
            this.xssObj[curReqId].responseData.statusCode = 400;
            this.xssObj[curReqId].responseData.statusMsg = 'Bad request';
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
                this.xssObj[curReqId].performanceData = perfData;
            }
            this.xssObj[curReqId].responseData.requestTime = perfData.totalDurTime;
        }
        this.xssObj[curReqId].requestData.queryString = this.xssObj[curReqId].requestData.queryString.substr(1);
        this.xssObj[curReqId].responseData.statusCode = httpResponse.status();
        this.xssObj[curReqId].responseData.statusMsg = httpResponse.statusText();
    }
    async modifyRequest(requestObj, curReqId) {
        if (this.xssObj[curReqId].requestData.reqMethod === 'POST') {
            this.requestData.method = this.xssObj[curReqId].requestData.reqMethod;
            this.requestData.postData = this.xssObj[curReqId].requestData.queryString;
            this.requestData.headers = {
                ...requestObj.headers(),
                'Content-Type': 'application/x-www-form-urlencoded'
            };
        }
        else {
            this.requestData.method = this.xssObj[curReqId].requestData.reqMethod;
            this.requestData.url = `${this.xssObj[curReqId].requestData.checkUrl}${this.xssObj[curReqId].requestData.queryString}`;
        }
    }
    async checkBlocklist(requestObj, curReqId) {
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
            this.xssObj[curReqId].blockedUrls.push(requestObj.url());
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
    async eventTriggered(eventObj, curReqId) {
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
        let isIgnored = false;
        this.configObj.consoleIgnoreList.forEach(ignoreEntry => {
            if (ignoreEntry.consoleMessage === eventMsg && ignoreEntry.eventType === eventType) {
                if (this.configObj.debugMode) {
                    console.debug('consoleMsg/eventType combination is on ignorelist. Event will be ignored.');
                }
                isIgnored = true;
            }
        });
        if (isIgnored)
            return;
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
                this.xssObj[curReqId].consoleWarnings.push(warnObj);
            }
            return;
        }
        if (this.configObj.debugMode) {
            console.log(`An event has been executed on ${this.xssObj[curReqId].requestData.checkUrl}`);
            console.log(`==> EventType: "${eventType}" // EventData: "${eventMsg}"`);
        }
        if (eventMsg === this.xssObj[curReqId].requestData.searchString || this.xssObj[curReqId].requestData.alertOnAnyEvent === true) {
            if (this.configObj.debugMode) {
                console.log(`Possible XSS! The eventMsg matches the search string: "${this.xssObj[curReqId].requestData.searchString}"`);
            }
            this.xssObj[curReqId].hasXss = true;
            this.xssObj[curReqId].xssData.push({ eventType: eventType, eventMsg: eventMsg });
        }
    }
    async errorTriggered(requestObj, curReqId) {
        if (this.configObj.debugMode) {
            console.error(`Unable to load resource URL => ${requestObj.url()}`);
            console.error(`Request failed with an "${requestObj.failure().errorText}" error`);
            if (requestObj.response()) {
                console.error(`Resulting status: ${requestObj.response().status()} ${requestObj.response().statusText()}`);
            }
        }
        if (this.configObj.returnErrors && this.configObj.resErrorIgnoreCodes.indexOf(requestObj.failure().errorText) === -1) {
            this.xssObj[curReqId].resourceErrors.push({
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
