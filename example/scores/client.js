'use strict';


var client = new ClientData('http://127.0.0.1:3030', {
    throwNativeError: true
}, function (name, object) {
    if (name == "scores"){
        Object.keys(object).forEach(function (key) {
            var score = object[key];
            updateScores(score.name, false, score);
        })
    }
}, updateScores);

//HTML elements -> jquery

var $scores = $('.scores'); // Messages area
var $name = $('.name'); // Input author


/* One function that can handle all updates */
function updateScores (id, key, value) {
    var $prev;
    // New player - score object
    if (value.name) {
        $prev = $("#"+value.name);
        if ($prev.length)
            $prev.text(value.name +' : ' + value.score);
        else
           $scores.append('<p id="' + value.name + '">' + value.name + ' : ' + value.score + '</p>');
    }
    // Update of an existing  player - score object
    else if (key == "score") {
        $prev = $("#"+id);
        if ($prev.length)
            $prev.text(id+' : ' + value);
    }
}

var scores = client.makeObservableObject("scores", {}, updateScores);

var incrScore = function () {
    var name = $name.val();
    client.rpc('incrScore', name);
};

var addScore = function () {
    var name = $name.val();
    client.rpc('addScore', name);
}