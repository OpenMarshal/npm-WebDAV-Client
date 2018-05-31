"use strict";

const client = require('../lib/index'),
      webdav = require('webdav-server').v2;

const servers = [];

const subTree = {
    'folder1': {
        'file2': webdav.ResourceType.File,
        'file2.2': webdav.ResourceType.File,
        'file2.3': webdav.ResourceType.File
    },
    'folder test é &': {
        'file1': webdav.ResourceType.File
    },
    'file1': webdav.ResourceType.File,
    'file1.2': webdav.ResourceType.File,
    'file1.3': webdav.ResourceType.File,
    'file1.5': webdav.ResourceType.File,
    'file.lock': webdav.ResourceType.File,
    'file.lock2': webdav.ResourceType.File,
    'file.move.1': webdav.ResourceType.File,
    'file.move.2': webdav.ResourceType.File,
    'file.move.3': webdav.ResourceType.File,
    'file.copy.1': webdav.ResourceType.File,
    'file.copy.2': webdav.ResourceType.File,
    'file.copy.3': webdav.ResourceType.File,
    'fileToDelete': webdav.ResourceType.File,
    'file.pipe.in': webdav.ResourceType.File,
    'file.new': webdav.ResourceType.File,
    'file1.new': webdav.ResourceType.File
};

const server = new webdav.WebDAVServer();
servers.push(server);
const ctx = server.createExternalContext();

const ANY = 15546213556767.1;
const errors = [];
let nbTests = 0;
function done(text, error)
{
    --nbTests;
    if(error)
    {
        process.exitCode = 1;
        console.error(text, '::', error);
        errors.push(error);
    }

    if(nbTests === 0)
    {
        if(errors.length === 0)
            console.log(' All tests passed!');
        else
            console.error(' ' + errors.length + ' error(s) occured!');
        servers.forEach((s) => s.stop());
    }
}
function start(text, fn)
{
    ++nbTests;
    const next = (error) => {
        done(text, error);
    };
    fn(next, (value, expected) => {
        ++nbTests;
        let failed;
        if(expected === ANY)
        {
            failed = value === undefined || value === null;
            next(failed ? 'Expected any value but got "' + value + '"' : null);
        }
        else if(Array.isArray(expected) && Array.isArray(value))
        {
            const working = expected.map((x) => x);
            for(const v of value)
            {
                let found = false;
                for(const index in working)
                    if(working[index] == v)
                    {
                        found = true;
                        working.splice(index, 1);
                        break;
                    }
                
                if(!found)
                {
                    failed = true;
                    break;
                }
            }
            
            failed = failed || working.length > 0;
            next(failed ? 'Expected  "[ ' + expected + ' ]" but got "[ ' + value + ' ]"' : null);
        }
        else
        {
            failed = expected != value;
            next(failed ? 'Expected "' + expected + '" but got "' + value + '"' : null);
        }
        return !failed;
    })
}

let connection = true ? null : new client.Connection('');

function testAuthenticators(type)
{
    start(type + ' authentication', (end, expected) => {
        const userManager = new webdav.SimpleUserManager();
        const user = userManager.addUser('toto', 'password', true);

        const privileges = new webdav.SimplePathPrivilegeManager();
        privileges.setRights(user, '/', [ 'all' ]);

        const server = new webdav.WebDAVServer({
            httpAuthentication: type === 'digest' ? new webdav.HTTPDigestAuthentication(userManager) : new webdav.HTTPBasicAuthentication(userManager),
            privilegeManager: privileges,
            port: 1900 + servers.length
        });
        servers.push(server);
        const ctx = server.createExternalContext();
        server.rootFileSystem().addSubTree(ctx, {
            'file': webdav.ResourceType.File
        }, (e) => {
            if(e)
                throw e;

            server.start((s) => {
                const connection = new client.Connection({
                    url: 'http://localhost:' + s.address().port,
                    authenticator: type === 'digest' ? new client.DigestAuthenticator() : new client.BasicAuthenticator(),
                    username: 'toto',
                    password: 'password'
                });

                start('"getProperties" on "/file" being authenticated (digest)', (end, expected) => {
                    connection.getProperties('/file', (e, props) => {
                        expected(e);
                        end();
                    })
                })
                
                const connection2 = new client.Connection({
                    url: 'http://localhost:' + s.address().port
                });

                start('"getProperties" on "/file" without being authenticated (digest)', (end, expected) => {
                    connection2.getProperties('/file', (e, props) => {
                        expected(e, ANY);
                        end();
                    })
                })

                start('"prepareForStreaming" on "/file"', (end) => {
                    connection.prepareForStreaming((e) => {
                        expected(e);

                        start('"put" as stream on "/file" while being authenticated', (end, expected) => {
                            const content = 'This is the content';
                            const wStream = connection.put('/file');
                            wStream.on('error', (e) => expected(e))
                            wStream.on('finish', () => {
                                
                                wStream.on('complete', (res) => {
                                    expected(res.statusCode, 200) // 200 - OK
                                });

                                start('"get" as stream on "/file" while being authenticated', (end, expected) => {
                                    const rStream = connection.get('/file');
                                    let data = '';

                                    rStream.on('error', (e) => expected(e))
                                    rStream.on('end', () => {
                                        expected(data, content);
                                        end()
                                    })
                                    rStream.on('data', (chunk) => {
                                        data += chunk.toString();
                                    })
                                })

                                end();
                            });
                            wStream.end(content, (e) => {
                                expected(e);
                            });
                        })

                        end();
                    })
                })

                end();
            })
        })
    })
}

server.rootFileSystem().addSubTree(ctx, subTree, (e) => {
    if(e)
        throw e;

    server.start((s) => {
        connection = new client.Connection('http://localhost:' + s.address().port);

        testAuthenticators('basic');
        testAuthenticators('digest');

        testExists();
        testGetPut();
        testReadDir();
        testReadDirQueriedPathEntryBug();
        testProperties();
        testMkDir();
        testDelete();
        testLockUnlock();
        testMoveCopy('move');
        testMoveCopy('copy');
    })
})

function testExists()
{
    start('"exists" on "/file1"', (end, expected) => {
        connection.exists('/file1', (e, exists) => {
            expected(e) && expected(exists, true);
            end();
        })
    })

    start('"exists" on undefined', (end, expected) => {
        connection.exists('/fileX', (e, exists) => {
            expected(e) && expected(exists, false);
            end();
        })
    })
}

function testGetPut()
{
    start('"putObject" on "/file1.5"', (end, expected) => {
        connection.putObject('/file1.5', {
            prop1: 'ok'
        }, (e) => {
            expected(e);

            start('"getObject" on "/file1.5" after "putObject"', (end, expected) => {
                connection.getObject('/file1.5', (e, obj) => {
                    expected(e) && expected(obj, ANY) && expected(obj.prop1, 'ok');
                    end();
                })
            })

            end();
        })
    })

    start('"get" on "/file1"', (end, expected) => {
        connection.get('/file1', (e, body) => {
            expected(e) && expected(body.toString(), '');
            end();
        })
    })

    start('"get" on undefined', (end, expected) => {
        connection.get('/fileX', (e, body) => {
            expected(e, ANY);
            end();
        })
    })
    
    start('"put" on "/file1.2"', (end, expected) => {
        const content = 'This is the content';
        connection.put('/file1.2', content, (e, body) => {
            expected(e);

            start('"get" on "/file1.2"', (end, expected) => {
                connection.get('/file1.2', (e, body) => {
                    expected(e) && expected(body.toString(), content);
                    end();
                })
            })
            
            start('"getObject" on "/file1.2" after "put" of no-JSON content', (end, expected) => {
                connection.getObject('/file1.2', (e, obj) => {
                    expected(e, ANY);
                    end();
                })
            })
            
            end();
        })
    })

    start('"put" on undefined "/file1.new"', (end, expected) => {
        const content = 'This is the content';
        connection.put('/file1.new', content, (e, body) => {
            expected(e);

            start('"get" on newly "/file1.new"', (end, expected) => {
                connection.get('/file1.new', (e, body) => {
                    expected(e) && expected(body.toString(), content);
                    end();
                })
            })
            
            end();
        })
    })

    start('"put" as stream on "/file1.3"', (end, expected) => {
        const content = 'This is the content';
        const wStream = connection.put('/file1.3');
        wStream.on('error', (e) => expected(e))
        wStream.on('finish', () => {
            
            start('"get" as stream on "/file1.3"', (end, expected) => {
                const rStream = connection.get('/file1.3');
                let data = '';

                rStream.on('error', (e) => expected(e))
                rStream.on('end', () => {
                    expected(data, content);
                    end()
                })
                rStream.on('data', (chunk) => {
                    data += chunk.toString();
                })
            })

            end();
        });
        wStream.end(content);
    })
    
    start('"put" on "/file.pipe.in"', (end, expected) => {
        const content = 'This is the content';
        connection.put('/file.pipe.in', content, (e, body) => {
            expected(e);

            start('"put" as stream on "/file.pipe.out"', (end, expected) => {
                const wStream = connection.put('/file.pipe.out');

                start('"get" as stream on "/file.pipe.in"', (end2, expected) => {
                    const rStream = connection.get('/file.pipe.in');

                    rStream.pipe(wStream);
                    rStream.on('error', (e) => expected(e))

                    wStream.on('finish', () => {
                        start('"get" on "/file.pipe.out"', (end, expected) => {
                            connection.get('/file.pipe.out', (e, body) => {
                                expected(e) && expected(body.toString(), content);
                                end();
                            })
                        })

                        end()
                        end2()
                    })
                })
            })

            end();
        })
    })
}

function testReadDirQueriedPathEntryBug() {
    start('"readdir" on "/"', (end, expected) => {
        connection.readdir('/', (e, files) => {
            expected(e) && expected(files, Object.keys(subTree));
            end();
        })
    })

    start('"readdir" on "/test folder é &"', (end, expected) => {
        connection.readdir('/folder test é &', (e, files) => {
            expected(e) && expected(files, [ 'file1' ]);
            end();
        })
    })

    // Some WebDAV implementation will return 404s if the
    // URL is not escaped, so this needs to work too.
    start('"readdir" on escaped-"/test folder é &"', (end, expected) => {
        connection.readdir('/folder%20test%20%C3%A9%20%26', (e, files) => {
            expected(e) && expected(files, [ 'file1' ]);
            end();
        })
    })
}

function testReadDir()
{
    start('"readdir" on "/folder1"', (end, expected) => {
        connection.readdir('/folder1', (e, files) => {
            expected(e) && expected(files, [ 'file2', 'file2.2', 'file2.3' ]);
            end();
        })
    })
    
    start('"readdir" on "/folder1"', (end, expected) => {
        connection.readdir('/folder1', {
            properties: true
        }, (e, files) => {
            expected(e) && expected(Array.isArray(files), true) && expected(files.length, 3);
            files.forEach((file) => {
                expected(!!file.creationDate, true);
                expected(!!file.lastModified, true);
                expected(file.isFile === true || file.isFile === false, true);
                expected(file.isDirectory === true || file.isDirectory === false, true);
                expected(!!file.type, true);
                expected(!!file.href, true);
                expected(!!file.name, true);
            });

            end();
        })
    })

    start('"readdir" on undefined', (end, expected) => {
        connection.readdir('/folderX', (e, files) => {
            expected(e, ANY);
            end();
        })
    })
    
    start('"readdir" on undefined', (end, expected) => {
        connection.readdir('/folderX', {
            properties: true
        }, (e, files) => {
            expected(e, ANY);
            end();
        })
    })

    start('"readdir" on "/file1"', (end, expected) => {
        connection.readdir('/file1', (e, files) => {
            expected(e) && expected(files, [ ]);
            end();
        })
    })
    
    start('"readdir" on "/file1"', (end, expected) => {
        connection.readdir('/file1', {
            properties: true
        }, (e, files) => {
            expected(e) && expected(files, [ ]);
            end();
        })
    })
}

function testProperties()
{
    start('"getProperties" on "/file1"', (end, expected) => {
        connection.getProperties('/file1', (e, props) => {
            expected(e);
            end();
        })
    })

    start('"getProperties" on undefined', (end, expected) => {
        connection.getProperties('/fileX', (e, props) => {
            expected(e, ANY);
            end();
        })
    })
    
    start('"removeProperties" on undefined', (end, expected) => {
        connection.removeProperties('/folderX', [ 'prop1' ], (e) => {
            expected(e, ANY);
            end();
        })
    })

    start('"setProperties" on undefined', (end, expected) => {
        connection.setProperties('/folderX', {
            'prop1': {
                content: 'value value'
            }
        }, (e) => {
            expected(e, ANY);
            end();
        })
    })
    
    start('"setProperties" on "/file1"', (end, expected) => {
        connection.setProperties('/file1', {
            'prop1': {
                content: 'value value'
            }
        }, (e) => {
            expected(e);
            
            start('"getProperties" on "/file1" after "setProperties"', (end, expected) => {
                connection.getProperties('/file1', (e, props) => {
                    expected(e) && expected(props, ANY) && expected(props['prop1'], ANY) && expected(props['prop1'].content, 'value value');
                    end();
                })
            })

            end();
        })
    })

    start('"setProperties" on "/file1.2"', (end, expected) => {
        connection.setProperties('/file1.2', {
            'prop1': {
                content: 'value value'
            }
        }, (e) => {
            expected(e);
            
            start('"removeProperties" on "/file1.2" after "setProperties"', (end, expected) => {
                connection.removeProperties('/file1.2', [ 'prop1' ], (e) => {
                    expected(e);
                    
                    start('"getProperties" on "/file1.2" after "removeProperties"', (end, expected) => {
                        connection.getProperties('/file1.2', (e, props) => {
                            expected(e) && expected(props, ANY) && expected(props['prop1']);
                            end();
                        })
                    })
                    
                    end();
                })
            })

            end();
        })
    })
}

function testMkDir()
{
    start('"mkdir" on "/folder2"', (end, expected) => {
        connection.mkdir('/folder2', (e) => {
            expected(e);
            
            start('"exists" on "/folder2" after "mkdir"', (end, expected) => {
                connection.exists('/folder2', (e, exists) => {
                    expected(e) && expected(exists, true);
                    end();
                })
            })

            end();
        })
    })

    start('"mkdir" on existing "/folder1"', (end, expected) => {
        connection.mkdir('/folder1', (e) => {
            expected(e, ANY);
            end();
        })
    })
}

function testMoveCopy(method)
{
    start('"' + method + '" on undefined "/file.undefined"', (end, expected) => {
        connection[method]('/file.undefined', '/file2.undefined', (e) => {
            expected(e, ANY);
            end();
        })
    })
    
    start('"' + method + '" from "/file.' + method + '.1" to "/file.' + method + '.1.2"', (end, expected) => {
        connection[method]('/file.' + method + '.1', '/file.' + method + '.1.2', (e) => {
            expected(e);
            
            start('"exists" on "/file.' + method + '.1" (source of ' + method + ') after "' + method + '"', (end, expected) => {
                connection.exists('/file.' + method + '.1', (e, exists) => {
                    expected(e) && expected(exists, method === 'copy');
                    end();
                })
            })

            start('"exists" on "/file.' + method + '.1.2" (destination of ' + method + ') after "' + method + '"', (end, expected) => {
                connection.exists('/file.' + method + '.1.2', (e, exists) => {
                    expected(e) && expected(exists, true);
                    end();
                })
            })

            end();
        })
    })
    
    start('"' + method + '" from "/file.' + method + '.2" to itself ("/file.' + method + '.2")', (end, expected) => {
        connection[method]('/file.' + method + '.2', '/file.' + method + '.2', (e) => {
            expected(e, ANY);
            end();
        })
    })
    
    start('"' + method + '" from "/file.' + method + '.2" to existing "/file.' + method + '.3"', (end, expected) => {
        connection[method]('/file.' + method + '.2', '/file.' + method + '.3', (e) => {
            expected(e, ANY);
            end();
        })
    })
}

function testDelete()
{
    start('"delete" on existing "/fileToDelete"', (end, expected) => {
        connection.delete('/fileToDelete', (e) => {
            expected(e);
            
            start('"exists" on "/fileToDelete" after "delete"', (end, expected) => {
                connection.exists('/fileToDelete', (e, exists) => {
                    expected(e) && expected(exists, false);
                    end();
                })
            })

            end();
        })
    })

    start('"delete" on undefined', (end, expected) => {
        connection.delete('/fileX', (e) => {
            expected(e, ANY);
            end();
        })
    })
}

function testLockUnlock()
{
    start('"lock" on undefined "/file.lock.new"', (end, expected) => {
        connection.lock('/file.lock.new', (e, lock) => {
            expected(e) && expected(lock, ANY);
            
            start('"exists" on "/file.lock.new" after "lock"', (end, expected) => {
                connection.exists('/file.lock.new', (e, exists) => {
                    expected(e) && expected(exists, true);
                    end();
                })
            })

            end();
        })
    })

    start('"lock" on "/file.lock"', (end, expected) => {
        connection.lock('/file.lock', (e, lock) => {
            expected(e) && expected(lock, ANY);
            
            start('"unlock" on "/file.lock" after a "lock"', (end, expected) => {
                connection.unlock('/file.lock', lock, (e) => {
                    expected(e);
                    end();
                })
            })
            
            end();
        })
    })
    
    start('"lock" on "/file.lock2"', (end, expected) => {
        connection.lock('/file.lock2', (e, lock) => {
            expected(e) && expected(lock, ANY);
            
            start('"unlock" on "/file.lock2" after a "lock" with the wrong lock uid', (end, expected) => {
                connection.unlock('/file.lock2', 'xxxxxxx', (e) => {
                    expected(e, ANY);
                    end();
                })
            })
            
            end();
        })
    })
    
    start('"lock" on "/file.lock3"', (end, expected) => {
        connection.lock('/file.lock3', (e, lock) => {
            expected(e) && expected(lock, ANY);
            
            start('"refreshLock" on "/file.lock3" after a "lock"', (end, expected) => {
                connection.refreshLock('/file.lock3', lock, (e) => {
                    expected(e);
                    end();
                })
            })
            
            end();
        })
    })

    start('"unlock" on unlocked "/file1.2"', (end, expected) => {
        connection.unlock('/file1.2', 'xxxxxxxxxxxx', (e) => {
            expected(e, ANY);
            end();
        })
    })

    start('"unlock" on undefined "/file.undefined"', (end, expected) => {
        connection.unlock('/file.undefined', 'xxxxxxxxxxxxxx', (e) => {
            expected(e, ANY);
            end();
        })
    })
}
