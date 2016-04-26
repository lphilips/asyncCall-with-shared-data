# RPC + Data Store library

This project is based on [asyncCall][asyncCall] and [datastore][datastore].
The two projects are combined such that changes to the datastore are propagated to server or clients via remote procedure calls. This way, custom failure handling can be added when for example no network is available. 
By using `store.set(key, value)`, the changes are automatically propagated through the network. The store does not take conflict resolution into account.

### Example: chat application
Full example can be found under Examples.
##### Server side
Set up the server and connect a store to it.
```javascript
var myServer = new ServerRpc(app);
var store = new Store();
store.connectServer(myServer);
```
The server must implement the following two remote methods:
```javascript
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
```
To add a default chat message:
```javascript
store.set('messages', ['Welcome!']);
```
##### Client side

Set up a client and connect a store to it. The store can be configured to automatically write to localStorage as well.
```javascript
var myClient = new ClientRpc('http://127.0.0.1:3000', options);
var store = new Store();
store.localStore(localStorage, 'chatApp', true); // Optional
store.connectClient(myClient);
```

The client must implement the following remote method. In this case, the call to `displayMessages` is application specific and responsible for updating the UI.
```javascript
//Exposed interface.
myClient.expose({
    'updateStore': function (key, val, cb) {
        store.set(key, val, true);
        displayMessages();
    }
});
```
Displaying all the messages:
```javascript
function displayMessages () {
    var messages = store.get('messages');
    $messages.empty();
    messages.forEach(function (message) {
         $messages.append('<p>' + message + '</p>');
    })
}
```
Updating the store when the Send button is clicked. The call to `store.set(key, value)` is responsible for propagating the change to the server, and thus also to the other connected clients.
```javascript
$('#btn').click(function () {
    var msg = $('.message').val();
    var author = $('.author').val();
    messages = store.get('messages');
    messages.push(author + ": " + msg);
    store.set('messages', messages);
})
```


   [asyncCall]: <https://github.com/dielc/asyncCall.js>
   [datastore]: <https://github.com/bredele/datastore>
  

