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
var Stream = (function () {
    function Stream(stream) {
        this.stream = stream;
    }
    Stream.prototype.on = function (event, callback) {
        switch (event) {
            case 'finish':
                this.stream.on('response', callback);
                break;
            case 'end':
                this.stream.on('complete', callback);
                break;
            default:
                this.stream.on(event, callback);
                break;
        }
    };
    Stream.prototype.write = function (data, callback) {
        this.stream.write(data, callback);
    };
    Stream.prototype.end = function (data, callback) {
        this.stream.end(data, callback);
    };
    return Stream;
}());
exports.Stream = Stream;
function stream(options) {
    return new Stream(req(options));
}
exports.stream = stream;
