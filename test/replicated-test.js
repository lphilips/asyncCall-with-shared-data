'use strict';

var express = require('express'),
    app = express(),
    ServerRpc = require('../lib/rpc-server.js'),
    ClientRpc = require('../lib/rpc-client.js'),
    Store = require('../lib/store.js'),
    ReplicatedObject = require('../lib/ReplicatedObject.js'),
    port = 8125,
    assert = require("assert"),
    expect = require('chai').expect,
    Clock = require('../lib/clock.js');

app.use("/", express.static(__dirname + '/'));

var methods = {
    '__updateFromClient__': function (uid, prop, value, clock, cb) {
        var obj = storeS.getObject(uid);
        if (obj)
            obj.__updateFromClient__(prop, value, clock, this.id);
    }
};

var myServer = new ServerRpc(app, port);
var storeS = new Store();
myServer.expose(methods);


myServer.onConnection(function (client) {
    Object.keys(storeS.store).forEach(function(key, index) {
        var obj = storeS.store[key];
        var clock = obj.__clock;
        myServer.rpcTo(client.id, '__addObjectFromServer__', key, obj, clock);
    });
});


var createClient = function () {
    var store = new Store();
    var myClient = new ClientRpc('http://127.0.0.1:8125', {
        throwNativeError: true
    });
    var clientMethods =  {
        '__updateFromServer__': function (uid, prop, value, clock, cb) {
            var obj = store.getObject(uid);
            if (obj) {
                obj.__updateFromServer__(prop, value, clock);
            }

        },
        '__rollbackClock__' : function (uid, obj, clock, cb) {
            var obj = store.getObject(uid);
            obj.__clock = clock;
            obj.__updateFromServer__(obj, clock);
        },
        '__addObjectFromServer__': function (uid, object, clock, cb) {
            var obj = store.getObject(uid);
            if (!obj) {
                var replica = ReplicatedObject.makeReplicatedObjectClient(myClient, store, '__updateFromServer__', '__updateFromClient__', object, uid, clock);
                store.addObject(replica, uid);
            } else {
                obj.__updateFromServer__(object, clock);
            }
        }
    };
    myClient.store = store;
    myClient.expose(clientMethods);
    return myClient;
}

var myClient = createClient();
var storeC = myClient.store;


function ReplicatedFooServer (x, id) {
    function Foo(x) {
        this.x = x
    }
    return ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', new Foo(x), id, Clock.makeClock());
}

describe('test for replicated object', function() {

    it('replicated object - assignment server', function(done) {
        this.timeout(1500);
        var replicatedS = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', {x: 1}, "replica1",  Clock.makeClock());
        replicatedS.x = 101;
        setTimeout(function() {
            var replicatedC = storeC.store["replica1"];
            expect(replicatedC.x).to.equal(101);
            done();
        }, 1000);
    });

    it('replicated object - assignment client', function(done) {
        this.timeout(3500);
        var replicatedS = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', {x: 1}, "replica2", Clock.makeClock());
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
        var replicatedS = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', {x: 1}, "replica2", Clock.makeClock());
        setTimeout(function() {
            var replicatedC = storeC.store["replica2"];
            replicatedC.x = 101;
            setTimeout(function () {
                expect(replicatedS.x).to.equal(101);
                done();
            }, 2000);
        }, 1000);
    });


    it('replicated object - assignment and new client', function (done) {
        this.timeout(3500);
        var replicatedS = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', {x: 1}, "replica3", Clock.makeClock());
        setTimeout(function() {
            var replicatedC = storeC.store["replica3"];
            replicatedC.x = 101;
            var client2 = createClient();
            setTimeout(function () {
                var replicaC2 = client2.store.getObject("replica3");
                expect(replicaC2.x).to.equal(101);
                expect(replicatedC.__clock.compare(replicatedS.__clock)).to.equal(Clock.EQ);
                expect(replicaC2.__clock.compare(replicatedS.__clock)).to.equal(Clock.EQ);
                done();
            }, 2000);
        }, 1000);
    });

    it('replicated object - multiple clients', function (done) {
        this.timeout(4500);
        var replicatedS = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', {x: 1}, "replica4", Clock.makeClock());
        var clients = [];
        for (var i = 0; i < 5; i++) {
            clients.push(createClient());
        }
        setTimeout(function () {
            var replicatedC = clients[0].store.getObject("replica4");
            replicatedC.y = 101;
            var idx = clients.length;
            setTimeout(function () {
                clients.forEach(function (client) {
                    expect(client.store.getObject("replica4").y).to.equal(101);
                    idx--;
                    if (idx <= 0)
                        done();
                })
            }, 3000);
        }, 1000)
    });

    it('replicated object - concurrent clients', function (done) {
        this.timeout(4500);
        var replicatedS = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', {x: 1}, "replica5", Clock.makeClock());
        var client1 = createClient();
        var client2 = createClient();

        setTimeout(function () {
            var replicatedC1 = client1.store.getObject("replica5");
            var replicatedC2 = client2.store.getObject("replica5");
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
        var replicatedS = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', {x: 1}, "replica6", Clock.makeClock());
        var client1 = createClient();
        var client2 = createClient();


        setTimeout(function () {
            var replicatedC1 = client1.store.getObject("replica6");
            var replicatedC2 = client2.store.getObject("replica6");
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
                    expect(client1.store.getObject("replica6").y).to.equal(42);
                    expect(client2.store.getObject("replica6").y).to.equal(42);
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
        var replicatedS = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', {x: 1}, "replica7", Clock.makeClock());
        var client = createClient();
        var client2 = createClient();
        setTimeout(function() {
            var replicatedC = client.store.getObject("replica7");
            var replicatedC2 = client2.store.getObject("replica7");
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
        var replicatedS = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', [1,2,3], "replica8",  Clock.makeClock());
        replicatedS.push(4);
        setTimeout(function() {
            var replicatedC = storeC.store["replica8"];
            console.log(replicatedC);
            expect(replicatedC.length).to.equal(4);
            done();
        }, 1000);
    });


    it('replicated array - assignment client', function(done) {
        this.timeout(2500);
        var client = createClient();
        var replicatedS = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', [1,2,3], "replica9",  Clock.makeClock());
        setTimeout(function() {
            var replicatedC = ReplicatedObject.makeReplicatedObjectClient(client, client.store, '__updateFromServer__', '__updateFromClient__', [1,2,3], "replica9", Clock.makeClock());
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
        var client = createClient();
        var foobar = new ReplicatedFooServer(22);
        var replicated10 = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', [foobar, new ReplicatedFooServer(3)], "replicated10", Clock.makeClock());
        setTimeout(function() {
            replicated10[1].x = 42;
            setTimeout(function () {
                var replicatedC = client.store.getObject("replicated10");
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
        var client = createClient();
        var client2 = createClient();
        var foobar = new ReplicatedFooServer(22);
        var replicated11 = ReplicatedObject.makeReplicatedObjectServer(myServer, storeS, '__updateFromServer__', '__updateFromClient__', [foobar, new ReplicatedFooServer(3)], "replicated11", Clock.makeClock());
        setTimeout(function() {
            var replicatedC = client.store.getObject("replicated11");
            var replicatedC2 = client.store.getObject("replicated11");
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