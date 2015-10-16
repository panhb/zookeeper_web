var express = require('express');
var zookeeper = require('node-zookeeper-client');
var async = require('async');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/connect/:address', function(req, res, next) {
  var address = req.params.address;
  var client = zookeeper.createClient(address);
  client.connect();
  client.once('connected', function () {
	req.session.address = address;
	listChildren(res,client,'/');
  });  
});

router.get('/children', function(req, res, next) {
  var path = req.query.path;
  console.log(path);
  var tp = getTurePath(path);
  console.log(tp);
  var address = req.session.address;
  console.log(address);
  var client = zookeeper.createClient(address);
  client.connect();
  client.once('connected', function () {
	listChildren(res,client,tp);
  });  
});

router.get('/getData/:path', function(req, res, next) {
  var path = req.params.path;
  var tp = getTurePath(path);
  var address = req.session.address;
  var client = zookeeper.createClient(address);
  client.connect();
  client.once('connected', function () {
	client.getData(tp,function (error, data, stat) {
		if (error) {
            console.log(error.stack);
            return;
        }
		res.send(data.toString('utf8'));
	});
  });  
});

function getTurePath(path){
	var obj = JSON.parse(path);
	var length = getPropertyCount(obj);
	var tp = '';
	for(var i = 1;i< length+1;i++){
		tp += '/'+obj[i];
	}
	return tp;
}

function getPropertyCount(o){
	var n, count = 0; 
	for(n in o){ 
		if(o.hasOwnProperty(n)){
			count++;  
		}
	}
	return count; 
}


function listChildren(res,client, path) {
    client.getChildren(path,function (error, children, stat) {
		if (error) {
			console.log(error);
			return;
		}
		async.map(children,function(child,callback){
			var new_path = '';
			if(path === '/'){
				new_path = path+child;
			}else{
				new_path = path+'/'+child;
			}
			// console.log(new_path);
			client.getChildren(new_path,function (error, children, stat) {
				if (error) {
					callback(error);
				}
				if(children === null || children.length === 0 ){
					client.getData(new_path,function (error, data, stat) {
						if (error) {
							console.log(error.stack);
							return;
						}
						if(typeof data === 'undefined'){
							callback(null,{'name':new_path,'leaf':1,data:''});
						}else{
							callback(null,{'name':new_path,'leaf':1,data:data.toString('utf8')});
						}
					});
				}else{
					callback(null,{'name':child,'leaf':0});
				}
			});
		},function(errs,results){
			if(errs){
				console.log(errs);
			}else{
				// console.log(results);
				res.send(results);
			}
		});
	});
}

module.exports = router;
