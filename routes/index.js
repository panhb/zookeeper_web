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
  var address = ip+":"+port;
  var client = initClient(address);
  setTimeout(function() {
	console.log(client.getState());
	if(client.getState().code === zookeeper.State.SYNC_CONNECTED){
		closeClient(client);
		res.send({success:true});
	}else{
		res.send({success:false});
	}
  }, 1000);
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
  var client = initClient(address);
  client.mkdirp(
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
		closeClient(client);
		res.send(obj);
	}
  );
});

router.get('/del/:address', function(req, res, next) {
  var address = req.params.address;
  var path = req.query.path;
  var obj = {};
  var client = initClient(address);
  delNode(path,client);
  setTimeout(function(){
	  closeClient(client);
	  res.send({success:true,message:'Node delete success.'}
  )},1000);
});

function delNode(path,client){
	client.getChildren(path,function (error, children, stat) {
		if (error || children === null || children.length === 0 ) {
			client.remove(path,function (error) {
				console.log('Node delete success.Path is '+path);
			});
		}else{
			for(var child in children){
				var npath = path+'/'+children[child];
				delNode(npath,client);
			}
			delNode(path,client);
		}
	});
}

function initClient(address){
	var client = zookeeper.createClient(address,{ sessionTimeout: 5000 });
    client.connect();
	return client;
}

function closeClient(client){
	if(client != null){
		try {
			client.close();
		} catch (error) {
			console.error(error);
		}
	}
}

router.get('/update/:address', function(req, res, next) {
  var address = req.params.address;
  var path = req.query.path;
  var data = req.query.data;
  var obj = {};
  var client = initClient(address);
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
		closeClient(client);
		res.send(obj);
	}
  );
});

router.post('/connect/:address', function(req, res, next) {
  var address = req.params.address;
  var id = req.body.id;
  var name = req.body.name;
  var path = req.body.path;
  var client = initClient(address);
  client.once('connected', function (err) {
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
				}else{
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
				}
			});
		},function(errs,results){
			if(errs){
				console.log(errs);
				closeClient(client);
				res.send(errs);
				return;
			}else{
				if(path === '/'){
					var obj = {};
					obj.id = pid;
					obj.name = '/';
					obj.children = results;
					closeClient(client);
					res.send(obj);
					return;
				}else{
					//节点按ascii码排序
					results.sort(function(a,b){
						var a1 = a.name.split('.');
						var b1 = b.name.split('.');
						var len1 = a1.length < b1.length ? a1.length:b1.length;
						for(var i = 0 ; i < len1; i++){
							if(a1[i] == b1[i])
								continue;
							var a2 = a1[i].split('');
							var b2 = b1[i].split('');
							var len2 = a2.length < b2.length ? a2.length:b2.length;
							for(var j = 0 ; j < len2; j++){
								if(a2[j].charCodeAt()  > b2[j].charCodeAt())
									return 1;
								else if(a2[j].charCodeAt()  < b2[j].charCodeAt())
									return -1;
								if(j == len2-1)
									return 1;
							}
						}	
					});
					closeClient(client);
					res.send(results);
					return;
				}
			}
		});
	});
}

module.exports = router;
