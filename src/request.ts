import { Readable, Writable } from 'stream'
import * as req from 'request'

export type ContentType = Buffer | string;

export interface RequestOptions
{
    url : string
    method : string
    headers ?: {
        [name : string] : string
    }
    body ?: ContentType
}

export interface Response
{
    statusCode : number
    statusMessage : string
    headers : {
        [name : string] : string | string[]
    }
}

export type ResponseCallback = (error : Error, response ?: Response, body ?: ContentType) => void;

export function request(options : RequestOptions, callback : ResponseCallback) : void
{
    req(options, (e, res, body) => {
        callback(e, e ? null : {
            headers: res.headers,
            statusCode: res.statusCode,
            statusMessage: res.statusMessage
        }, body);
    })
}

export class Stream
{
    constructor(protected stream : req.Request)
    { }

    on(event : 'error' | 'data' | 'end' | 'finish' | 'complete', callback : Function)
    {
        switch(event)
        {
            case 'finish':
                this.stream.on('response', callback as (arg) => void);
                break;
            
            case 'end':
                this.stream.on('complete', callback as () => void);
                break;
            
            default:
                this.stream.on(event, callback as () => void);
                break;
        }
    }

    write(data : ContentType, callback ?: (error : Error) => void)
    {
        this.stream.write(data as any, callback);
    }
    end(data : ContentType, callback ?: (error : Error) => void)
    {
        this.stream.end(data as any, callback);
    }
}

export function stream(options : RequestOptions) : Stream
{
    return new Stream(req(options));
}
