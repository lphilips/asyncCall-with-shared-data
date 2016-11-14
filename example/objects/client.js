'use strict';


var myClient = new ClientRpc('http://127.0.0.1:3000');
var store = new Store();

//Exposed interface.
myClient.expose({
    '__updateFromServer__': function (uid, prop, value, cb) {
        var obj = store.getObject(uid);
        if (obj)
            obj.__updateFromServer__(prop, value);
    },
    '__addObjectFromServer__' : function (uid, object, cb) {
        var obj = store.getObject(uid);
        if (!obj) {
            var observable = ObservableObject.makeObservableObjectClient('__updateFromServer__', store, object, uid);
            store.addObject(observable, uid);
        } else {
             obj.__updateFromServer__(object);
        }
    }
})

function ObservableFoo (x, id) {
    function Foo(x) {
        this.x = x
    }
    var o = new Foo(x);
    o.uid = id;
    return ObservableObject.makeObservableObjectClient('__updateFromServer__', store, o, id);
}

var observable = new ObservableFoo(42, "observable");
var observable2 = new ObservableObject.makeObservableObjectClient('__updateFromServer__', store, ["foo", "bar"], "observable2");
