"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const httpObj = __importStar(require("http"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const xssScanner_1 = __importDefault(require("./lib/xssScanner"));
const arg_1 = __importDefault(require("arg"));
const process_1 = __importDefault(require("process"));
process_1.default.on('SIGINT', () => {
    console.warn('\nGracefully shutting down from SIGINT (Ctrl-C)');
    process_1.default.exit(1);
});
const expressObj = express_1.default();
const httpServer = httpObj.createServer(expressObj);
const versionNum = '1.3.2-dev';
httpServer.on('error', errMsg => {
    console.error(`Unable to start webservice: ${errMsg}`);
    process_1.default.exit(1);
});
const configObj = {
    listenHost: 'localhost',
    listenPort: 8099,
    reqTimeout: 5000,
    debugMode: false,
    perfMode: false,
    webSecEnable: false,
    returnErrors: false,
    resBlockList: [
        'googletagmanager.com', 'google-analytics.com', 'optimizely.com', '.amazon-adsystem.com',
        'device-metrics-us.amazon.com', 'crashlytics.com', 'doubleclick.net'
    ],
    resErrorIgnoreCodes: ['net::ERR_BLOCKED_BY_CLIENT.Inspector'],
    allowCache: false,
    userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36 xssScanService/${versionNum}`
};
const pupLaunchOptions = {
    headless: true,
    args: [],
};
let cliArgs;
try {
    cliArgs = arg_1.default({
        '--listen': String,
        '--port': Number,
        '--timeout': Number,
        '--debug': Boolean,
        '--perf': Boolean,
        '--cache': Boolean,
        '--help': Boolean,
        '--returnerrors': Boolean,
        '--ignoresslerrors': Boolean,
        '--block': [String],
        '--browserpath': String,
        '--browsertype': String,
        '--noheadless': Boolean,
        '--nosandbox': Boolean,
        '-l': '--listen',
        '-p': '--port',
        '-t': '--timeout',
        '-b': '--block',
        '-c': '--cache',
        '-d': '--debug',
        '-h': '--help',
        '-s': '--ignoresslerrors'
    }, { argv: process_1.default.argv.slice(2) });
}
catch (errorObj) {
    console.error(`Error: ${errorObj.message}`);
    console.log('');
    showHelp();
    process_1.default.exit(1);
}
if (typeof cliArgs["--listen"] !== 'undefined') {
    configObj.listenHost = cliArgs["--listen"];
}
;
if (typeof cliArgs["--port"] !== 'undefined' && !isNaN(cliArgs["--port"]) && !(cliArgs["--port"] < 1 || cliArgs["--port"] > 65535)) {
    configObj.listenPort = cliArgs["--port"];
}
;
if (typeof cliArgs["--timeout"] !== 'undefined' && !isNaN(cliArgs["--timeout"]) && !(cliArgs["--timeout"] < 0 || cliArgs["--timeout"] > 300)) {
    configObj.reqTimeout = cliArgs["--timeout"];
}
;
if (typeof cliArgs["--block"] !== 'undefined') {
    cliArgs["--block"].forEach(blockDomain => configObj.resBlockList.push(blockDomain));
}
;
if (typeof cliArgs["--debug"] !== 'undefined') {
    configObj.debugMode = true;
}
;
if (typeof cliArgs["--perf"] !== 'undefined') {
    configObj.perfMode = true;
}
;
if (typeof cliArgs["--cache"] !== 'undefined') {
    configObj.allowCache = true;
}
;
if (typeof cliArgs["--returnerrors"] !== 'undefined') {
    configObj.returnErrors = true;
}
;
if (typeof cliArgs["--ignoresslerrors"] !== 'undefined') {
    pupLaunchOptions.ignoreHTTPSErrors = true;
}
;
if (typeof cliArgs["--noheadless"] !== 'undefined') {
    pupLaunchOptions.headless = false;
}
;
if (typeof cliArgs["--nosandbox"] !== 'undefined') {
    pupLaunchOptions.args.push('--no-sandbox');
}
;
if (typeof cliArgs["--browserpath"] !== 'undefined') {
    pupLaunchOptions.executablePath = cliArgs["--browserpath"];
}
;
if (typeof cliArgs["--browsertype"] !== 'undefined' &&
    (cliArgs["--browsertype"].toLowerCase() === 'firefox' || cliArgs["--browsertype"].toLowerCase() === 'chrome')) {
    if (typeof cliArgs["--browserpath"] === 'undefined') {
        console.error('Error: Parameter --browsertype requires a custom browser path via --browserpath');
        console.log('');
        showHelp();
        process_1.default.exit(1);
    }
    else {
        pupLaunchOptions.product = cliArgs["--browsertype"];
    }
}
;
if (typeof cliArgs["--help"] !== 'undefined') {
    showHelp();
    process_1.default.exit(0);
}
;
expressObj.use(express_1.default.urlencoded({ extended: true }));
expressObj.use(express_1.default.json());
expressObj.disable('x-powered-by');
async function startServer() {
    const browserObj = await puppeteer_1.default.launch(pupLaunchOptions).catch(errorMsg => {
        console.error(`Unable to start Browser: ${errorMsg}`);
        process_1.default.exit(1);
    });
    const browserCtx = await browserObj.createIncognitoBrowserContext();
    const xssObj = new xssScanner_1.default(browserObj, browserCtx, configObj);
    expressObj.use((reqObj, resObj, nextFunc) => {
        resObj.setTimeout(configObj.reqTimeout * 1000, () => {
            console.error(`Request for ${reqObj.originalUrl} timed out after ${configObj.reqTimeout} seconds`);
            let returnObj = {
                responseData: {
                    statusCode: 408,
                    statusMsg: 'Request Timeout',
                    errorMsg: `Request timed out after ${configObj.reqTimeout} seconds`
                },
            };
            return resObj.status(408).json(returnObj);
        });
        return nextFunc();
    });
    expressObj.get('/check', (reqObj, resObj, nextFunc) => {
        resObj.send('This route does not support GET requests.' +
            'Please refer to the <a href="https://github.com/wneessen/xssScanService/blob/master/README.md">' +
            'xssScanService documentation</a> for more details.');
    });
    expressObj.post('/check', (reqObj, resObj, nextFunc) => xssObj.processRequest(reqObj, resObj, nextFunc).catch(errorMsg => {
        console.error(`An error occured while processing the check request: ${errorMsg}`);
    }));
    expressObj.use((errObj, reqObj, resObj, nextFunc) => {
        errObj.responseData.statusCode = 400;
        errObj.responseData.statusMsg = 'Bad Request';
        errObj.responseData.errorMsg = 'Missing or invalid request parameters';
        return resObj.status(400).json(errObj);
    });
    httpServer.listen(configObj.listenPort, configObj.listenHost, () => {
        console.log(`Server accepting requests on ${configObj.listenHost}:${configObj.listenPort}`);
    });
}
function showHelp() {
    console.log(`xssScanService v${versionNum}`);
    console.log('Usage: node xssScanService.js [arguments]');
    console.log('  -b, --block <domains>\t\t\tAdd additional blocklist domain (can be used multiple times)');
    console.log('  -l, --listen <IP address or hostname>\tThe IP/hostname for the server to listen on (Default: 127.0.0.1)');
    console.log('  -p, --port <port>\t\t\tThe port for the server to listen on (Default: 8099)');
    console.log('  -t, --timeout <seconds>\t\tAmount of seconds until the request times out');
    console.log('  -c, --cache\t\t\t\tEnable caching of websites');
    console.log('  -s, --ignoresslerrors\t\t\tIgnore HTTPS errors');
    console.log('  --returnerrors\t\t\tIf set, the response object will return resource errors');
    console.log('  --perf\t\t\t\tIf set, the response object will return performance date');
    console.log('  --noheadless\t\t\t\tIf set, the browser will start in non-headless mode');
    console.log('  --browserpath <path>\t\t\tPath to browser executable (Using Firefox requires --browsertype firefox)');
    console.log('  --browsertype <firefox|chrome>\tType of browser to use (Requires --browserpath to be set)');
    console.log('  -d, --debug\t\t\t\tEnable DEBUG mode');
    console.log('  -h, --help\t\t\t\tShow this help text');
}
startServer();
