import { XMLElement, XML, XMLElementBuilder } from 'xml-js-builder'
import { request, stream, Stream, RequestOptions, Response, ContentType, ResponseCallback } from './request'

export interface Properties
{
    [name : string] : {
        attributes : {
            [name : string] : string
        }
        content : string | XMLElement[]
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

export class Connection
{
    constructor(public url : string)
    {
        if(this.url.lastIndexOf('/') !== this.url.length - 1)
            this.url += '/';
    }

    request(options : RequestOptions, callback : ResponseCallback)
    {
        options.url = this.url + options.url;
        request(options, callback);
    }
    stream(options : RequestOptions) : Stream
    {
        options.url = this.url + options.url;
        return stream(options);
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
            
            try
            {
                callback(null, JSON.parse(content.toString()));
            }
            catch(ex)
            {
                callback(ex);
            }
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

    readdir(path : string, callback : (error ?: Error, files ?: string[]) => void) : void
    {
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
                const names = XML.parse(body)
                    .find('DAV:multistatus')
                    .findMany('DAV:response')
                    .map((el) => el.find('DAV:href').findText())
                    .filter((href) => href.length > href.indexOf(path) + path.length + 1)
                    .map((href) => href.lastIndexOf('/') === href.length - 1 ? href.substr(0, href.length - 1) : href)
                    .map((href) => href.substring(href.lastIndexOf('/') + 1))
                
                callback(null, names);
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
