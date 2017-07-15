# webdav-client [![npm Version](https://img.shields.io/npm/v/webdav-client.svg)](https://www.npmjs.com/package/webdav-client) [![Build Status](https://travis-ci.org/OpenMarshal/npm-WebDAV-Client.svg?branch=master)](https://travis-ci.org/OpenMarshal/npm-WebDAV-Client)

This is a WebDAV client.

It is not meant to be used on browsers yet.

## Install

```bash
npm install webdav-client
```

## Usage

```javascript
const client = require('webdav-client');

// Create the client object
const connection = new client.Connection('http://my-webdav-server:1900');

connection.get('/path/of/my/file.txt', (e, content) => {
    if(e)
        throw e;
    
    console.log(content);
})
```

## Methods

```javascript
class Connection
{
    request(options : RequestOptions, callback : ResponseCallback) // Custom request
    stream(options : RequestOptions) : Stream // Custom streaming request

    readdir(path : string, callback : (error ?: Error, files ?: string[]) => void) : void
    exists(path : string, callback : (error : Error, exists : boolean) => void) : void

    mkdir(path : string, callback : (error ?: Error) => void) : void
    delete(path : string, callback : (error ?: Error) => void) : void

    get(path : string, callback : (error ?: Error, body ?: ContentType) => void) : void
    get(path : string, callback : (error ?: Error, body ?: ContentType) => void) : Stream

    put(path : string, content : ContentType, callback : (error ?: Error) => void) : void
    put(path : string) : Stream
    
    move(pathSource : string, pathDestination : string, override : boolean, callback : (error ?: Error) => void) : void
    move(pathSource : string, pathDestination : string, callback : (error ?: Error) => void) : void

    copy(pathSource : string, pathDestination : string, override : boolean, callback : (error ?: Error) => void) : void
    copy(pathSource : string, pathDestination : string, callback : (error ?: Error) => void) : void
    
    lock(path : string, callback : (error ?: Error, lockUID ?: Lock) => void) : void
    refreshLock(path : string, lock : string | Lock, callback : (error ?: Error) => void) : void
    unlock(path : string, lock : string | Lock, callback : (error ?: Error) => void) : void

    setProperties(path : string, properties : Properties, callback : (error ?: Error) => void) : void
    removeProperties(path : string, properties : string[], callback : (error ?: Error) => void) : void
    getProperties(path : string, callback : (error ?: Error, properties ?: Properties) => void) : void
}
```

## Streaming

If you want to perform a `get` or `put` in streaming mode, you can call the methods without a callback (and without the content argument for the `put`).

```javascript
const stream = connection.get('/my/file.txt');
stream.on('data', (chunk) => {
    console.log(chunk.toString());
})
stream.on('end', () => {
    console.log('Done.');
});
```

```javascript
const stream = connection.put('/my/file.txt');
stream.on('finish', () => {
    console.log('Done.');
});
otherStream.pipe(stream);
```

## Custom requests

To do custom requests, you can use the `request(...)` and `stream(...)` methods.

They take a `RequestOptions` argument.

```javascript
interface RequestOptions
{
    url : string
    method : string
    headers ?: {
        [name : string] : string
    }
    body ?: ContentType
}
```
