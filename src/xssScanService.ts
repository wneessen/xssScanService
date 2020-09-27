// xssScanService - A browser based XSS-scanning/detection engine
// (C) 2020 by Winni Neessen <wn@neessen.net>
import Express from 'express';
import * as httpsObj from 'https';
import * as httpObj from 'http';
import Puppeteer from 'puppeteer';
import XssScanner from './lib/xssScanner';
import arg from 'arg';
import process from 'process';
import { IXssScanConfig } from './lib/xssInterfaces';

// Signal handler
process.on('SIGINT', () => {
    console.warn('\nGracefully shutting down from SIGINT (Ctrl-C)');
    process.exit(1);
});

// Initialize class objects
const expressObj = Express()
const httpServer = httpObj.createServer(expressObj);

// Some constant variables
const versionNum: string = '1.0.0b';

// Express exception handlers
httpServer.on('error', (errMsg) => {
    console.error(`Unable to start webservice: ${errMsg}`);
    process.exit(1);
});

// Default blocklist

// Default variables
const configObj: IXssScanConfig = {
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

// Read command line options
let cliArgs;
try {
    cliArgs = arg({
        // CLI args
        '--listen': String,
        '--port': Number,
        '--timeout': Number,
        '--debug': Boolean,
        '--perf': Boolean,
        '--cache': Boolean,
        '--returnerrors': Boolean,
        '--block': [String],

        // Aliases
        '-l': '--listen',
        '-p': '--port',
        '-t': '--timeout',
        '-b': '--block',
        '-c': '--cache',
        '-d': '--debug'
    }, { argv: process.argv.slice(2) });
}
catch(errorObj) {
    console.error(`Error: ${errorObj.message}`);
    process.exit(1);
}

// Set options
if(typeof cliArgs["--listen"] !== 'undefined') { configObj.listenHost = cliArgs["--listen"] };
if(typeof cliArgs["--port"] !== 'undefined' && !isNaN(cliArgs["--port"]) && !(cliArgs["--port"] < 1 || cliArgs["--port"] > 65535)) { configObj.listenPort = cliArgs["--port"] };
if(typeof cliArgs["--timeout"] !== 'undefined' && !isNaN(cliArgs["--timeout"]) && !(cliArgs["--timeout"] < 0 || cliArgs["--timeout"] > 300)) { configObj.reqTimeout = cliArgs["--timeout"] };
if(typeof cliArgs["--block"] !== 'undefined') { cliArgs["--block"].forEach(blockDomain => configObj.resBlockList.push(blockDomain)); };
if(typeof cliArgs["--debug"] !== 'undefined') { configObj.debugMode = true };
if(typeof cliArgs["--perf"] !== 'undefined') { configObj.perfMode = true; };
if(typeof cliArgs["--cache"] !== 'undefined') { configObj.allowCache = true };
if(typeof cliArgs["--returnerrors"] !== 'undefined') { configObj.returnErrors = true };

// Express webservice options
expressObj.use(Express.urlencoded({ extended: true }));
expressObj.use(Express.json());

// Initialize the webservice
async function startServer() {
    const browserObj = await Puppeteer.launch({
        headless: true,
        args: [
            "--disable-gpu",
        ]
    }).catch(errorMsg => {
        console.error(`Unable to start Browser: ${errorMsg}`);
        process.exit(1);
    });
    const browserCtx = await browserObj.createIncognitoBrowserContext();
    const xssObj = new XssScanner(browserObj, browserCtx, configObj);

    // Routes
    expressObj.post('/check', (reqObj, resObj) => xssObj.processRequest(reqObj, resObj));

    // Start server
    httpServer.listen(configObj.listenPort, configObj.listenHost, () => {
        console.log(`Server accepting requests on ${configObj.listenHost}:${configObj.listenPort}`);
    });
}

startServer();