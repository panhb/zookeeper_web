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
  console.log(ip)
  console.log(port)
  var client = zookeeper.createClient(ip+":"+port);
  client.connect();
  var flag = false;
  client.once('connected', function () {
	  flag = true;
	  res.send({success:true});
	  
  });
  setTimeout(function(){if(!flag){res.send({success:false});}},1000);
});

router.get('/main', function(req, res, next) {
  var ip = req.query.ip;
  var port = req.query.port;
  res.render('main', { ip: ip, port:port});
});

router.post('/connect/:address', function(req, res, next) {
  var address = req.params.address;
  var id = req.body.id;
  var name = req.body.name;
  var path = req.body.path;
  
  var client = zookeeper.createClient(address);
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
