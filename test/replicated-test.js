'use strict';

var express = require('express'),
    app = express(),
    ServerData = require('../lib/data-server.js'),
    ClientData = require('../lib/data-client.js'),
    Store = require('../lib/store.js'),
    ReplicatedObject = require('../lib/ReplicatedObject.js'),
    port = 8121,
    assert = require("assert"),
    expect = require('chai').expect,
    Clock = require('../lib/clock.js');

app.use("/", express.static(__dirname + '/'));


var myServer = new ServerData(app, port);


var createClient = function (cb) {
    var myClient = new ClientData('http://127.0.0.1:8121', {
        throwNativeError: true
    },cb);
   return myClient;
}

var myClient = createClient(function (name, key, value) {});
var storeC = myClient.store;


function ReplicatedFooServer (x, id) {
    function Foo(x) {
        this.x = x
    }
    return  myServer.makeReplicatedObject( id, new Foo(x));
}

describe('test for replicated object', function() {

    it('distributing object - with id', function (done) {
       this.timeout(1500);
        var id = "id";
        var replicatedS = myServer.makeReplicatedObject(id, {});
        setTimeout(function () {
            var replicatedC = storeC.getObject(id);
            expect(replicatedC.uid).to.equal(replicatedS.uid);
            done();
        }, 1000)
    });

    it('distributing object - without id', function (done) {
        this.timeout(1500);
        var replicatedS = myServer.makeReplicatedObject(false, {x: 42});
        var id = replicatedS.uid;
        setTimeout(function () {
            var replicatedC = storeC.getObject(id);
            expect(replicatedC.x).to.equal(replicatedS.x);
            done();
        }, 1000)
    });

    it('distributing objects - new object cb', function (done) {
        this.timeout(2500);
        var client = createClient(function (id, value) {
            expect(id).to.equal("newobject");
            expect(value.x).to.equal(22);
            client.simulateDisconnect();
            done();
        });
        myServer.makeReplicatedObject("newobject", {x: 22});

    });

    it('distributing objects - update cb', function (done) {
        this.timeout(3500);
        myClient.makeReplicatedObject("updateobject", {x:1}, function (name, key, value) {
            expect(name).to.equal("updateobject");
            expect(key).to.equal("x");
            expect(value).to.equal(42);
            done();
        });
        var os = myServer.makeReplicatedObject("updateobject", {x:1});
        os.x = 42;
    });

    it('replicated object - assignment server', function(done) {
        this.timeout(1500);
        var replicatedS = myServer.makeReplicatedObject("replica1", {x:1});
        replicatedS.x = 101;
        setTimeout(function() {
            var replicatedC = storeC.store["replica1"];
            expect(replicatedC.x).to.equal(101);
            done();
        }, 1000);
    });

    it('replicated object - assignment client', function(done) {
        this.timeout(3500);
        var replicatedS = myServer.makeReplicatedObject("replica2", {x:1});
        setTimeout(function() {
            var replicatedC = storeC.store["replica2"];
            replicatedC.x = 101;
            setTimeout(function () {
                expect(replicatedS.x).to.equal(101);
                done();
            }, 2000);
        }, 1000);
    });

    it('replicated object - assignment client', function(done) {
        this.timeout(3500);
        var replicatedS = myServer.makeReplicatedObject("replica3", {x:1});
        setTimeout(function() {
            var replicatedC = storeC.store["replica3"];
            replicatedC.x = 101;
            setTimeout(function () {
                expect(replicatedS.x).to.equal(101);
                done();
            }, 2000);
        }, 1000);
    });


    it('replicated object - assignment and new client', function (done) {
        this.timeout(3500);
        var replicatedS = myServer.makeReplicatedObject("replica4", {x:1});
        setTimeout(function() {
            var replicatedC = storeC.store["replica4"];
            replicatedC.x = 101;
            var client2 = createClient(function (name, key, value) {});
            setTimeout(function () {
                var replicaC2 = client2.store.getObject("replica4");
                expect(replicaC2.x).to.equal(101);
                expect(replicatedC.__clock.compare(replicatedS.__clock)).to.equal(Clock.EQ);
                expect(replicaC2.__clock.compare(replicatedS.__clock)).to.equal(Clock.EQ);
                done();
            }, 2000);
        }, 1000);
    });

    it('replicated object - multiple clients', function (done) {
        this.timeout(4500);
        var replicatedS = myServer.makeReplicatedObject("replica5", {x:1});
        var clients = [];
        for (var i = 0; i < 5; i++) {
            clients.push(createClient(function (name, key, value) {}));
        }
        setTimeout(function () {
            var replicatedC = clients[0].store.getObject("replica5");
            replicatedC.y = 101;
            var idx = clients.length;
            setTimeout(function () {
                clients.forEach(function (client) {
                    expect(client.store.getObject("replica5").y).to.equal(101);
                    idx--;
                    if (idx <= 0)
                        done();
                })
            }, 3000);
        }, 1000)
    });

    it('replicated object - concurrent clients', function (done) {
        this.timeout(4500);
        var replicatedS = myServer.makeReplicatedObject("replica6", {x:1});
        var client1 = createClient(function (name, key, value) {});
        var client2 = createClient(function (name, key, value) {});

        setTimeout(function () {
            var replicatedC1 = client1.store.getObject("replica6");
            var replicatedC2 = client2.store.getObject("replica6");
            replicatedC1.y = 101;
            replicatedC2.y = 202;

            setTimeout(function () {
                var server = replicatedS.y;
                expect(server).to.equal(replicatedC1.y);
                expect(server).to.equal(replicatedC2.y);
                expect(replicatedS.__clock.compare(replicatedC1.__clock)).to.equal(Clock.EQ);
                expect(replicatedS.__clock.compare(replicatedC2.__clock)).to.equal(Clock.EQ);
                done();
            }, 3000);
        }, 1000)
    })

    it('replicated object - concurrent update', function (done) {
        this.timeout(5500);
        var replicatedS = myServer.makeReplicatedObject("replica7", {x:1});
        var client1 = createClient(function (name, key, value) {});
        var client2 = createClient(function (name, key, value) {});


        setTimeout(function () {
            var replicatedC1 = client1.store.getObject("replica7");
            var replicatedC2 = client2.store.getObject("replica7");
            client1.RPC.connected = false;
            client1.simulateDisconnect();
            client2.RPC.connected = false;
            setTimeout(function () {
                replicatedC2.y = 42;
                replicatedC1.y = 101;
                client1.RPC.connected = true;
                client1.simulateConnect();
                client2.RPC.connected = true;
                setTimeout(function () {
                    var clock = replicatedS.__clock;
                    expect(client1.store.getObject("replica7").y).to.equal(42);
                    expect(client2.store.getObject("replica7").y).to.equal(42);
                    expect(replicatedS.y).to.equal(42);
                    expect(clock.compare(replicatedC1.__clock)).to.equal(Clock.EQ);
                    expect(clock.compare(replicatedC2.__clock)).to.equal(Clock.EQ);
                    done();
                }, 3000);
            }, 1000);

        }, 1000)
    })

    it('replicated object - assignment server, offline client', function(done) {
        this.timeout(4500);
        var replicatedS = myServer.makeReplicatedObject("replica8", {x:1});
        var client = createClient(function (name, key, value) {});
        var client2 = createClient(function (name, key, value) {});
        setTimeout(function() {
            var replicatedC = client.store.getObject("replica8");
            var replicatedC2 = client2.store.getObject("replica8");
            replicatedC.x = 303;
            client.simulateDisconnect();
            client2.simulateDisconnect();
            setTimeout(function () {
                replicatedC.x = 101;
                replicatedC2.x = 202;
                client.simulateConnect();
                client2.simulateConnect();
                setTimeout(function () {
                    var server = replicatedS.x;
                    var clock = replicatedS.__clock;
                    expect(server).to.equal(replicatedC.x);
                    expect(server).to.equal(replicatedC2.x);
                    expect(clock.compare(replicatedC.__clock)).to.equal(Clock.EQ);
                    expect(clock.compare(replicatedC2.__clock)).to.equal(Clock.EQ);
                    done();
                }, 2500);
            }, 500);
            }, 1000)

    });


    it('replicated array - assignment server', function(done) {
        this.timeout(1500);
        var replicatedS = myServer.makeReplicatedObject("replica9", [1,2,3]);
        replicatedS.push(4);
        setTimeout(function() {
            var replicatedC = storeC.store["replica9"];
            expect(replicatedC.length).to.equal(4);
            done();
        }, 1000);
    });


    it('replicated array - assignment client', function(done) {
        this.timeout(2500);
        var client = createClient(function (name, key, value) {});
        var replicatedS = myServer.makeReplicatedObject("replica10", [1,2,3]);
        setTimeout(function() {
            var replicatedC = myClient.makeReplicatedObject("replica10", [1,2,3]);
            replicatedC.push(4);
            replicatedC.push(5);
            setTimeout(function () {
                expect(replicatedC.length).to.equal(5);
                expect(replicatedS.length).to.equal(5);
                done();
            }, 1000);
        }, 1000);
    });

    it('replicated array - object', function (done) {
        this.timeout(2500);
        var client = createClient(function (name, key, value) {});
        var foobar = new ReplicatedFooServer(22);
        var replicated10 = myServer.makeReplicatedObject("replicated11", [foobar, new ReplicatedFooServer(3)]);
        setTimeout(function() {
            replicated10[1].x = 42;
            setTimeout(function () {
                var replicatedC = client.store.getObject("replicated11");
                expect(replicatedC[1].x).to.equal(42);
                expect(replicatedC[0].x).to.equal(22);
                expect(replicatedC.__clock.compare(replicated10.__clock)).to.equal(Clock.EQ);
                expect(replicatedC[1].__clock.compare(replicated10[1].__clock)).to.equal(Clock.EQ);
                done();
            }, 1000);
        },1000);
    })

    it('replicated array - object multiple clients', function (done) {
        this.timeout(6500);
        var client = createClient(function (name, key, value) {});
        var client2 = createClient(function (name, key, value) {});
        var foobar = new ReplicatedFooServer(22);
        var replicated11 = myServer.makeReplicatedObject("replica12", [foobar, new ReplicatedFooServer(3)]);
        setTimeout(function() {
            var replicatedC = client.store.getObject("replica12");
            var replicatedC2 = client.store.getObject("replica12");
            replicated11[1].x = 101;
            client2.simulateDisconnect();
            setTimeout(function () {
                replicatedC2[0].x = 202;
                replicatedC[1].x = 303;
                replicatedC[0].x = 404;
                client2.simulateConnect();
                setTimeout(function () {
                    expect(replicatedC[1].x).to.equal(303);
                    expect(replicatedC[0].x).to.equal(404);
                    expect(replicatedC2[0].x).to.equal(404);
                    expect(replicatedC2[1].x).to.equal(303);
                    expect(replicatedC.__clock.compare(replicated11.__clock)).to.equal(Clock.EQ);
                    expect(replicatedC2.__clock.compare(replicated11.__clock)).to.equal(Clock.EQ);
                    expect(replicatedC[0].__clock.compare(replicated11[0].__clock)).to.equal(Clock.EQ);
                    expect(replicatedC2[0].__clock.compare(replicated11[0].__clock)).to.equal(Clock.EQ);
                    expect(replicatedC[1].__clock.compare(replicated11[1].__clock)).to.equal(Clock.EQ);
                    expect(replicatedC2[1].__clock.compare(replicated11[1].__clock)).to.equal(Clock.EQ);
                    done();
                }, 3500);
            }, 1000);
        },1000);
    })
});