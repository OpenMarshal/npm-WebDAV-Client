"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var req = require("request");
function request(options, callback) {
    req(options, function (e, res, body) {
        callback(e, e ? null : {
            headers: res.headers,
            statusCode: res.statusCode,
            statusMessage: res.statusMessage
        }, body);
    });
}
exports.request = request;
//export type Stream = req.Request
function stream(options) {
    var stream = req(options);
    stream.on('response', function (resp) {
        stream.emit('finish', resp);
    });
    return stream;
}
exports.stream = stream;
