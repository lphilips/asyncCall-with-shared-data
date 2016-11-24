'use strict';

var express = require('express'),
    app = express(),
    ServerData = require('../lib/data-server.js'),
    ClientData = require('../lib/data-client.js'),
    Store = require('../lib/store.js'),
    ObservableObject = require('../lib/ObservableObject.js'),
    AssignmentObservable = ObservableObject.AssignmentObservable,
    port = 8122,
    assert = require("assert"),
    expect = require('chai').expect;

app.use("/", express.static(__dirname + '/'));

var myServer = new ServerData(app, port);

function ObservableFooServer (x, id) {
    function Foo(x) {
        this.x = x
    }
    return myServer.makeObservableObject(id, new Foo(x));
}

var createClient = function (cb) {
    var myClient = new ClientData('http://127.0.0.1:8122', {
        throwNativeError: true
    }, cb);
    return myClient;
}

var myClient = new ClientData('http://127.0.0.1:8122', {
    throwNativeError: true
}, function (newObject) {});


function ObservableFooClient (x, id) {
    function Foo(x) {
        this.x = x
    }
    var o = new Foo(x);
    o.uid = id;
    return myClient.makeObservableObject(id, o);
}


describe('test for observable object', function() {

    it('distributing object - with id', function (done) {
        this.timeout(1500);
        var id = "id";
        var observableS = myServer.makeObservableObject(id, {});
        setTimeout(function () {
            var observableC = myClient.store.getObject(id);
            expect(observableC.uid).to.equal(observableS.uid);
            done();
        }, 1000)
    });

    it('distributing object - without id', function (done) {
        this.timeout(1500);
        var observableS = myServer.makeObservableObject(false, {x: 42});
        var id = observableS.uid;
        setTimeout(function () {
            var observableC = myClient.store.getObject(id);
            expect(observableC.x).to.equal(observableS.x);
            done();
        }, 1000)
    });

    it('distributing objects - new object cb', function (done) {
        this.timeout(2500);
        createClient(function (id, value) {
            expect(id).to.equal("newobject");
            expect(value.x).to.equal(22);
            done();
        });
        myServer.makeObservableObject("newobject", {x: 22});

    });

    it('distributing objects - update cb', function (done) {
        this.timeout(2500);
        myClient.makeObservableObject("updateobject", {x:1}, function (name, key, value) {
            expect(name).to.equal("updateobject");
            expect(key).to.equal("x");
            expect(value).to.equal(42);
            done();
        });
        var os = myServer.makeObservableObject("updateobject", {x:1});
        os.x = 42;
    });

    it('observable object - assignment server', function(done) {
        this.timeout(2500);
        var observableS = new ObservableFooServer(42, "observable");
        var observableC = new ObservableFooClient(42, "observable");
        observableS.x = 101;
        setTimeout(function() {
            expect(observableC.x).to.equal(101);
            done();
        }, 2000);
    });



    it('observable object - assignment client', function(done) {
        var observableS = new ObservableFooServer(42, "observable");
        var observableC = new ObservableFooClient(42, "observable");
        assert.throws(function () {observableC.x = 101}, AssignmentObservable);
        done();
    });

    it('observable object array - assignment server', function(done) {
        this.timeout(1500);
        var observableS =  myServer.makeObservableObject("observable2", ["foo", "bar"]);
        var observableC = myClient.makeObservableObject("observable2", ["foo", "bar"]);
        observableS[0] = "foobar";
        setTimeout(function() {
            expect(observableC[0]).to.equal("foobar");
            done();
        }, 1000);
    });

    it('observable object array - assignment client', function(done) {
        this.timeout(1500);
        var observableS =  myServer.makeObservableObject("observable3", ["foo", "bar"]);
        var observableC = myClient.makeObservableObject("observable3", ["foo", "bar"]);
        assert.throws(function () {observableC[0] = "foobar"}, AssignmentObservable);
        done();
    });


    it('observable object in array - assignment server', function(done) {
        try {
            this.timeout(3500);
            var foobar = new ObservableFooServer(22);
            var observableS = myServer.makeObservableObject("observable4", [foobar, new ObservableFooServer(3)]);
            observableS[1].x = 42;
            setTimeout(function () {
                console.log(myClient.store.store["observable4"]);
                expect(myClient.store.store["observable4"][1].x).to.equal(42);
                expect(myClient.store.store["observable4"][0].x).to.equal(22);
                done();
            }, 3000);
        }
        catch (e) {
            console.log(e);
        }
    });



});