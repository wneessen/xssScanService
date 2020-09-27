import Express from 'express';
import Puppeteer from 'puppeteer';
import { IXssScanConfig } from './xssInterfaces';
export default class XssScanner {
    private browserObj;
    private browserCtx;
    private configObj;
    private xssReqData;
    private xssResData;
    private xssObj;
    private requestData;
    private benchMark;
    private toolsObj;
    constructor(browserObj: Puppeteer.Browser, browserCtx: Puppeteer.BrowserContext, configObj: IXssScanConfig);
    processRequest(reqObj: Express.Request, resObj: Express.Response): Promise<Express.Response>;
    private processPage;
    private modifyRequest;
    private checkBlocklist;
    private eventTriggered;
    private errorTriggered;
    private processPerformanceData;
}
//# sourceMappingURL=xssScanner.d.ts.map