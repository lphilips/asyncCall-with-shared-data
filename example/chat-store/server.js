'use strict';

var express = require('express'),
    app = express(),
    ServerData = require('../../lib/data-server.js'),
    Store = require('../../lib/store.js'),
    port = 3030,
    ReplicatedObject = require('../../lib/ReplicatedObject.js'),
    Clock = require('../../lib/clock.js');

app.use('/client', express.static(__dirname + '/../../client/'));
app.use('/', express.static(__dirname + '/'));


var myServer = new ServerData(app, port);

myServer.makeReplicatedObject("msgs", []);