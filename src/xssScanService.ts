// xssScanService - A browser based XSS-scanning/detection engine
// (C) 2020 by Winni Neessen <wn@neessen.net>
import Express from 'express';
//import * as httpsObj from 'https';
import * as httpObj from 'http';
import Puppeteer from 'puppeteer';
import XssScanner from './lib/xssScanner';
import arg from 'arg';
import process from 'process';
import { IXssScanConfig, IXssObj } from './lib/xssInterfaces';

// Signal handler
process.on('SIGINT', () => {
    console.warn('\nGracefully shutting down from SIGINT (Ctrl-C)');
    process.exit(1);
});

// Initialize class objects
const expressObj = Express();
const httpServer = httpObj.createServer(expressObj);

// Some constant variables
const versionNum: string = '1.4.4';

// Express exception handlers
httpServer.on('error', errMsg => {
    console.error(`Unable to start webservice: ${errMsg}`);
    process.exit(1);
});

// Default variables
const configObj: IXssScanConfig = {
    listenHost: 'localhost',
    listenPort: 8099,
    reqTimeout: 5000,
    debugMode: false,
    perfMode: false,
    webSecEnable: false,
    returnErrors: false,
    returnWarnings: false,
    resBlockList: [
        'googletagmanager.com', 'google-analytics.com', 'optimizely.com', '.amazon-adsystem.com',
        'device-metrics-us.amazon.com', 'crashlytics.com', 'doubleclick.net'
    ],
    resErrorIgnoreCodes: [ 'net::ERR_BLOCKED_BY_CLIENT.Inspector' ],
    consoleIgnoreList: [],
    allowCache: false,
    userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36 xssScanService/${versionNum}`
};
const pupLaunchOptions: Puppeteer.LaunchOptions = {
    headless: true,
    args: [],
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
        '--help': Boolean,
        '--return-errors': Boolean,
        '--return-warnings': Boolean,
        '--ignore-ssl-errors': Boolean,
        '--block': [String],
        '--browserpath': String,
        '--browsertype': String,
        '--no-headless': Boolean,
        '--no-sandbox': Boolean,
        '--no-listen-localhost': Boolean,
        '--console-ignore-list': [Object],

        // Aliases
        '-l': '--listen',
        '-p': '--port',
        '-t': '--timeout',
        '-b': '--block',
        '-c': '--cache',
        '-d': '--debug',
        '-h': '--help',
        '-s': '--ignore-ssl-errors'
    }, { argv: process.argv.slice(2) });
}
catch(errorObj) {
    console.error(`Error: ${errorObj.message}`);
    console.log('');
    showHelp();
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
if(typeof cliArgs["--return-errors"] !== 'undefined') { configObj.returnErrors = true };
if(typeof cliArgs["--return-warnings"] !== 'undefined') { configObj.returnWarnings = true };
if(typeof cliArgs["--ignore-ssl-errors"] !== 'undefined') { pupLaunchOptions.ignoreHTTPSErrors = true };
if(typeof cliArgs["--no-headless"] !== 'undefined') { pupLaunchOptions.headless = false; };
if(typeof cliArgs["--no-sandbox"] !== 'undefined') { pupLaunchOptions.args.push('--no-sandbox'); };
if(typeof cliArgs["--no-listen-localhost"] !== 'undefined') { configObj.listenHost = null; };
if(typeof cliArgs["--browserpath"] !== 'undefined') { pupLaunchOptions.executablePath = cliArgs["--browserpath"] };
if(
    typeof cliArgs["--browsertype"] !== 'undefined' && 
    (cliArgs["--browsertype"].toLowerCase() === 'firefox' || cliArgs["--browsertype"].toLowerCase() === 'chrome')
) {
    if(typeof cliArgs["--browserpath"] === 'undefined') {
        console.error('Error: Parameter --browsertype requires a custom browser path via --browserpath');
        console.log('');
        showHelp();
        process.exit(1);
    }
    else {
        pupLaunchOptions.product = (cliArgs["--browsertype"] as Puppeteer.Product)
    }
};
if(typeof cliArgs["--console-ignore-list"] !== 'undefined') {
    (cliArgs["--console-ignore-list"] as Array<string>).forEach(ignoreEntry => {
        let ignoreArray = ignoreEntry.split('=');
        if(ignoreArray.length === 2) {
            configObj.consoleIgnoreList.push({eventType: ignoreArray[0], consoleMessage: ignoreArray[1]});
        }
    });
};

// Show help
if(typeof cliArgs["--help"] !== 'undefined') { showHelp(); process.exit(0); };

// Express webservice options
expressObj.use(Express.urlencoded({ extended: true }));
expressObj.use(Express.json());
expressObj.disable('x-powered-by');

// Initialize the webservice
async function startServer() {
    const browserObj = await Puppeteer.launch(pupLaunchOptions).catch(errorMsg => {
        console.error(`Unable to start Browser: ${errorMsg}`);
        process.exit(1);
    });
    const browserCtx = await browserObj.createIncognitoBrowserContext();
    const xssObj = new XssScanner(browserObj, browserCtx, configObj);

    // Timeout handler
    expressObj.use((reqObj: Express.Request, resObj: Express.Response, nextFunc: Express.NextFunction) => {
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

    // Routes
    expressObj.get('/check', (reqObj, resObj, nextFunc) => {
        resObj.send(
            'This route does not support GET requests.' + 
            'Please refer to the <a href="https://github.com/wneessen/xssScanService/blob/master/README.md">' +
            'xssScanService documentation</a> for more details.'
        );
    });
    expressObj.post('/check', (reqObj, resObj, nextFunc) => xssObj.processRequest(reqObj, resObj, nextFunc).catch(errorMsg => {
        console.error(`An error occured while processing the check request: ${errorMsg}`);
    }));
    expressObj.use((errObj: IXssObj, reqObj: Express.Request, resObj: Express.Response, nextFunc: Express.NextFunction) => {
        errObj.responseData.statusCode = 400;
        errObj.responseData.statusMsg = 'Bad Request';
        errObj.responseData.errorMsg = 'Missing or invalid request parameters';
        return resObj.status(400).json(errObj);
    });

    // Start server
    console.log(`xssScanService v${versionNum}`);
    if(configObj.listenHost === null) {
        httpServer.listen(configObj.listenPort, () => {
            console.log(`Server accepting requests on *:${configObj.listenPort}`);
        });
    }
    else {
        httpServer.listen(configObj.listenPort, configObj.listenHost, () => {
            console.log(`Server accepting requests on ${configObj.listenHost}:${configObj.listenPort}`);
        });
    }
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
    console.log('  --return-errors\t\t\tIf set, the response object will return resource errors');
    console.log('  --perf\t\t\t\tIf set, the response object will return performance date');
    console.log('  --no-headless\t\t\t\tIf set, the browser will start in non-headless mode');
    console.log('  --no-listen-localhost\t\t\tIf set, the webservice will not be bound to localhost');
    console.log('  --no-sandbox\t\t\t\tIf set, the browser is started in no-sandbox mode (DANGER: Only use if you are sure what you are doing)');
    console.log('  --browserpath <path>\t\t\tPath to browser executable (Using Firefox requires --browsertype firefox)');
    console.log('  --browsertype <firefox|chrome>\tType of browser to use (Requires --browserpath to be set)');
    console.log('  -d, --debug\t\t\t\tEnable DEBUG mode');
    console.log('  -h, --help\t\t\t\tShow this help text');
}

startServer();