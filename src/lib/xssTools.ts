import Puppeteer from 'puppeteer';
import * as cryptoObj from 'crypto';

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

    /**
     * Generate a SHA checksum
     *
     * @param {string} shaAlgo The SHA algorithm to use (sha1, sha256, sha512, etc.)
     * @param {string} inputString The data as array buffer
     * @returns {string} Hex representation of the SHA checksum
     * @memberof XssTools
    */
    public shaDigest(shaAlgo: string, inputString: string): string {
        const hashObj = cryptoObj.createHash(shaAlgo);
        hashObj.update(inputString);

        return hashObj.digest('hex');
    }
}