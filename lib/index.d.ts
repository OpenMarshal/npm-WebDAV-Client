import { XMLElement } from 'xml-js-builder';
import { Stream, RequestOptions, Response, ContentType, ResponseCallback } from './request';
export interface Properties {
    [name: string]: {
        attributes: {
            [name: string]: string;
        };
        content: string | XMLElement[];
    };
}
export declare class HTTPError extends Error {
    statusMessage: string;
    statusCode: number;
    constructor(res: Response);
}
export interface Lock {
    uid: string;
}
export declare class Connection {
    url: string;
    constructor(url: string);
    request(options: RequestOptions, callback: ResponseCallback): void;
    stream(options: RequestOptions): Stream;
    protected noBodyRequest(options: RequestOptions, callback: (error?: Error) => void): void;
    exists(path: string, callback: (error: Error, exists: boolean) => void): void;
    get(path: string, callback: (error?: Error, body?: ContentType) => void): void;
    get(path: string): Stream;
    getObject<T>(path: string, callback: (error?: Error, body?: T) => void): void;
    put(path: string, content: ContentType, callback: (error?: Error) => void): void;
    put(path: string): Stream;
    putObject<T>(path: string, content: T, callback: (error?: Error) => void): void;
    protected moveCopy(method: string, pathSource: string, pathDestination: string, _override: boolean | ((error?: Error) => void), _callback?: (error?: Error) => void): void;
    move(pathSource: string, pathDestination: string, override: boolean, callback: (error?: Error) => void): void;
    move(pathSource: string, pathDestination: string, callback: (error?: Error) => void): void;
    copy(pathSource: string, pathDestination: string, override: boolean, callback: (error?: Error) => void): void;
    copy(pathSource: string, pathDestination: string, callback: (error?: Error) => void): void;
    mkdir(path: string, callback: (error?: Error) => void): void;
    delete(path: string, callback: (error?: Error) => void): void;
    lock(path: string, callback: (error?: Error, lockUID?: Lock) => void): void;
    refreshLock(path: string, lock: string | Lock, callback: (error?: Error) => void): void;
    unlock(path: string, lock: string | Lock, callback: (error?: Error) => void): void;
    readdir(path: string, callback: (error?: Error, files?: string[]) => void): void;
    setProperties(path: string, properties: Properties, callback: (error?: Error) => void): void;
    removeProperties(path: string, properties: string[], callback: (error?: Error) => void): void;
    getProperties(path: string, callback: (error?: Error, properties?: Properties) => void): void;
}
