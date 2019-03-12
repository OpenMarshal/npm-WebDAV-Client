import { XMLElement, XML, XMLElementBuilder } from 'xml-js-builder'
import { request, stream, Stream, RequestOptions, Response, ContentType, ResponseCallback } from './request'
import * as crypto from 'crypto'
import * as Path from 'path';
import * as Url from 'url';

export * from './request'

export interface Properties
{
    [name : string] : {
        attributes ?: {
            [name : string] : string
        }
        content ?: string | XMLElement[]
    }
}

export class HTTPError extends Error
{
    statusMessage : string
    statusCode : number

    constructor(res : Response)
    {
        super('HTTP error : ' + res.statusCode + ' - ' + res.statusMessage);
        
        this.statusMessage = res.statusMessage;
        this.statusCode = res.statusCode;
    }
}

export interface Lock
{
    uid : string
}

export interface AuthenticatorInformation
{
    lastResponse : Response
    request : RequestOptions
    username : string
    password : string
}

export interface Authenticator
{
    getAuthenticationHeader(info : AuthenticatorInformation) : string
    isValidResponse(response : Response) : boolean
}

export interface ConnectionReaddirComplexResult
{
    creationDate : Date
    lastModified : Date
    isDirectory : boolean
    isFile : boolean
    type : 'directory' | 'file'
    size : number
    href : string
    name : string
}
export interface ConnectionReaddirOptions
{
    properties ?: boolean
}

export class DigestAuthenticator implements Authenticator
{
    md5(value : string) : string
    {
        return crypto.createHash('md5').update(value).digest('hex');
    }

    find(info : AuthenticatorInformation, rex : RegExp, defaultValue ?: string) : string
    {
        const auth = info.lastResponse.headers['www-authenticate'] as string;
        if(!auth)
            return defaultValue;
        
        const value = rex.exec(auth);
        if(!value[1])
            return defaultValue;

        return value[1];
    }

    getRealm(info : AuthenticatorInformation) : string
    {
        return this.find(info, /[^a-zA-Z0-9-_]realm="([^"]+)"/);
    }

    getNonce(info : AuthenticatorInformation) : string
    {
        return this.find(info, /[^a-zA-Z0-9-_]nonce="([^"]+)"/);
    }

    getAuthenticationHeader(info : AuthenticatorInformation) : string
    {
        const realm = this.getRealm(info);
        const nonce = this.getNonce(info);
        let url = info.request.url;
        if(url.indexOf('://') !== -1)
        {
            url = url.substring(url.indexOf('://') + 3);
            url = url.substring(url.indexOf('/'));
        }

        if(!realm || !nonce)
            return undefined;

        const ha1 = this.md5(info.username + ':' + realm + ':' + (info.password ? info.password : ''));
        const ha2 = this.md5(info.request.method + ':' + url);
        const response = this.md5(ha1 + ':' + nonce + ':' + ha2);

        return 'Digest username="' + info.username + '",realm="' + realm + '",nonce="' + nonce + '",uri="' + url + '",response="' + response + '"';
    }

    isValidResponse(response : Response) : boolean
    {
        return response && response.headers && !!response.headers['www-authenticate'];
    }
}

export class BasicAuthenticator implements Authenticator
{
    getAuthenticationHeader(info : AuthenticatorInformation) : string
    {
        return 'Basic ' + new Buffer(info.username + ':' + (info.password ? info.password : '')).toString('base64');
    }

    isValidResponse() : boolean
    {
        return true;
    }
}

export interface ConnectionOptions
{
    url : string
    authenticator ?: Authenticator
    username ?: string
    password ?: string
}

export class Connection
{
    options : ConnectionOptions
    lastAuthValidResponse : Response

    private root : string

    constructor(url : string)
    constructor(options : ConnectionOptions)
    constructor(options : string | ConnectionOptions)
    {
        if(options.constructor === String)
            options = { url: options as string };
        this.options = options as ConnectionOptions;

        if(this.options.url.lastIndexOf('/') === this.options.url.length - 1)
            this.options.url = this.options.url.substring(0, this.options.url.length - 1);

        this.root = Url.parse(this.options.url).pathname;

        if (this.root.slice(-1)[0] !== '/') {
            this.root += '/';
        }
    }

    protected wrapRequestOptions(options : RequestOptions, lastResponse ?: Response) : RequestOptions
    {
        if(!options.headers)
            options.headers = {};
        
        if(this.options.authenticator)
        {
            if(this.options.authenticator.isValidResponse(lastResponse))
                this.lastAuthValidResponse = lastResponse;
            else 
                lastResponse = this.lastAuthValidResponse;
            
            if(this.options.authenticator.isValidResponse(lastResponse))
            {
                options.headers['authorization'] = this.options.authenticator.getAuthenticationHeader({
                    password: this.options.password,
                    username: this.options.username,
                    request: options,
                    lastResponse
                });
            }
        }

        if(options.url.indexOf(this.options.url) !== 0)
            options.url = this.options.url + options.url;
        return options;
    }
    request(options : RequestOptions, callback : ResponseCallback, lastResponse ?: Response)
    {
        request(this.wrapRequestOptions(options, lastResponse), (e, res, body) => {
            if(this.options.authenticator && this.options.authenticator.isValidResponse(res))
                this.lastAuthValidResponse = res;
            
            if(lastResponse || e || res && res.statusCode !== 401 || !this.options.authenticator)
                return callback(e, res, body);

            this.request(options, callback, res);
        });
    }
    stream(options : RequestOptions, lastResponse ?: Response) : Stream
    {
        return stream(this.wrapRequestOptions(options, lastResponse));
    }
    protected noBodyRequest(options : RequestOptions, callback : (error ?: Error) => void) : void
    {
        this.request(options, (e, res, body) => {
            if(e)
                return callback(e);
            if(res.statusCode >= 400)
                return callback(new HTTPError(res));

            callback();
        })
    }

    prepareForStreaming(path : string, callback : (error ?: Error) => void) : void
    prepareForStreaming(callback : (error ?: Error) => void) : void
    prepareForStreaming(_path : string | ((error ?: Error) => void), _callback ?: (error ?: Error) => void) : void
    {
        const path = _callback ? _path as string : '/';
        const callback = _callback ? _callback : _path as (error ?: Error) => void;

        this.request({
            url: path,
            method: 'PROPFIND'
        }, (e, res, body) => {
            if(e)
                return callback(e);
            if(res.statusCode >= 400)
                return callback(new HTTPError(res));

            if(this.options.authenticator && this.options.authenticator.isValidResponse(res))
                this.lastAuthValidResponse = res;

            callback();
        })
    }

    exists(path : string, callback : (error : Error, exists : boolean) => void) : void
    {
        this.request({
            url: path,
            method: 'PROPFIND',
            headers: {
                depth: '0'
            }
        }, (e, res, body) => {
            callback(e, res.statusCode <= 400);
        })
    }

    get(path : string, callback : (error ?: Error, body ?: ContentType) => void) : void
    get(path : string) : Stream
    get(path : string, callback ?: (error ?: Error, body ?: ContentType) => void) : Stream
    {
        const options : RequestOptions = {
            url: path,
            method: 'GET'
        };

        if(callback)
        { // Not a stream
            this.request(options, (e, res, body) => {
                if(e)
                    return callback(e);
                if(res.statusCode >= 400)
                    return callback(new HTTPError(res));

                callback(null, body);
            })
        }
        else
        { // Stream
            return this.stream(options);
        }
    }
    
    getObject<T>(path : string, callback : (error ?: Error, body ?: T) => void) : void
    {
        this.get(path, (e, content) => {
            if(e)
                return callback(e);
            
            let obj : T;
            try
            {
                obj = JSON.parse(content.toString());
            }
            catch(ex)
            {
                return callback(ex);
            }
            callback(null, obj);
        })
    }

    put(path : string, content : ContentType, callback : (error ?: Error) => void) : void
    put(path : string) : Stream
    put(path : string, content ?: ContentType, callback ?: (error ?: Error) => void) : Stream
    {
        const options : RequestOptions = {
            url: path,
            method: 'PUT'
        };

        if(callback)
        { // Not a stream
            options.body = content as ContentType,
            this.request(options, (e, res, body) => {
                if(e)
                    return callback(e);
                if(res.statusCode >= 400)
                    return callback(new HTTPError(res));

                callback();
            })
        }
        else
        { // Stream
            return this.stream(options);
        }
    }

    putObject<T>(path : string, content : T, callback : (error ?: Error) => void) : void
    {
        this.put(path, JSON.stringify(content), callback);
    }

    protected moveCopy(method : string, pathSource : string, pathDestination : string, _override : boolean | ((error ?: Error) => void), _callback ?: (error ?: Error) => void)
    {
        const override = _callback ? _override as boolean : false;
        const callback = _callback ? _callback : _override as (error ?: Error) => void;

        this.noBodyRequest({
            url: pathSource,
            method: method,
            headers: {
                destination: pathDestination,
                override: override ? 'T' : 'F'
            }
        }, callback)
    }

    move(pathSource : string, pathDestination : string, override : boolean, callback : (error ?: Error) => void) : void
    move(pathSource : string, pathDestination : string, callback : (error ?: Error) => void) : void
    move(pathSource : string, pathDestination : string, _override : boolean | ((error ?: Error) => void), _callback ?: (error ?: Error) => void) : void
    {
        this.moveCopy('MOVE', pathSource, pathDestination, _override, _callback);
    }

    copy(pathSource : string, pathDestination : string, override : boolean, callback : (error ?: Error) => void) : void
    copy(pathSource : string, pathDestination : string, callback : (error ?: Error) => void) : void
    copy(pathSource : string, pathDestination : string, _override : boolean | ((error ?: Error) => void), _callback ?: (error ?: Error) => void) : void
    {
        this.moveCopy('COPY', pathSource, pathDestination, _override, _callback);
    }

    mkdir(path : string, callback : (error ?: Error) => void) : void
    {
        this.noBodyRequest({
            url: path,
            method: 'MKCOL'
        }, callback)
    }

    delete(path : string, callback : (error ?: Error) => void) : void
    {
        this.noBodyRequest({
            url: path,
            method: 'DELETE'
        }, callback)
    }

    lock(path : string, callback : (error ?: Error, lockUID ?: Lock) => void) : void
    {
        const lockinfo = new XMLElementBuilder('D:lockinfo', {
            'xmlns:D': 'DAV:'
        });
        lockinfo.ele('D:lockscope').ele('D:exclusive');
        lockinfo.ele('D:locktype').ele('D:write');

        this.request({
            url: path,
            method: 'LOCK',
            body: lockinfo.toXML()
        }, (e, res, body) => {
            if(e)
                return callback(e);
            if(res.statusCode >= 400)
                return callback(new HTTPError(res));
            
            const xml = XML.parse(body);
            try
            {
                callback(null, {
                    uid: xml.find('DAV:prop').find('DAV:lockdiscovery').find('DAV:activelock').find('DAV:locktoken').find('DAV:href').findText()
                });
            }
            catch(ex)
            {
                callback(ex);
            }
        })
    }

    refreshLock(path : string, lock : string | Lock, callback : (error ?: Error) => void) : void
    {
        const uid = lock.constructor === String ? (lock as string) : (lock as Lock).uid;

        this.noBodyRequest({
            url: path,
            method: 'LOCK',
            headers: {
                'If': '(<' + uid + '>)'
            }
        }, callback)
    }

    unlock(path : string, lock : string | Lock, callback : (error ?: Error) => void) : void
    {
        const uid = lock.constructor === String ? (lock as string) : (lock as Lock).uid;

        this.noBodyRequest({
            url: path,
            method: 'UNLOCK',
            headers: {
                'Lock-Token': '<' + uid + '>'
            }
        }, callback)
    }

    readdir(path : string, callback : (error : Error, files ?: string[]) => void) : void
    readdir(path : string, options : ConnectionReaddirOptions, callback : (error : Error, files ?: string[] | ConnectionReaddirComplexResult[]) => void) : void
    readdir(path : string, _options : ConnectionReaddirOptions | ((error : Error, files ?: string[] | ConnectionReaddirComplexResult[]) => void), _callback ?: (error : Error, files ?: string[] | ConnectionReaddirComplexResult[]) => void) : void
    {
        const options = _callback ? _options as ConnectionReaddirOptions : {} as ConnectionReaddirOptions;
        const callback = _callback ? _callback : _options as ((error : Error, files ?: string[]) => void);
        
        if(options.properties === undefined || options.properties === null)
            options.properties = false;

        this.request({
            url: path,
            method: 'PROPFIND',
            headers: {
                depth: '1'
            }
        }, (e, res, body) => {
            if(e)
                return callback(e);
            if(res.statusCode >= 400)
                return callback(new HTTPError(res));
            
            try
            {
                  const decodedPath = decodeURIComponent(path);

                  const results = XML.parse(body)
                    .find('DAV:multistatus')
                    .findMany('DAV:response')
                    .map(el => {
                        const fullPathStart = this.root.length - 1;

                        const href = el.find('DAV:href').findText(),
                            pathname = Url.parse(href).pathname,
                            fullPath = decodeURIComponent(pathname.slice(fullPathStart)),
                            hrefWithoutTrailingSlash = (href.lastIndexOf('/') === href.length - 1 ? href.slice(0, -1) : href),
                            name = Path.basename(fullPath);

                        return { el, hrefWithoutTrailingSlash, fullPath, name };
                    })
                    .filter(({ fullPath }) => fullPath !== decodedPath && fullPath !== `${decodedPath}/`)
                    .map(({ el, hrefWithoutTrailingSlash, name }) => {
                        if(options.properties)
                        {
                            const props = el.find('DAV:propstat').find('DAV:prop');
                            const type = props.find('DAV:resourcetype').findIndex('DAV:collection') !== -1 ? 'directory' : 'file';

                            return {
                                name,

                                creationDate: props.findIndex('DAV:creationdate') !== -1 ? new Date(props.find('DAV:creationdate').findText()) : undefined,
                                lastModified: new Date(props.find('DAV:getlastmodified').findText()),
                                type: type,
                                isFile: type === 'file',
                                isDirectory: type === 'directory',
                                size: props.findIndex('DAV:getcontentlength') !== -1 ? parseInt(props.find('DAV:getcontentlength').findText()) : 0,
                                href: hrefWithoutTrailingSlash
                            } as ConnectionReaddirComplexResult;
                        }

                        return name;
                    });

                callback(null, results as any);
            }
            catch(ex)
            {
                callback(ex);
            }
        })
    }

    setProperties(path : string, properties : Properties, callback : (error ?: Error) => void) : void
    {
        const propertyupdate = new XMLElementBuilder('D:propertyupdate', {
            'xmlns:D': 'DAV:'
        });
        const prop = propertyupdate.ele('D:set').ele('D:prop');
        for(const name in properties)
            prop.ele(name, properties[name].attributes).add(properties[name].content);

        this.request({
            url: path,
            method: 'PROPPATCH',
            body: propertyupdate.toXML()
        }, (e, res, body) => {
            if(e)
                return callback(e);
            if(res.statusCode >= 400)
                return callback(new HTTPError(res));
            
            callback();
        })
    }

    removeProperties(path : string, properties : string[], callback : (error ?: Error) => void) : void
    {
        const propertyupdate = new XMLElementBuilder('D:propertyupdate', {
            'xmlns:D': 'DAV:'
        });
        const prop = propertyupdate.ele('D:remove').ele('D:prop');
        properties.forEach((p) => prop.ele(p));

        this.request({
            url: path,
            method: 'PROPPATCH',
            body: propertyupdate.toXML()
        }, (e, res, body) => {
            if(e)
                return callback(e);
            if(res.statusCode >= 400)
                return callback(new HTTPError(res));
            
            callback();
        })
    }

    getProperties(path : string, callback : (error ?: Error, properties ?: Properties) => void) : void
    {
        this.request({
            url: path,
            method: 'PROPFIND',
            headers: {
                depth: '0'
            }
        }, (e, res, body) => {
            if(e)
                return callback(e);
            if(res.statusCode >= 400)
                return callback(new HTTPError(res));
            
            try
            {
                const properties = XML.parse(body)
                    .find('DAV:multistatus')
                    .find('DAV:response')
                    .find('DAV:propstat')
                    .find('DAV:prop')
                    .elements
                    .map((el) => {
                        return {
                            name: el.name,
                            attributes: el.attributes,
                            value: el.elements.length === 0 ? undefined : el.elements.length === 1 && el.elements[0].type === 'text' ? (el.elements[0] as any).text : el.elements
                        }
                    })
                
                const result : Properties = {};
                for(const prop of properties)
                    result[prop.name] = {
                        content: prop.value,
                        attributes: prop.attributes
                    }

                callback(null, result);
            }
            catch(ex)
            {
                callback(ex);
            }
        })
    }
}
