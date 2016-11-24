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

var scores = myServer.makeObservableObject("scores", {});

function createScore (name) {
    return myServer.makeObservableObject(name, {name: name, score: 0});
}

myServer.expose({
    'incrScore' : function (name, cb) {
        console.log(scores[name]);
        scores[name].score++;
    },
    'addScore' : function (name, cb) {
       var score = createScore(name);
        scores[name] = score;
    }
});