![Docker Image CI](https://github.com/wneessen/xssScanService/workflows/Docker%20Image%20CI/badge.svg) ![SL Scan](https://github.com/wneessen/xssScanService/workflows/SL%20Scan/badge.svg) ![CodeQL](https://github.com/wneessen/xssScanService/workflows/CodeQL/badge.svg)
# xssScanService
This is the 2nd generation of the [xssCheckServer](https://github.com/wneessen/xssCheckServer). While xssCheckServer is based on the deprecated PhantomJS processor, xssScanService is NodeJS based and makes use of [ExpressJS](https://expressjs.com/) and Google's [Puppeteer Framework](https://pptr.dev/). The syntax and output of xssScanService is mostly compatible to xssCheckServer.

xssScanService is a webservice that takes URLs and querystring, so that it download and evaluate the returned webpage and searche for typical XSS-events like ```alert()```, ```prompt()```, ```console.log()``` or ```confirm()```. If such event occurs on the given website, the message that is triggered by the event will be compared to a provided search string and marked as "possible XSS", in case it matches.

Different to typical XSS tools, the aim of this tool is to find XSS vulnerabilities in dynamic code of webpages (JavaScript, Images, external resources). Usual XSS tools submit their XSS-identification strings via the query parameters and check the resulting HTML for the same string. As the xssScanService uses Google Puppeteer, it is able to evaluate the result of the webpage in a "real" (even though headless) browser environment, including the evaluation of the DOM, JavaScript resources, images and 3rd party scripts. This makes it useful to find cases, in which your website is perfectly secure, but because you are loading a vulnerable 3rd party script, your page becomes vulnerable as well.

## Requirements
This service requires some NodeJS and some modules to work:
- [NodeJS](https://nodejs.org/en/)
- [ExpressJS](https://expressjs.com/)
- [Google Puppeteer](https://pptr.dev/)
- [Arg](https://www.npmjs.com/package/arg)

The modules should be automagically be installed by running: ```npm install```

## Features
- TypeScripted source for ease of extension
- Uses a headless browser, based on Google's Puppeteer framework

## Usage
Simply run the script via NodeJS:
```sh
$ node dist/xssScanService.js
```

Once started, the server will (by default) listen on http://localhost:8099 and will look for POST requests on the /check route.

The server will now fetch and evaluate the website. On any alert(), console.log(), prompt() or confirm() event, the server will compare the received message against the ```searchfor``` parameter.

## Installation

### Local installation via NPM
Simply download the sources via:
```sh
$ git clone git@github.com:wneessen/xssScanService.git
```
After successful cloning, switch to the newly created directory and run:
```sh
$ npm install
```
After the installation completed you are ready to run

### Docker image
There is a [Docker image](https://hub.docker.com/r/wneessen/xss-scan-service) for xssScanService available on DockerHub.

To run the Docker image simply issue the following command:
```sh
$ sudo docker pull wneessen/xss-scan-service:latest
```
Because of the security settings in docker, we need to run it with a specific seccomp-profile, otherwise Chrome will not be able to run. Therefore you need to download the profile file first:
  ```sh
  $ curl -LO https://raw.githubusercontent.com/wneessen/xssScanService/master/xssScanService-seccomp.json
  ```
Once the download finished, you can start the service by running:
```sh
$ docker run --security-opt seccomp=xssScanService-seccomp.json -p 8099:8099 wneessen/xss-scan-service:latest
```

## API
### Supported POST parameters
The following POST request parameters are supported:

- ```url```: The base URL to be checked by the webservice
- ```querystring```: The query string to be used for the XSS attack (When using special characters, make sure to URLencode them first)
- ```reqmethod```: The request method to be used (currently "GET" and "POST" are supported)
- ```searchfor```: The string that the service compares, when an event fires (Default: 'XSSed!')
- ```everyevent```: When this parameters is set to "true", the service will report any event that triggered without comparing the searchstring

### Example request (via cURL)
To have a website checked, you can issue the URL and the searchfor-parameter via your favourite web client:
```sh
$ curl -qsS -k -d url='https://www.example.com' --data-urlencode querystring='badparam=/test\"};alert(1234);/*' -d searchfor=1234 -d reqmethod=GET http://localhost:8099/check
```

### Example responses
The server will respond with a JSON object. On a successfull identification of a potential XSS, the response can look like this:
```json
{
  "hasXss": true,
  "xssData": [
    {
      "eventType": "alert()",
      "eventMsg": "1234"
    },
    {
      "eventType": "console.log()",
      "eventMsg": "1234"
    },
    {
      "eventType": "prompt()",
      "eventMsg": "1234"
    },
  ],
  "blockedUrls": [
    "https://cdn.optimizely.com/js/123456789.js",
    "https://www.googletagmanager.com/gtm.js?id=GTM-123456",
    "https://www.google-analytics.com/analytics.js"
  ],
  "checkTime": "2020-09-16T07:56:17.166Z",
  "responseData": {
    "requestTime": 390,
    "statusMsg": "success",
    "statusCode": 200
  },
  "requestData": {
    "alertOnAnyEvent": false,
    "checkUrl": "https://www.example.com",
    "queryString": "badparam=/test\\\"};alert(1234);/*",
    "reqMethod": "POST",
    "searchString": "1234"
  },
  "checkTime": "2020-09-16T07:37:26.627Z",
  "resourceErrors": [],
  "consoleWarnings": []
}
```

In case the page seems clean, the response can look like this:
```json
{
  "blockedUrls": [
    "https://cdn.optimizely.com/js/123456789.js",
    "https://www.googletagmanager.com/gtm.js?id=GTM-123456",
    "https://www.google-analytics.com/analytics.js"
  ],
  "checkTime": "2020-09-16T07:56:17.166Z",
  "responseData": {
    "requestTime": 390.0124124,
    "statusMsg": "success",
    "statusCode": 200
  },
  "requestData": {
    "alertOnAnyEvent": false,
    "checkUrl": "https://www.example.com",
    "queryString": "badparam=/test\\\"};alert(1234);/*",
    "reqMethod": "GET",
    "searchString": "1234"
  },
  "performanceData": {
    "totalDurTime": 191.53500001993962,
    "dnsTime": 0,
    "connectTime": 0,
    "ttfbTime": 30.86500000790693,
    "downloadTime": 1.3049999834038317,
    "domIntTime": 156.55000001424924,
    "domContentTime": 0,
    "domCompleteTime": 0.0850000069476664
  },
  "hasXss": false,
  "xssData": [],
  "resourceErrors": []
}
```

### Response JSON parameters
- ```blockedUrls (Array<string>)```: Returns an array of resources that were blocked because the domains are in the blocklist
- ```checkTime (Date)```: Returns the timestamp of when the check was executed
- ```hasXss (boolean)```: Returns ```true``` if a possible XSS was found
- ```requestData (RequestData)```: Returns a ```RequestData``` object.
- ```responeData (ResponeData)```: Returns a ```ResponeData``` object.
- ```resourceErrors (Array<ResourceError>)```: Returns an array of ```ResourceError``` objects for each resource that could not be loaded.
- ```consoleWarnings (Array<ConsoleWarning>)```: Returns an array of ```ConsoleWarning``` objects for each resource that could not be loaded.
- ```performanceData (PerformanceData)```: Returns a ```PerformanceData``` object.
- ```xssData (Array<EventData>)```: Returns an array of ```EventData``` objects for any event that fired.

### Response JSON sub-objects
- ```EventData (object)```: Returns an object that consists of:
  -  ```eventType (string)```: The event type that was triggered (alert(), console.log(), etc.)
  -  ```eventMsg (string)```: The message that was triggered by the event
- ```RequestData (object)```: Returns an object that consists of the following objects:
  - ```alertOnAnyEvent (boolean)```: Returns ```true``` when the ```everyevent``` POST parameter was set in the request
  - ```checkUrl (string)```: Returns the provided URL
  - ```queryString (string)```: Returns the provided query string
  - ```reqMethod (string)```: Returns the provided request method
  - ```searchString (string)```: Returns the used searchfor-string for reference
- ```ResponeData (object)```: Returns an object that consists of the following objects:
  - ```requestTime (number)```: Returns the time in ms that the request took to complete
  - ```statusMsg (string)```: Returns status message of the webpage() call ("fail" or "success")
  - ```statusCode (number)```: Returns the HTTP status code
  - ```errorMsg (string)```: Returns an error message when a request failed (if a reason is available)
- ```ResourceError (object)```: Returns an object that consists of the following objects:
  - ```errorCode (string)```: Returns an [error code](https://pptr.dev/#?product=Puppeteer&version=v5.3.1&show=api-httprequestaborterrorcode)
  - ```statusCode (number)```: Returns the HTTP status code
  - ```statusText (string)```: Returns the HTTP status text
  - ```url (string)```: Returns the URL that caused the error
- ```ConsoleWarning (object)```: Returns an object that consists of the following objects:
  - ```warnText (string)```: Returns the text of the console warning
  - ```url (string)```: Returns the URL that caused the warning
  - ```line (number)```: Returns the line number on where the warning was triggered
- ```PerformanceData (object)```: Returns an object that consists of the following objects:
  - ```totalDurTime (number)```: Returns the time in ms for loading/evaluating the complete website
  - ```dnsTime (number)```: Returns the time in ms for the DNS lookup
  - ```connectTime (number)```: Returns the time in ms for the web request connection
  - ```ttfbTime (number)```: Returns the time in ms until it took to reach the first byte served
  - ```downloadTime (number)```: Returns the time in ms it took to download the document
  - ```domIntTime (number)```: Returns the time in ms it took to fire the DOM interactive event
  - ```domContentTime (number)```: Returns the time in ms it took to fire the DOM ContentLoaded event
  - ```domCompleteTime (number)```: Returns the time in ms it took to fire the DOM Complete event

## CLI Options
The server provides the following CLI parameters to override defaults

- ```-b, --block <domains>```: Add additional blocklist domain (can be used multiple times)
- ```-l, --listen <IP address or hostname>```: The IP/hostname for the server to listen on (Default: 127.0.0.1)
- ```-p, --port <Port>```: The port for the server to listen on (Default: 8099)
- ```-t, --timeout <timeout in seconds>```: Amount of seconds until the webservice times out
- ```-c, --cache```: Enable caching of websites
- ```-s, --ignore-ssl-errors```: Ignore HTTPS errors
- ```-d, --debug```: Enable DEBUG mode (more logging)
- ```--return-errors```: If set, the response object will return resource errors
- ```--perf```: If set, the response object will return performance data
- ```--no-headless```: If set, the browser will start in non-headless mode
- ```--no-listen-localhost```: If set, the webservice is not bound to localhost
- ```--no-sandbox```: If set, the browser is started in no-sandbox mode (**DANGEROUS**: Only use if you are sure what you are doing)
- ```--browserpath <path to browser executabel>```: Run Puppeteer with a different browser (Chrome/Firefox supported)
- ```--browsertype <chrome|firefox>```: Run Puppeteer with a different browser type (Requires: --browserpath to be set)


## Startup script
The service comes with a startup script in the ```./bin```-directory called ```startProdServer.sh```
The script looks for a local config file ```./bin/prodServer.local.conf``` which can be used to override the default parameters of the script.

The following parameters can be overwritten:
```sh
LISTENHOST=10.1.2.3
LISTENPORT=1234
BLOCKLIST="domain1.com domain2.com"
SHOWPERFORMANCE=true
SHOWERROS=true
SHOWWARNINGS=true
ENABLECACHING=true
BROWSERPATH=/path/to/chrome
BROWSERTYPE=chrome
```

To start the service you run: ```./bin/startProdServer.sh start```

To stop the service you run: ```./bin/startProdServer.sh stop```

## Systemd
In the ```./systemd```-directory you find an example service-file to use for your systemd to use. Please adjust the path accordingly.A

Copy the file to your systemd-services-directory and run ```sudo systemctl daemon-reload``` to update your systemd-services

To enable the service run: ```systemctl enable xss-scan-service```
To start the service run: ```systemctl start xss-scan-service```


## License
[MIT](./LICENSE)
