"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class XssTools {
    eventIsDialog(inputEvent) {
        return inputEvent.dismiss !== undefined;
    }
}
exports.default = XssTools;
