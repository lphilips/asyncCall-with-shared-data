'use strict';

var express = require('express'),
    app = express(),
    Store = require('../../lib/store.js'),
    ObservableObject = require('../../lib/ObservableObject.js'),
    ReplicatedObject = require('../../lib/ReplicatedObject.js'),
    ServerRpc = require('../../lib/rpc-server.js');

app.use('/client', express.static(__dirname + '/../../client/'));
app.use('/', express.static(__dirname + '/'));


var myServer = new ServerRpc(app);
var store = new Store();


function ObservableFoo (x, id) {
    function Foo(x) {
        this.x = x
    }
    return ObservableObject.makeObservableObjectServer(myServer, '__updateFromServer__', store, new Foo(x), id);
}

var observable = new ObservableFoo(42, "observable");
observable.x = 101;
var observable2 = ObservableObject.makeObservableObjectServer(myServer, '__updateFromServer__', store, ["foo", "bar"], "observable2");
var foobar = new ObservableFoo(1);
var observable3 = ObservableObject.makeObservableObjectServer(myServer, '__updateFromServer__', store, [foobar, new ObservableFoo(3)], "observable3");
observable3[1].x = 42;

myServer.onConnection(function (client) {
    Object.keys(store.store).forEach(function(key,index) {
        myServer.rpcTo(client.id, '__addObjectFromServer__', key, store.store[key]);
  });
});