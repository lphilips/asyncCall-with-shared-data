var Proxy = require('harmony-proxy');
var Clock = require('./clock.js');
require('./nodeHandling.js');

/* 
 * Makes a replicated object server side.
 * Updates are broadcast to all clients, according to methodS (e.g. '__updateFromServer__').
 * Updates from a client can be integrated using the methodC function (e.g. '__updateFromClient__')
 *
 */

function makeReplicatedHandlerServer (server, methodS, methodC, clock) {
    return {
        get: function (obj, prop, value) {
            if (prop == "__clock") {
                return clock;
            }
            else if (prop == methodC) {
                // Update from client side => compare clocks
                return function () {
                    var args = Array.prototype.slice.call(arguments);
                    // args = object, prop, value, clock
                    var clockD = args[2];
                    /* concurr vector clocks */
                    if (clock.compare(clockD) === Clock.CONCURRENT) {
                        /* rollback */
                        server.rpcTo(args[3], "__rollbackClock__", obj.uid, obj, clock);
                        return false;
                    }
                    /* clock of client is less than server clock */
                    else if (clock.compare(clockD) === Clock.GT) {
                        /* ignore client update */
                        server.rpcTo(args[3], "__rollbackClock__", obj.uid, obj, clock);
                        return false;
                    }
                    /* clock of client more recent */
                    else {
                        obj[args[0]] = args[1];
                        clock = clock.merge(clockD);
                        server.rpc(methodS, obj.uid, args[0], args[1], clock);
                        return true;
                    }
                }
            } else {
                return obj[prop];
            }
        },
        set: function (obj, prop, value) {
            if (prop !== 'uid')
                clock.increment('server');
            /* default behavior */
            obj[prop] = value;
            /* Forward to replica */
            server.rpc(methodS, obj.uid, prop, value, clock);
            return true;
        }
    }
}



/* Make proxy handle for a replicated object on client side.
 *  MethodS is for example '__updateFromServer__' ,
 *  MethodC is for example'__updateFromClient__'
 */
function makeReplicatedHandlerClient (client, methodS, methodC, clock) {
    var id = client.id;
    var node = function () {};
    var fp = makeFailureProxy(client);
    node.flagPriority = false;
    node.toString = function () {return "-node"};
    node.onNetworkException = function () {
        var buffer = this.buffer,
            due = this.due;
        buffer.bufferCall(this.ctxt, due);
    };
    var leaf = function () {
        this.buffer = UniqueBuffer.getInstance();
        this.due = 60000;
    };
    leaf.parent = node;
    leaf.prototype = new HandlerNode();
    leaf.prototype.constructor = leaf;
    leaf.toString = function () {};
    var clientBuffer = fp(leaf);
    client.RPC.onConnectedExec(function () {
        UniqueBuffer.getInstance().flushBuffer();
    })
    return {
        get: function (obj, prop) {
            if (prop == "__clock") {
                return clock;
            }
            else if (prop == methodS) {
                return function () {
                    var args = Array.prototype.slice.call(arguments);
                    var clockS;
                    if (args.length == 2) {
                        clockS = args[1];
                        clock = clock.merge(clockS);
                        Object.keys(args[0]).forEach(function (key, index) {
                            obj[key] = args[0][key];
                        });
                        return true;
                    } else {
                        clockS = args[2];
                        clock = clock.merge(clockS);
                        obj[args[0]] = args[1];
                        return true;
                    }
                }
            } else {
                return obj[prop];
            }
        },
        set: function (obj, prop, value) {
            if (prop !== 'uid')
                clock.increment(id);
            obj[prop] = value;
            clientBuffer.rpc(methodC, obj.uid, prop, value, clock);
            return true;
        }
    }
}

function makeReplicatedObjectServer (server, store, methodS, methodC, object, name) {
    var clock = Clock.makeClock();
    var replica =  Proxy(object, makeReplicatedHandlerServer(server, methodS, methodC, clock));
    store.addObject(replica, name);
    server.rpc('__addObjectFromServer__', replica.uid, replica, clock);
    return replica;
}

function makeReplicatedObjectClient (client, store, methodS, methodC, object, name, clock) {
    var clockC = Clock.makeClock();
    if (clock)
        clockC = clockC.merge(clock);
    Object.keys(object).forEach(function (key, index) {
        if (object[key].uid) {
            var replicated = makeReplicatedObjectClient(client, store, methodS, methodC, object[key], object[key].uid, object[key].__clock);
            object[key] = replicated;
        }
    });
    var replica = Proxy(object, makeReplicatedHandlerClient(client, methodS, methodC, clockC));
    store.addObject(replica, name);
    return replica;
}

module.exports = {
    makeReplicatedObjectClient : makeReplicatedObjectClient,
    makeReplicatedObjectServer : makeReplicatedObjectServer
}

global.ObservableObject = {
    makeReplicatedObjectClient : makeReplicatedObjectClient,
    makeReplicatedObjectServer : makeReplicatedObjectServer
}