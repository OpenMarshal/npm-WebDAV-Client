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
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
var xml_js_builder_1 = require("xml-js-builder");
var request_1 = require("./request");
var crypto = require("crypto");
var Path = require("path");
var Url = require("url");
__export(require("./request"));
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
var DigestAuthenticator = (function () {
    function DigestAuthenticator() {
    }
    DigestAuthenticator.prototype.md5 = function (value) {
        return crypto.createHash('md5').update(value).digest('hex');
    };
    DigestAuthenticator.prototype.find = function (info, rex, defaultValue) {
        var auth = info.lastResponse.headers['www-authenticate'];
        if (!auth)
            return defaultValue;
        var value = rex.exec(auth);
        if (!value[1])
            return defaultValue;
        return value[1];
    };
    DigestAuthenticator.prototype.getRealm = function (info) {
        return this.find(info, /[^a-zA-Z0-9-_]realm="([^"]+)"/);
    };
    DigestAuthenticator.prototype.getNonce = function (info) {
        return this.find(info, /[^a-zA-Z0-9-_]nonce="([^"]+)"/);
    };
    DigestAuthenticator.prototype.getAuthenticationHeader = function (info) {
        var realm = this.getRealm(info);
        var nonce = this.getNonce(info);
        var url = info.request.url;
        if (url.indexOf('://') !== -1) {
            url = url.substring(url.indexOf('://') + 3);
            url = url.substring(url.indexOf('/'));
        }
        if (!realm || !nonce)
            return undefined;
        var ha1 = this.md5(info.username + ':' + realm + ':' + (info.password ? info.password : ''));
        var ha2 = this.md5(info.request.method + ':' + url);
        var response = this.md5(ha1 + ':' + nonce + ':' + ha2);
        return 'Digest username="' + info.username + '",realm="' + realm + '",nonce="' + nonce + '",uri="' + url + '",response="' + response + '"';
    };
    DigestAuthenticator.prototype.isValidResponse = function (response) {
        return response && response.headers && !!response.headers['www-authenticate'];
    };
    return DigestAuthenticator;
}());
exports.DigestAuthenticator = DigestAuthenticator;
var BasicAuthenticator = (function () {
    function BasicAuthenticator() {
    }
    BasicAuthenticator.prototype.getAuthenticationHeader = function (info) {
        return 'Basic ' + new Buffer(info.username + ':' + (info.password ? info.password : '')).toString('base64');
    };
    BasicAuthenticator.prototype.isValidResponse = function () {
        return true;
    };
    return BasicAuthenticator;
}());
exports.BasicAuthenticator = BasicAuthenticator;
var Connection = (function () {
    function Connection(options) {
        if (options.constructor === String)
            options = { url: options };
        this.options = options;
        if (this.options.url.lastIndexOf('/') === this.options.url.length - 1)
            this.options.url = this.options.url.substring(0, this.options.url.length - 1);
        this.root = Url.parse(this.options.url).pathname;
        if (this.root.slice(-1)[0] !== '/') {
            this.root += '/';
        }
    }
    Connection.prototype.wrapRequestOptions = function (options, lastResponse) {
        if (!options.headers)
            options.headers = {};
        if (this.options.authenticator) {
            if (this.options.authenticator.isValidResponse(lastResponse))
                this.lastAuthValidResponse = lastResponse;
            else
                lastResponse = this.lastAuthValidResponse;
            if (this.options.authenticator.isValidResponse(lastResponse)) {
                options.headers['authorization'] = this.options.authenticator.getAuthenticationHeader({
                    password: this.options.password,
                    username: this.options.username,
                    request: options,
                    lastResponse: lastResponse
                });
            }
        }
        if (options.url.indexOf(this.options.url) !== 0)
            options.url = this.options.url + options.url;
        return options;
    };
    Connection.prototype.request = function (options, callback, lastResponse) {
        var _this = this;
        request_1.request(this.wrapRequestOptions(options, lastResponse), function (e, res, body) {
            if (_this.options.authenticator && _this.options.authenticator.isValidResponse(res))
                _this.lastAuthValidResponse = res;
            if (lastResponse || e || res && res.statusCode !== 401 || !_this.options.authenticator)
                return callback(e, res, body);
            _this.request(options, callback, res);
        });
    };
    Connection.prototype.stream = function (options, lastResponse) {
        return request_1.stream(this.wrapRequestOptions(options, lastResponse));
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
    Connection.prototype.prepareForStreaming = function (_path, _callback) {
        var _this = this;
        var path = _callback ? _path : '/';
        var callback = _callback ? _callback : _path;
        this.request({
            url: path,
            method: 'PROPFIND'
        }, function (e, res, body) {
            if (e)
                return callback(e);
            if (res.statusCode >= 400)
                return callback(new HTTPError(res));
            if (_this.options.authenticator && _this.options.authenticator.isValidResponse(res))
                _this.lastAuthValidResponse = res;
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
    Connection.prototype.getObject = function (path, callback) {
        this.get(path, function (e, content) {
            if (e)
                return callback(e);
            var obj;
            try {
                obj = JSON.parse(content.toString());
            }
            catch (ex) {
                return callback(ex);
            }
            callback(null, obj);
        });
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
    Connection.prototype.putObject = function (path, content, callback) {
        this.put(path, JSON.stringify(content), callback);
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
    Connection.prototype.readdir = function (path, _options, _callback) {
        var _this = this;
        var options = _callback ? _options : {};
        var callback = _callback ? _callback : _options;
        if (options.properties === undefined || options.properties === null)
            options.properties = false;
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
                var decodedPath_1 = decodeURIComponent(path);
                var results = xml_js_builder_1.XML.parse(body)
                    .find('DAV:multistatus')
                    .findMany('DAV:response')
                    .map(function (el) {
                    var fullPathStart = _this.root.length - 1;
                    var href = el.find('DAV:href').findText(), pathname = Url.parse(href).pathname, fullPath = decodeURIComponent(pathname.slice(fullPathStart)), hrefWithoutTrailingSlash = (href.lastIndexOf('/') === href.length - 1 ? href.slice(0, -1) : href), name = Path.basename(fullPath);
                    return { el: el, hrefWithoutTrailingSlash: hrefWithoutTrailingSlash, fullPath: fullPath, name: name };
                })
                    .filter(function (_a) {
                    var fullPath = _a.fullPath;
                    return fullPath !== decodedPath_1 && fullPath !== decodedPath_1 + "/";
                })
                    .map(function (_a) {
                    var el = _a.el, hrefWithoutTrailingSlash = _a.hrefWithoutTrailingSlash, name = _a.name;
                    if (options.properties) {
                        var props = el.find('DAV:propstat').find('DAV:prop');
                        var type = props.find('DAV:resourcetype').findIndex('DAV:collection') !== -1 ? 'directory' : 'file';
                        return {
                            name: name,
                            creationDate: new Date(props.find('DAV:creationdate').findText()),
                            lastModified: new Date(props.find('DAV:getlastmodified').findText()),
                            type: type,
                            isFile: type === 'file',
                            isDirectory: type === 'directory',
                            size: props.findIndex('DAV:getcontentlength') !== -1 ? parseInt(props.find('DAV:getcontentlength').findText()) : 0,
                            href: hrefWithoutTrailingSlash
                        };
                    }
                    return name;
                });
                callback(null, results);
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
        var prop = propertyupdate.ele('D:set').ele('D:prop');
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
        var prop = propertyupdate.ele('D:remove').ele('D:prop');
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
