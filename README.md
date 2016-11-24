# RPC + Shared Data library

This project is based on [asyncCall][asyncCall] and uses parts of [datastore][datastore].
The two projects are combined such that changes two types of data (observable and replicated data) can be used.
Changes to these data types are propagated to server or clients via remote procedure calls. This way, custom failure handling can be added when for example no network is available. 
Proxies are used to ensure that every assignment on these objects are propagated to the server and every connected client.

### Example: chat application
Full example can be found under Examples.
##### Server side
Set up the server and create a replicated data type for the chat messages.
```javascript
var myServer = new ServerData(app);
// Declare replicated data set
var messages = myServer.makeReplicatedObject("msgs", []);
```
##### Client side

Set up a client and declare the client-side replicated data set for the messages.
```javascript
// CLIENT (port, options, callback)
var myClient = new ClientData('http://127.0.0.1:3000', {}, function (id, object) {
  if (id == "msgs") {
    // Display every individual message
    object.forEach(function (message) {
      updateMessage(false, message);
    })
  }
});
var messages = myClient.makeReplicatedObject("msgs", [], updateMessages);
```

The following function will be called every time a new message is added to the messages set.
It works on individual messages (objects with `from` and `msg` properties) but also on an array of messages.
```javascript
var $messages = $('.chatScreen'); // Messages area

function updateMessages(id, key, value) {
  if (value.from)
    $messages.append('<p><b>'+ value.from + '</b>:' + value.msg + '</p>';
}
```
Adding a new message (client-side):
```javascript
function speakMessage = function () {
  var msg = $message.val();
  var author = $author.val();
  messages.push({from: author, msg: msg});
  $message.val('');
}
```

### Replicated Objects

When a replicated object is created on the server side, this will automatically be sent to every connected client. Clients can access this via the `client.store.getObject(id)` method.
```javascript
// SERVER
var replica = server.makeReplicatedObject("replica", {x:1, y:2});
// CLIENT
var replica = client.store.getObject("replica");
```

The other option is declaring the replicated object on the client side as well, with the same `id` as the declaration of the server instance.
```javascript
//CLIENT
var replica = client.makeReplicatedObject("replica", {x:1, y:2});
```
From that moment on, every change on the client or server side on the `replica` variable will be propagated, via the server, to every client. Vector clocks are used to solve concurrent updates. In that case the "last writer wins"-strategy is used.

When creating a replicated object on the client, an optional callback function can be passed along. This function is called every time an update on the object happened and is useful for e.g. updating a user interface.

```javascript
//CLIENT
var replica = client.makeReplicatedObject("replica", {x:1, y:2}, function (id, key, value) {
    if (key == "x") 
        // Draw the point on its new x-coordinate
    if (key == "y")
        // Draw the point on its new y-coordinate
});
```
In the same fashion a callback function, that will be called every time a new object is added, can be given when creating a client instance.
```javascript
// CLIENT (port, options, callback)
new ClientData('http://127.0.0.1:3000', {}, function (id, object) {
    // Check on id and e.g. update UI
}
```

### Observable Objects

Works in the same way as replicated objects, but clients can't perform assignments on observable objects.
An `AssignmentObservable` Error will be thrown at run-time when this should happen.
Changes on the server-side instance of an observable object are automatically propagated to all clients.

```javascript
// SERVER
var observable = server.makeObservableObject("observable", {x: 1, y:2});
// CLIENT
var observable = client.store.getObject("observable");
// OR
var observable = client.makeObservableObject("observable", {x: 1, y: 2});
```
When creating an observable object on the client, an optional callback function can be passed along. This function is called every time an update on the object happened and is useful for e.g. updating a user interface.

   [asyncCall]: <https://github.com/dielc/asyncCall.js>
   [datastore]: <https://github.com/bredele/datastore>
  

