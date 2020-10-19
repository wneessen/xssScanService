/******************************************************************************
* Interfaces and declarations
******************************************************************************/
/**
 * XssScanConfig object
 *
 * @interface IXssScanConfig
*/
interface IXssScanConfig {
    listenHost: string,
    listenPort: number,
    reqTimeout: number,
    debugMode: boolean,
    perfMode: boolean,
    returnErrors: boolean,
    returnWarnings: boolean,
    webSecEnable: boolean,
    userAgent: string,
    allowCache?: boolean,
    resBlockList?: Array<string>,
    resErrorIgnoreCodes?: Array<string>,
    consoleIgnoreList?: Array<IXssConsoleIgnoreEntry>
}

/**
 * XSS object - returned from the webserivice to the client
 *
 * @interface IXssObj
*/
interface IXssObj {
    requestId: string
    checkTime: Date,
    hasXss: boolean,
    requestData: IXssReqObj,
    responseData: IXssResObj,
    performanceData?: IPerformanceData,
    xssData: Array<IXssDataObj>,
    resourceErrors?: Array<IReturnResourceError>,
    consoleWarnings?: Array<IReturnConsoleWarning>,
    blockedUrls?: Array<string>,
}

/**
 * XSS request object - The HTTP request part of the XSS object
 *
 * @interface IXssReqObj
*/
interface IXssReqObj {
    alertOnAnyEvent?: boolean,
    checkUrl: string,
    queryString: string,
    reqMethod: string,
    searchString: string,
}

/**
 * XSS response object - The HTTP response part of the XSS object
 *
 * @interface IXssResObj
*/
interface IXssResObj {
    errorMsg?: string,
    requestTime?: number
    statusCode: number,
    statusMsg: string,
}

/**
 * XSS data object - Holds data about possible XSS
 *
 * @interface IXssDataObj
*/
interface IXssDataObj {
    eventType: string,
    eventMsg: string,
}

/**
 * Resource Error object - Holds information when a resource fired an error
 *
 * @interface IReturnResourceError
*/
interface IReturnResourceError {
    url: string,
    errorCode: string,
    statusCode: number,
    statusText: string
}

/**
 * Console Warning object - Holds information when a console warning is fired
 *
 * @interface IReturnConsoleWarning
*/
interface IReturnConsoleWarning {
    url: string,
    line: number,
    warnText: string
}

/**
 * HTTP Request data - For request interception
 *
 * @interface IRequestData
*/
interface IRequestData {
    headers?: Record<string, string>,
    url?: string,
    postData?: string,
    method?: string,
}

/**
 * HTTP performance data
 *
 * @interface IPerformanceData
*/
interface IPerformanceData {
    totalDurTime: number,
    dnsTime: number,
    connectTime: number,
    ttfbTime: number,
    downloadTime: number,
    domIntTime: number,
    domContentTime: number,
    domCompleteTime: number
}

/**
 * Array of XSSObjects
 *
 * @interface IXssObjArray
*/
interface IXssObjArray {
    [key: string]: IXssObj
}

/**
 * XssConsoleIgnoreEntry
 *
 * @interface IXssConsoleIgnoreEntry
*/
interface IXssConsoleIgnoreEntry {
    eventType: string,
    consoleMessage: string
}

export { IXssScanConfig, IXssObj, IXssDataObj, IXssReqObj, IXssResObj, IReturnResourceError, IRequestData, IPerformanceData, IReturnConsoleWarning, IXssObjArray, IXssConsoleIgnoreEntry }