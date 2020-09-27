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
const versionNum = '1.0.0b';
httpServer.on('error', (errMsg) => {
    console.error(`Unable to start webservice: ${errMsg}`);
    process_1.default.exit(1);
});
const configObj = {
    listenHost: 'localhost',
    listenPort: 8099,
    reqTimeout: 3,
    debugMode: false,
    perfMode: false,
    webSecEnable: false,
    returnErrors: false,
    resBlockList: [
        'googletagmanager.com', 'google-analytics.com', 'optimizely.com', '.amazon-adsystem.com',
        'device-metrics-us.amazon.com', 'crashlytics.com', 'doubleclick.net'
    ],
    allowCache: false,
    userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36 xssScanService/${versionNum}`
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
        '--returnerrors': Boolean,
        '--block': [String],
        '-l': '--listen',
        '-p': '--port',
        '-t': '--timeout',
        '-b': '--block',
        '-c': '--cache',
        '-d': '--debug'
    }, { argv: process_1.default.argv.slice(2) });
}
catch (errorObj) {
    console.error(`Error: ${errorObj.message}`);
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
expressObj.use(express_1.default.urlencoded({ extended: true }));
expressObj.use(express_1.default.json());
async function startServer() {
    const browserObj = await puppeteer_1.default.launch({
        headless: true,
        args: [
            "--disable-gpu",
        ]
    }).catch(errorMsg => {
        console.error(`Unable to start Browser: ${errorMsg}`);
        process_1.default.exit(1);
    });
    const browserCtx = await browserObj.createIncognitoBrowserContext();
    const xssObj = new xssScanner_1.default(browserObj, browserCtx, configObj);
    expressObj.post('/check', (reqObj, resObj) => xssObj.processRequest(reqObj, resObj));
    httpServer.listen(configObj.listenPort, configObj.listenHost, () => {
        console.log(`Server accepting requests on ${configObj.listenHost}:${configObj.listenPort}`);
    });
}
startServer();
