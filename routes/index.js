var express = require('express');
var zookeeper = require('node-zookeeper-client');
var async = require('async');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'zookeeper_web' });
});

router.get('/testConnect', function(req, res, next) {
  var ip = req.query.ip;
  var port = req.query.port;
  var client = zookeeper.createClient(ip+":"+port,{ sessionTimeout: 50000 });
  client.connect();
  var flag = false;
  client.once('connected', function () {
	  flag = true;
	  try{
	  	  res.send({success:true});
	  }catch(e){
		  console.error(e);
	  }
  });
  try{
	 setTimeout(function(){if(!flag){res.send({success:false});}},1000);
  }catch(e){
	 console.error(e);
  }
});

router.get('/main', function(req, res, next) {
  var ip = req.query.ip;
  var port = req.query.port;
  res.render('main', { ip: ip, port:port});
});

router.get('/add/:address', function(req, res, next) {
  var address = req.params.address;
  var path = req.query.path;
  var data = req.query.data;
  var create_model = req.query.create_model;
  var obj = {};
  var client = zookeeper.createClient(address,{ sessionTimeout: 50000 });
  client.connect();
  client.create(
	path,
	new Buffer(data),
	create_model,
	function (error, path) {
		if (error) {
			obj.success = false;
			if (error.getCode() == zookeeper.Exception.NODE_EXISTS) {
				obj.message = 'Node exists.';
				console.log('Node exists.Path is '+path);
			} else {
				console.log(error.stack);
				obj.message = error.stack;
			}
		}else{
			obj.success = true;
			obj.message = 'Node create success.';
			console.log('Node create success.Path is '+path+'. Data is '+data);
		}
		res.send(obj);
	}
  );
});

router.get('/del/:address', function(req, res, next) {
  var address = req.params.address;
  var path = req.query.path;
  var obj = {};
  var client = zookeeper.createClient(address,{ sessionTimeout: 50000 });
  client.connect();
  client.remove(
	path,
	function (error) {
		if (error) {
			obj.success = false;
			if (error.getCode() == zookeeper.Exception.NO_NODE) {
				obj.message = 'No node.';
				console.log('No node.Path is '+path);
			} else {
				console.log(error.stack);
				obj.message = error.stack;
			}
		}else{
			obj.success = true;
			obj.message = 'Node delete success.';
			console.log('Node delete success.Path is '+path);
		}
		res.send(obj);
	}
  );
});

router.get('/update/:address', function(req, res, next) {
  var address = req.params.address;
  var path = req.query.path;
  var data = req.query.data;
  var obj = {};
  var client = zookeeper.createClient(address,{ sessionTimeout: 50000 });
  client.connect();
  client.setData(
	path,
	new Buffer(data),
	function (error) {
		if (error) {
			obj.success = false;
			if (error.getCode() == zookeeper.Exception.NO_NODE) {
				obj.message = 'No node.';
				console.log('No node.Path is '+path);
			} else {
				console.log(error.stack);
				obj.message = error.stack;
			}
		}else{
			obj.success = true;
			obj.message = 'Node update success.';
			console.log('Node update success.Path is '+path+'. Data is '+data);
		}
		res.send(obj);
	}
  );
});

router.post('/connect/:address', function(req, res, next) {
  var address = req.params.address;
  var id = req.body.id;
  var name = req.body.name;
  var path = req.body.path;
  
  var client = zookeeper.createClient(address,{ sessionTimeout: 50000 });
  client.connect();
  client.once('connected', function () {
	if(typeof id === 'undefined'){
		listChildren(res,client,'/','1');
	}else{
		if(path === '/'){
			path = path+name;
		}else{
			path = path+'/'+name;
		}
		listChildren(res,client,path,id);
	}
  });  
});

function listChildren(res,client, path,pid) {
    client.getChildren(path,function (error, children, stat) {
		if (error) {
			console.log(error);
			return;
		}
		var i = 1;
		async.map(children,function(child,callback){
			var id = pid +'`'+i;
			i++;
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
							callback(null,{'name':child,'isParent':false,data:'',pid:pid,id:id,path:path});
						}else{
							callback(null,{'name':child,'isParent':false,data:data.toString('utf8'),pid:pid,id:id,path:path});
						}
					});
				}else{
					callback(null,{'name':child,'isParent':true,pid:pid,id:id,path:path});
				}
			});
		},function(errs,results){
			if(errs){
				console.log(errs);
			}else{
				if(path === '/'){
					var obj = {};
					obj.id = pid;
					obj.name = '/';
					obj.children = results;
					res.send(obj);
				}else{
					res.send(results);
				}
				
			}
		});
	});
}

module.exports = router;
