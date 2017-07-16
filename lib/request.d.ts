/// <reference types="node" />
import * as req from 'request';
import * as http from 'http';
export declare type ContentType = Buffer | string;
export interface RequestOptions {
    url: string;
    method: string;
    headers?: {
        [name: string]: string;
    };
    body?: ContentType;
}
export interface Response {
    statusCode: number;
    statusMessage: string;
    headers: {
        [name: string]: string | string[];
    };
}
export declare type ResponseCallback = (error: Error, response?: Response, body?: ContentType) => void;
export declare function request(options: RequestOptions, callback: ResponseCallback): void;
export interface Stream extends req.Request {
    on(event: string, listener: Function): this;
    on(event: 'request', listener: (req: http.ClientRequest) => void): this;
    on(event: 'response' | 'finish', listener: (resp: http.IncomingMessage) => void): this;
    on(event: 'data', listener: (data: Buffer | string) => void): this;
    on(event: 'error', listener: (e: Error) => void): this;
    on(event: 'complete', listener: (resp: http.IncomingMessage, body?: string | Buffer) => void): this;
    on(event: 'end', listener: () => void): this;
}
export declare function stream(options: RequestOptions): Stream;
