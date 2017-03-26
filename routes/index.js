var express = require('express');
var router = express.Router();
var expModel = require("../model/expModel.js");
var async = require('async');
var fs = require('fs');
var uuid = require('node-uuid');
var http = require("http");

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
        res.send('error: ' + err.message);
    });
    req.end();
}

function isASCII(str, extended) { 
  return (extended ? /^[\x00-\xFF]*$/ : /^[\x00-\x7F]*$/).test(str);
}

function isItGood(temp) {
  return temp['titleId']!=-1;
}

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index');
});

router.get('/srapi/:id', function(req, res) {
  var options = {
        host: '165.124.181.35',
        port: 8080,
        path: '/wikifier/wiki/title/suggest/'+req.params.id,
        method: 'GET',
        headers: {
           'Content-Type': 'application/json'
           }
       };
  getJSON(options, function(statusCode, result){
        res.json(result.response.filter(isItGood).splice(0,8));
    });
});

router.get('/api', function(req, res) {
   async.parallel([
      function(callback){	
         expModel.getKeyValue(req.query.concept1, function (key, value){
             callback(null, [key, value]);
          });
      },
      function(callback){
         expModel.getKeyValue(req.query.concept2, function (key, value){
             callback(null, [key, value]);
         });
      }
   ], 
   function(err, ids){
     if (err != null) {
         res.json({"error": err});
     }
     console.log(ids);
       if (ids[0][1].length > 0 && ids[1][1].length > 0 && isASCII(ids[0][0],true) && isASCII(ids[1][0],true)) {
         console.log("about to call explanation...\n");
         expModel.getExplanation(ids[0][0], ids[1][0], ids[0][1], ids[1][1], function(result){
           console.log('The result: ', result, '\n');
	         res.json(result);
         });
      
      }
      else
        res.json({"error": true});
   });
});

router.get('/api2', function(req, res) {
      if (req.query.concept1.length > 0 && req.query.concept2.length > 0) {
        console.log("api2... with: ",  req.query.concept1, " ", req.query.concept2);
        expModel.getExplanationFromIds(req.query.concept1, req.query.concept2, function(result){
          console.log('The result: ', result, '\n');
          res.json(result);
        });
      }
      else {
        res.json({});
      }
});

router.get('/precompute', function(req, res) {
    expModel.preCompute(req.query.concept, function (concept , state){
        res.json({"status": state, "key": concept});
        });
      });

router.get('/explanation', function(req, res) {
   async.parallel([
      function(callback){
         expModel.getKeyValue(req.query.concept1, function (key1, value){
             callback(null, [key1, value]);
          });
      },
      function(callback){
         expModel.getKeyValue(req.query.concept2, function (key2, value){
             callback(null, [key2, value]);
         });
      }
   ],
   function(err, ids){
      console.log(ids);
      if (ids[0][1].length > 0 && ids[1][1].length > 0 && isASCII(ids[0][0],true) && isASCII(ids[1][0],true))
        expModel.getExplanation(ids[0][0], ids[1][0], ids[0][1], ids[1][1], function(result){
          if (req.query.action=="get")
            res.render('explanation', {  "concept1" : req.query.concept1, "concept2" : req.query.concept2  , "results" : result["explanations"]});
          else
       	    res.render('rateExplanations', {  "concept1" : req.query.concept1, "concept2" : req.query.concept2  , "results" : result["explanations"]});
          });
      else
        res.render('explanation', {  "concept1" : req.query.concept1, "concept2" : req.query.concept2  , "results" : []});
   });
});

router.get('/rate', function(req, res) {  
var uuidFilename = uuid.v4();
fs.writeFile('/home/geoadmin/NodeExp/training/'+uuidFilename, JSON.stringify(req.query, null, 4), function(err) {
    if(err) {
      console.log(err);
      res.render('index');
    } else {
      console.log("JSON saved to " + '/home/geoadmin/NodeExp/training/'+uuidFilename);
      res.render('index');
    }
   }
  );
});

router.get('/worldmap', function(req, res) {
   expModel.getPolygon(req.query.concept, function (result){
          res.json(result);
       });
    });

module.exports = router;
