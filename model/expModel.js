var exec = require('child_process').exec;
var http = require("http");
var async = require('async');

var url = 'mongodb://wikiExpl:wikipediaisawesome@stark.cs.northwestern.edu:27017/wiki_expl'

// Use connect method to connect to the Server 

//var db = require('mongo-lite').connect(url,["newPlan"])


var getName = function(key, callback){
  exec("grep '^"+key+",' "+__dirname+"/pageId-name.csv", function(error, stdout, stderr){
    try{
      callback(stdout.split(',').slice(1).toString().replace('\n',''));
    }
    catch(err){
      callback("");
    }
}); 
};

var getKeyValue = function(title, callback){
  exec("grep -P '^"+title.replace("(","\\(").replace(")","\\)")+"\t' "+__dirname+"/redirect.map;",
    function (error, stdout, stderr) {
       try {
           getName(stdout.split("\t")[1].replace("\n",""), function(value){
               callback(stdout.split("\t")[1].replace("\n",""),value);
             });
           }
       catch(err) {
           callback("","");
           }
      if (error !== null) {
        console.log('exec error: ' + error);
      }
  });
};

exports.getKeyValue = getKeyValue;

var getDbExp = function(key1, key2, callback){
   /*db.newPlan.first({"$or": [{'id1': key1 , 'id2': key2}, {'id1': key2 , 'id2': key1}]}, function(err,doc){
      if (doc){
          
         delete doc._id;
         callback(doc);
      } else{
         callback(null);
      }
   });*/
  callback(null);
}

var getExplanation = function(key1, key2, givenName1, givenName2, callback){
   getDbExp(key1, key2, function(doc){
     if (doc){
        callback(doc);
     }
     else {
        exec("python2.7 /home/geoadmin/atlasify-be/python-code/main.py " + key1 + " " + key2 + " " + givenName1 + " " + givenName2,
           function (error, stdout, stderr) {
             console.log("yo");
             console.log("python2.7 /home/geoadmin/atlasify-be/python-code/main.py " + key1 + " " + key2 + " " + givenName1 + " " + givenName2);
             /*try {
	                db.newPlan.insert(JSON.parse(stdout), function(result){
                  console.log('done'); //callback(JSON.parse(stdout));
               });
	              callback(JSON.parse(stdout));
             }
              catch(err) {
                callback({"error": err});
              }*/
            if (error !== null) {
               console.log('exec error: ' + error);
             } else {
               callback(JSON.parse(stdout));
             }
        });
      }
   });
};

exports.getExplanation = getExplanation;

var getExplanationFromIds = function(key1, key2, callback){
   getDbExp(key1, key2, function(doc){
     if (doc)
        callback(doc);
     else {
        exec("python2.7 /home/geoadmin/atlasify-be/python-code/main.py " + key1 + " " + key2,
           function (error, stdout, stderr) {
             console.log("python2.7 /home/geoadmin/atlasify-be/python-code/main.py " + key1 + " " + key2);
             /*try {
               db.newPlan.insert(JSON.parse(stdout), function(result){
                 console.log('done'); //callback(JSON.parse(stdout));
               });
               callback(JSON.parse(stdout));
             }
             catch(err) {
               callback(err);
             }*/
            if (error !== null) {
               console.log('exec error: ' + error);
            } else {
              callback(JSON.parse(stdout));
            }
        });
      }
   });
};

exports.getExplanationFromIds = getExplanationFromIds;

var getJSON = function(options, onResult){
    var req = http.request(options, function(res)
    {
        var output = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            output += chunk;
        });
        res.on('end', function() {
            var obj = JSON.parse(output);
            onResult(res.statusCode, obj);
        });
    });
    req.on('error', function(err) {
        //res.send('error: ' + err.message);
    });
    req.end();
};

exports.getJSON = getJSON;

var preCompute = function(concept, callback){
      exec("echo \""+concept+"\" > /home/geoadmin/atlasify-be/preCompute/data/"+Math.round(Math.random()*100000000), function(error, stdout, stderr){
        try{
          callback(concept, "success");
        }
        catch(err){
          callback(concept, "failed");
        }
    });
};
exports.preCompute = preCompute;
