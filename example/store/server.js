'use strict';

var express = require('express'),
    app = express(),
    ServerRpc = require('../../lib/rpc-server.js'),
    Store = require('../../lib/store.js');

app.use('/client', express.static(__dirname + '/../../client/'));
app.use('/', express.static(__dirname + '/'));


var myServer = new ServerRpc(app);
var store = new Store();
store.connectServer(myServer);

var messages = [];
store.set('messages', ['Welcome!']);

//Exposed interface.
myServer.expose({
    'updateStore' : function (key, value, callback) {
        store.set(key, value, false);
    },
    'retrieveStore' : function (key, val, cb) {
        var id = this.id;
        store.loop(function (key, value) {
            myServer.rpcTo(id, 'updateStore', key, value)
        });
        return cb(null, store.data);
    }
});

myServer.onConnection(function (client) {
    store.loop(function (key, value) {
            myServer.rpcTo(client.id, 'updateStore', key, value)
    });
})