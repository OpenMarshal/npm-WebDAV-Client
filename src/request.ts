import { Readable, Writable } from 'stream'
import * as req from 'request'
import * as http from 'http'

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

export interface Stream extends req.Request
{
    on(event: string, listener: Function): this;
    on(event: 'request', listener: (req: http.ClientRequest) => void): this;
    on(event: 'response' | 'finish', listener: (resp: http.IncomingMessage) => void): this;
    on(event: 'data', listener: (data: Buffer | string) => void): this;
    on(event: 'error', listener: (e: Error) => void): this;
    on(event: 'complete', listener: (resp: http.IncomingMessage, body?: string | Buffer) => void): this;
    on(event: 'end', listener: () => void): this;
}

//export type Stream = req.Request

export function stream(options : RequestOptions) : Stream
{
    const stream = req(options);
    stream.on('response', (resp) => {
        stream.emit('finish', resp);
    })
    
    return stream;
}
