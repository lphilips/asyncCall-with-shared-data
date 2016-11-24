'use strict';


var myClient = new ClientData('http://127.0.0.1:3030', {
    throwNativeError: true
}, function (name, object) {
    if (name == "msgs") {
        object.forEach(function (msg) {
            $messages.append('<p><b>' + msg.from + '</b>:' + msg.msg + '</p>');
        })
    }
}, updateMessages);

var messages = myClient.makeReplicatedObject("msgs", [], updateMessages);


//HTML elements -> jquery

var $messages = $('.chatScreen'); // Messages area
var $message = $('.message'); // Input message
var $author = $('.author'); // Input author


function updateMessages (name, key, value) {
    if (value.from)
      $messages.append('<p><b>' + value.from + '</b>:' + value.msg + '</p>');
}


var speakMessage = function () {

    var msg = $message.val();
    var author = $author.val();

    messages.push({from: author, msg: msg});
    $message.val('');
};