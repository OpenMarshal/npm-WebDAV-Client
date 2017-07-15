/// <reference types="node" />
/// <reference types="request" />
import * as req from 'request';
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
export declare class Stream {
    protected stream: req.Request;
    constructor(stream: req.Request);
    on(event: 'error' | 'data' | 'end' | 'finish', callback: Function): void;
    write(data: ContentType, callback?: (error: Error) => void): void;
    end(data: ContentType, callback?: (error: Error) => void): void;
}
export declare function stream(options: RequestOptions): Stream;
