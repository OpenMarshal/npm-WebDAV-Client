"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var xml_js_builder_1 = require("xml-js-builder");
var request_1 = require("./request");
var HTTPError = (function (_super) {
    __extends(HTTPError, _super);
    function HTTPError(res) {
        var _this = _super.call(this, 'HTTP error : ' + res.statusCode + ' - ' + res.statusMessage) || this;
        _this.statusMessage = res.statusMessage;
        _this.statusCode = res.statusCode;
        return _this;
    }
    return HTTPError;
}(Error));
exports.HTTPError = HTTPError;
var Connection = (function () {
    function Connection(url) {
        this.url = url;
        if (this.url.lastIndexOf('/') !== this.url.length - 1)
            this.url += '/';
    }
    Connection.prototype.request = function (options, callback) {
        options.url = this.url + options.url;
        request_1.request(options, callback);
    };
    Connection.prototype.stream = function (options) {
        options.url = this.url + options.url;
        return request_1.stream(options);
    };
    Connection.prototype.noBodyRequest = function (options, callback) {
        this.request(options, function (e, res, body) {
            if (e)
                return callback(e);
            if (res.statusCode >= 400)
                return callback(new HTTPError(res));
            callback();
        });
    };
    Connection.prototype.exists = function (path, callback) {
        this.request({
            url: path,
            method: 'PROPFIND',
            headers: {
                depth: '0'
            }
        }, function (e, res, body) {
            callback(e, res.statusCode <= 400);
        });
    };
    Connection.prototype.get = function (path, callback) {
        var options = {
            url: path,
            method: 'GET'
        };
        if (callback) {
            this.request(options, function (e, res, body) {
                if (e)
                    return callback(e);
                if (res.statusCode >= 400)
                    return callback(new HTTPError(res));
                callback(null, body);
            });
        }
        else {
            return this.stream(options);
        }
    };
    Connection.prototype.put = function (path, content, callback) {
        var options = {
            url: path,
            method: 'PUT'
        };
        if (callback) {
            options.body = content,
                this.request(options, function (e, res, body) {
                    if (e)
                        return callback(e);
                    if (res.statusCode >= 400)
                        return callback(new HTTPError(res));
                    callback();
                });
        }
        else {
            return this.stream(options);
        }
    };
    Connection.prototype.moveCopy = function (method, pathSource, pathDestination, _override, _callback) {
        var override = _callback ? _override : false;
        var callback = _callback ? _callback : _override;
        this.noBodyRequest({
            url: pathSource,
            method: method,
            headers: {
                destination: pathDestination,
                override: override ? 'T' : 'F'
            }
        }, callback);
    };
    Connection.prototype.move = function (pathSource, pathDestination, _override, _callback) {
        this.moveCopy('MOVE', pathSource, pathDestination, _override, _callback);
    };
    Connection.prototype.copy = function (pathSource, pathDestination, _override, _callback) {
        this.moveCopy('COPY', pathSource, pathDestination, _override, _callback);
    };
    Connection.prototype.mkdir = function (path, callback) {
        this.noBodyRequest({
            url: path,
            method: 'MKCOL'
        }, callback);
    };
    Connection.prototype.delete = function (path, callback) {
        this.noBodyRequest({
            url: path,
            method: 'DELETE'
        }, callback);
    };
    Connection.prototype.lock = function (path, callback) {
        var lockinfo = new xml_js_builder_1.XMLElementBuilder('D:lockinfo', {
            'xmlns:D': 'DAV:'
        });
        lockinfo.ele('D:lockscope').ele('D:exclusive');
        lockinfo.ele('D:locktype').ele('D:write');
        this.request({
            url: path,
            method: 'LOCK',
            body: lockinfo.toXML()
        }, function (e, res, body) {
            if (e)
                return callback(e);
            if (res.statusCode >= 400)
                return callback(new HTTPError(res));
            var xml = xml_js_builder_1.XML.parse(body);
            try {
                callback(null, {
                    uid: xml.find('DAV:prop').find('DAV:lockdiscovery').find('DAV:activelock').find('DAV:locktoken').find('DAV:href').findText()
                });
            }
            catch (ex) {
                callback(ex);
            }
        });
    };
    Connection.prototype.refreshLock = function (path, lock, callback) {
        var uid = lock.constructor === String ? lock : lock.uid;
        this.noBodyRequest({
            url: path,
            method: 'LOCK',
            headers: {
                'If': '(<' + uid + '>)'
            }
        }, callback);
    };
    Connection.prototype.unlock = function (path, lock, callback) {
        var uid = lock.constructor === String ? lock : lock.uid;
        this.noBodyRequest({
            url: path,
            method: 'UNLOCK',
            headers: {
                'Lock-Token': '<' + uid + '>'
            }
        }, callback);
    };
    Connection.prototype.readdir = function (path, callback) {
        this.request({
            url: path,
            method: 'PROPFIND',
            headers: {
                depth: '1'
            }
        }, function (e, res, body) {
            if (e)
                return callback(e);
            if (res.statusCode >= 400)
                return callback(new HTTPError(res));
            try {
                var names = xml_js_builder_1.XML.parse(body)
                    .find('DAV:multistatus')
                    .findMany('DAV:response')
                    .map(function (el) { return el.find('DAV:href').findText(); })
                    .filter(function (href) { return href.length > href.indexOf(path) + path.length + 1; })
                    .map(function (href) { return href.lastIndexOf('/') === href.length - 1 ? href.substr(0, href.length - 1) : href; })
                    .map(function (href) { return href.substring(href.lastIndexOf('/') + 1); });
                callback(null, names);
            }
            catch (ex) {
                callback(ex);
            }
        });
    };
    Connection.prototype.setProperties = function (path, properties, callback) {
        var propertyupdate = new xml_js_builder_1.XMLElementBuilder('D:propertyupdate', {
            'xmlns:D': 'DAV:'
        });
        var prop = new xml_js_builder_1.XMLElementBuilder('D:set').ele('D:prop');
        for (var name_1 in properties)
            prop.ele(name_1, properties[name_1].attributes).add(properties[name_1].content);
        this.request({
            url: path,
            method: 'PROPPATCH',
            body: propertyupdate.toXML()
        }, function (e, res, body) {
            if (e)
                return callback(e);
            if (res.statusCode >= 400)
                return callback(new HTTPError(res));
            callback();
        });
    };
    Connection.prototype.removeProperties = function (path, properties, callback) {
        var propertyupdate = new xml_js_builder_1.XMLElementBuilder('D:propertyupdate', {
            'xmlns:D': 'DAV:'
        });
        var prop = new xml_js_builder_1.XMLElementBuilder('D:remove').ele('D:prop');
        properties.forEach(function (p) { return prop.ele(p); });
        this.request({
            url: path,
            method: 'PROPPATCH',
            body: propertyupdate.toXML()
        }, function (e, res, body) {
            if (e)
                return callback(e);
            if (res.statusCode >= 400)
                return callback(new HTTPError(res));
            callback();
        });
    };
    Connection.prototype.getProperties = function (path, callback) {
        this.request({
            url: path,
            method: 'PROPFIND',
            headers: {
                depth: '0'
            }
        }, function (e, res, body) {
            if (e)
                return callback(e);
            if (res.statusCode >= 400)
                return callback(new HTTPError(res));
            try {
                var properties = xml_js_builder_1.XML.parse(body)
                    .find('DAV:multistatus')
                    .find('DAV:response')
                    .find('DAV:propstat')
                    .find('DAV:prop')
                    .elements
                    .map(function (el) {
                    return {
                        name: el.name,
                        attributes: el.attributes,
                        value: el.elements.length === 0 ? undefined : el.elements.length === 1 && el.elements[0].type === 'text' ? el.elements[0].text : el.elements
                    };
                });
                var result = {};
                for (var _i = 0, properties_1 = properties; _i < properties_1.length; _i++) {
                    var prop = properties_1[_i];
                    result[prop.name] = {
                        content: prop.value,
                        attributes: prop.attributes
                    };
                }
                callback(null, result);
            }
            catch (ex) {
                callback(ex);
            }
        });
    };
    return Connection;
}());
exports.Connection = Connection;
