import Express from 'express';
import bodyparser from 'body-parser';
import os from 'os';
import XssScanner from './lib/xssScanner';

const listenPort = 8099;
const expressObj = Express();
let conTimeout = 150000;
let numBrowsers = 0;
let maxNumBrowsers = 5;
let xssObj = new XssScanner();

expressObj.use(bodyparser.urlencoded({ extended: true }));
expressObj.use(bodyparser.json());

expressObj.get('/', (reqObj, resObj) => {
    console.log(os.hostname());
    let serverResp = {
        msg: 'Hello World!',
        hostname: os.hostname().toString()
    }
    resObj.send(serverResp);
});

expressObj.listen(listenPort);
console.log(`Server running on port: ${listenPort}`);