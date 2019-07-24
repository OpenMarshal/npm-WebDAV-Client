# webdav-client [![npm Version](https://img.shields.io/npm/v/webdav-client.svg)](https://www.npmjs.com/package/webdav-client) [![Build Status](https://travis-ci.org/OpenMarshal/npm-WebDAV-Client.svg?branch=master)](https://travis-ci.org/OpenMarshal/npm-WebDAV-Client)

This is a WebDAV client.

It is not meant to be used on browsers yet.

## Install

```bash
npm install webdav-client
```

## Usage

```javascript
import * as webdavClient from 'webdav-client'
// or
import { Connection } from 'webdav-client'
// or
const webdavClient = require('webdav-client');

// Create the client object
const connection = new webdavClient.Connection('http://my-webdav-server:1900');

connection.get('/path/of/my/file.txt', (e, content) => {
    if(e)
        throw e;
    
    console.log(content);
})
```

## Methods

```typescript
class Connection
{
    constructor(url : string)
    constructor(options : ConnectionOptions)

    request(options : RequestOptions, callback : ResponseCallback) // Custom request
    stream(options : RequestOptions) : Stream // Custom streaming request
    
    // Might be needed before using the streaming form of the methods (put and get)
    prepareForStreaming(path : string, callback : (error : Error) => void) : void
    prepareForStreaming(callback : (error : Error) => void) : void

    readdir(path : string, callback : (error : Error, files ?: string[]) => void) : void
    readdir(path : string, options : ConnectionReaddirOptions, callback : (error : Error, files : string[] | ConnectionReaddirComplexResult[]) => void) : void

    exists(path : string, callback : (error : Error, exists : boolean) => void) : void

    mkdir(path : string, callback : (error : Error) => void) : void
    delete(path : string, callback : (error : Error) => void) : void

    get(path : string, callback : (error : Error, body : ContentType) => void) : void
    get(path : string, callback : (error : Error, body : ContentType) => void) : Stream

    put(path : string, content : ContentType, callback : (error : Error) => void) : void
    put(path : string) : Stream
    
    move(pathSource : string, pathDestination : string, override : boolean, callback : (error : Error) => void) : void
    move(pathSource : string, pathDestination : string, callback : (error : Error) => void) : void

    copy(pathSource : string, pathDestination : string, override : boolean, callback : (error : Error) => void) : void
    copy(pathSource : string, pathDestination : string, callback : (error : Error) => void) : void
    
    lock(path : string, callback : (error ?: Error, lockUID ?: Lock) => void) : void
    refreshLock(path : string, lock : string | Lock, callback : (error : Error) => void) : void
    unlock(path : string, lock : string | Lock, callback : (error : Error) => void) : void

    setProperties(path : string, properties : Properties, callback : (error : Error) => void) : void
    removeProperties(path : string, properties : string[], callback : (error : Error) => void) : void
    getProperties(path : string, callback : (error : Error, properties : Properties) => void) : void
    getProperties(path : string, options : ConnectionReaddirOptions, callback : (error : Error, properties : Properties) => void) : void
}
```

The `Connection` options :

```typescript
interface ConnectionOptions
{
    url : string
    authenticator ?: Authenticator
    username ?: string
    password ?: string
}
```

The `ConnectionReaddirOptions` interface :

```typescript
interface ConnectionReaddirOptions
{
    // true = get a ConnectionReaddirComplexResult Array as callback result
    // false (default) = get a String Array as callback result
    properties ?: boolean
    // An array of properties which will be sent with the PROPFIND request
    extraProperties: ConnectionReaddirProperty[]
}
```

The `ConnectionReaddirOptions` interface :

```typescript
interface ConnectionReaddirProperty
{
    namespace: string
    namespaceShort: string
    element: string
    // Default value. If undefined and the XML response doesn't have this element, it will not be returned
    default?: any
    // true = It will be cast to number | string | boolean
    // false (default) = it is returned as string
    nativeType?: boolean
}
```

The `ConnectionReaddirComplexResult` interface :

```typescript
interface ConnectionReaddirComplexResult
{
    creationDate : Date
    lastModified : Date
    isDirectory : boolean
    isFile : boolean
    type : 'directory' | 'file'
    size : number
    href : string
    name : string
    extraProperties: {
        [name : string] : string | number | boolean
    }
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

```typescript
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

## Web browser compatibility

This library can be used in a web browser.

You can produce the web browser library from your from with, for instance, `browserify` or you can use the "browserified" file itsef (located at `lib/browserified.js`).

Here is the usage of the `browserified.js` file :

```html
<html>
    <head>
        <!-- Load the library -->
        <script src="node_modules/webdav-client/lib/browserified.js"></script>

        <!-- Usage of the library -->
        <script>
            const connection = new webdavClient.Connection('http://my-webdav-server:1900');

            connection.get('/path/of/my/file.txt', (e, content) => {
                if(e)
                    throw e;
                
                console.log(content);
            });
        </script>
    </head>
    <body></body>
</html>
```

Keep in mind that the library uses the `request` package, which might not be the most optimized package for web browsers.
