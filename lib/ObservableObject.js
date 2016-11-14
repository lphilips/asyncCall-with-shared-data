var Proxy = require('harmony-proxy');

function AssignmentObservable(message) {
    this.name = 'AssignmentObservable';
    this.message = message || 'Assignment on observable object';
    this.stack = (new Error()).stack;
}

AssignmentObservable.prototype = Object.create(Error.prototype);
AssignmentObservable.prototype.constructor = AssignmentObservable;


function makeObservableHandlerServer (server, method) {
    return {
        set: function (obj, prop, value) {
            /* Forward to replica */
            server.rpc(method, obj.uid, prop, value);
            /* default behavior */
            obj[prop] = value;
            return true;
        }
    }
}

/* Make proxy handle for observable object on client side.
   Method is for example '__updateFromServer__' . */
function makeObservableHandlerClient (method, name) {
    return {
        get: function (obj, prop) {
            if (prop == 'uid') {
                return name;
            }
            else if (prop == method) {
                return function () {
                    var args = Array.prototype.slice.call(arguments);
                    if (args.length == 1) {
                        Object.keys(args[0]).forEach(function (key, index) {
                            obj[key] = args[0][key];
                        });
                        return true;
                    } else {
                        obj[args[0]] = args[1];
                        return true;
                    }
                }
            } else {
                return obj[prop];
            }
        },
        set: function (obj, prop, value) {
            throw new AssignmentObservable('Assignment on observable object: ' + obj);
        }
    }
}

function makeObservableObjectServer (server, method, store, object, name) {
    var observable = new Proxy(object, makeObservableHandlerServer(server, method));
    store.addObject(observable, name);
    server.rpc('__addObjectFromServer__', observable.uid, observable);
    return observable;
}

function makeObservableObjectClient (method, store,  object, name) {
    Object.keys(object).forEach(function (key, index) {
       if (object[key].uid) {
           var observable = new Proxy(object[key], makeObservableHandlerClient(method, object[key].uid));
           object[key] = observable;
       }
    });
    var observable = new Proxy(object, makeObservableHandlerClient(method, name));
    store.addObject(observable, name);
    return observable;
}

module.exports = {
    makeObservableObjectClient : makeObservableObjectClient,
    makeObservableObjectServer : makeObservableObjectServer,
    AssignmentObservable       : AssignmentObservable
}

global.ObservableObject = {
    makeObservableObjectClient : makeObservableObjectClient,
    makeObservableObjectServer : makeObservableObjectServer,
    AssignmentObservable       : AssignmentObservable
}