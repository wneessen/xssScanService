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
    webSecEnable: boolean,
    userAgent: string,
    allowCache?: boolean,
    resBlockList?: Array<string>
}

/**
 * XSS object - returned from the webserivice to the client
 *
 * @interface IXssObj
*/
interface IXssObj {
    checkTime: Date,
    hasXss: boolean,
    requestData: IXssReqObj,
    responseData: IXssResObj,
    performanceData?: string,
    xssData: Array<IXssDataObj>,
    resourceErrors?: Array<IReturnResourceError>,
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



export { IXssScanConfig, IXssObj, IXssDataObj, IXssReqObj, IXssResObj, IReturnResourceError, IRequestData }