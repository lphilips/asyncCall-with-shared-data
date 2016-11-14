'use strict';

var express = require('express'),
    app = express(),
    ServerRpc = require('../lib/rpc-server.js'),
    ClientRpc = require('../lib/rpc-client.js'),
    Store = require('../lib/store.js'),
    ObservableObject = require('../lib/ObservableObject.js'),
    AssignmentObservable = ObservableObject.AssignmentObservable,
    port = 8125,
    assert = require("assert"),
    expect = require('chai').expect;

app.use("/", express.static(__dirname + '/'));

var methods = {

};

var myServer = new ServerRpc(app, port);
var storeS = new Store();


function ObservableFooServer (x, id) {
    function Foo(x) {
        this.x = x
    }
    return ObservableObject.makeObservableObjectServer(myServer, '__updateFromServer__', storeS, new Foo(x), id);
}


myServer.onConnection(function (client) {
    Object.keys(storeS.store).forEach(function(key,index) {
        myServer.rpcTo(client.id, '__addObjectFromServer__', key, storeS.store[key]);
    });
});

var myClient = new ClientRpc('http://127.0.0.1:8125', {
    throwNativeError: true
});
var storeC = new Store();

var clientMethods =  {
        '__updateFromServer__': function (uid, prop, value, cb) {
            var obj = storeC.getObject(uid);
            if (obj)
                obj.__updateFromServer__(prop, value);
        },
        '__addObjectFromServer__': function (uid, object, cb) {
            var obj = storeC.getObject(uid);
            if (!obj) {
                var observable = ObservableObject.makeObservableObjectClient('__updateFromServer__', storeC, object, uid);
                storeC.addObject(observable, uid);
            } else {
                obj.__updateFromServer__(object);
            }
        }
};
myClient.expose(clientMethods);


function ObservableFooClient (x, id, store) {
    function Foo(x) {
        this.x = x
    }
    var o = new Foo(x);
    o.uid = id;
    return ObservableObject.makeObservableObjectClient('__updateFromServer__', store, o, id);
}


describe('test for observable object', function() {

    it('observable object - assignment server', function(done) {
        this.timeout(1500);
        var observableS = new ObservableFooServer(42, "observable");
        var observableC = new ObservableFooClient(42, "observable", storeC);
        observableS.x = 101;
        setTimeout(function() {
            expect(observableC.x).to.equal(101);
            done();
        }, 1000);
    });

    it('observable object - assignment client', function(done) {
        var observableS = new ObservableFooServer(42, "observable");
        var observableC = new ObservableFooClient(42, "observable", storeC);
        assert.throws(function () {observableC.x = 101}, AssignmentObservable);
        done();
    });

    it('observable object array - assignment server', function(done) {
        this.timeout(1500);
        var observableS =  ObservableObject.makeObservableObjectServer(myServer, '__updateFromServer__', storeS, ["foo", "bar"], "observable2");
        var observableC = new ObservableObject.makeObservableObjectClient('__updateFromServer__', storeC, ["foo", "bar"], "observable2");
        observableS[0] = "foobar";
        setTimeout(function() {
            expect(observableC[0]).to.equal("foobar");
            done();
        }, 1000);
    });

    it('observable object array - assignment client', function(done) {
        this.timeout(1500);
        var observableS =  ObservableObject.makeObservableObjectServer(myServer, '__updateFromServer__', storeS, ["foo", "bar"], "observable2");
        var observableC = new ObservableObject.makeObservableObjectClient('__updateFromServer__', storeC, ["foo", "bar"], "observable2");
        assert.throws(function () {observableC[0] = "foobar"}, AssignmentObservable);
        done();
    });


    it('observable object in array - assignment server', function(done) {
        this.timeout(1500);
        var foobar = new ObservableFooServer(22);
        var observableS = ObservableObject.makeObservableObjectServer(myServer, '__updateFromServer__', storeS, [foobar, new ObservableFooServer(3)], "observable3");
        observableS[1].x = 42;
        setTimeout(function() {
            expect(storeC.store["observable3"][1].x).to.equal(42);
            expect(storeC.store["observable3"][0].x).to.equal(22);
            done();
        }, 1000);
    });


});