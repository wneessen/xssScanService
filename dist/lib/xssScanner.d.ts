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
    constructor(browserObj: Puppeteer.Browser, browserCtx: Puppeteer.BrowserContext, configObj: IXssScanConfig);
    processRequest(reqObj: Express.Request, resObj: Express.Response): Promise<void>;
    private processPage;
    private checkBlocklist;
}
//# sourceMappingURL=xssScanner.d.ts.map