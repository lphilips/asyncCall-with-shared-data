'use strict';

var options = {
    debugMode: false
};

var myClient = new ClientRpc('http://127.0.0.1:3000', options);
var store = new Store();

store.localStore(localStorage, 'chatApp', true);
store.connectClient(myClient);

//Exposed interface.
myClient.expose({
    'updateStore': function (key, val, cb) {
        store.set(key, val, true);
        displayMessages();
    }
});


//HTML elements -> jquery

var $messages = $('.chatScreen'); // Messages area
var $message = $('.message'); // Input message
var $author = $('.author'); // Input author
var btn = $('#btn');
var messages = store.get('messages');

function displayMessages () {
    messages = store.get('messages');
    $messages.empty();
    messages.forEach(function (message) {
         $messages.append('<p>' + message + '</p>');
    })
}

btn.click(function () {
    var msg = $message.val();
    var author = $author.val();
    messages = store.get('messages');
    messages.push(author + ": " + msg);
    store.set('messages', messages);
})
