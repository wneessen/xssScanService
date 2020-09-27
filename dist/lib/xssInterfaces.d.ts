interface IXssScanConfig {
    listenHost: string;
    listenPort: number;
    reqTimeout: number;
    debugMode: boolean;
    perfMode: boolean;
    returnErrors: boolean;
    webSecEnable: boolean;
    userAgent: string;
    allowCache?: boolean;
    resBlockList?: Array<string>;
    resErrorIgnoreCodes?: Array<string>;
}
interface IXssObj {
    checkTime: Date;
    hasXss: boolean;
    requestData: IXssReqObj;
    responseData: IXssResObj;
    performanceData?: IPerformanceData;
    xssData: Array<IXssDataObj>;
    resourceErrors?: Array<IReturnResourceError>;
    blockedUrls?: Array<string>;
}
interface IXssReqObj {
    alertOnAnyEvent?: boolean;
    checkUrl: string;
    queryString: string;
    reqMethod: string;
    searchString: string;
}
interface IXssResObj {
    errorMsg?: string;
    requestTime?: number;
    statusCode: number;
    statusMsg: string;
}
interface IXssDataObj {
    eventType: string;
    eventMsg: string;
}
interface IReturnResourceError {
    url: string;
    errorCode: string;
    statusCode: number;
    statusText: string;
}
interface IRequestData {
    headers?: Record<string, string>;
    url?: string;
    postData?: string;
    method?: string;
}
interface IPerformanceData {
    totalDurTime: number;
    dnsTime: number;
    connectTime: number;
    ttfbTime: number;
    downloadTime: number;
    domIntTime: number;
    domContentTime: number;
    domCompleteTime: number;
}
export { IXssScanConfig, IXssObj, IXssDataObj, IXssReqObj, IXssResObj, IReturnResourceError, IRequestData, IPerformanceData };
//# sourceMappingURL=xssInterfaces.d.ts.map