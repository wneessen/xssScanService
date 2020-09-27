import Puppeteer from 'puppeteer';

export default class XssTools {
    /**
     * Check if the provided event is a Puppeteer.Dialog event
     *
     * @param {any} inputEvent The event to be evaluated
     * @returns {boolean}
     * @memberof XssTools
    */
    public eventIsDialog(inputEvent: any): inputEvent is Puppeteer.Dialog {
        return (inputEvent as Puppeteer.Dialog).dismiss !== undefined;
    }
}