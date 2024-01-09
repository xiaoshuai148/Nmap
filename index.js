
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

//numCPUs = 1;

if(cluster.isMaster){
    for(var i=0;i<numCPUs;i++){
        cluster.fork();
    }
    cluster.on('death',function(worker){
        console.log('worker'+worker.pid+'died');
        cluster.fork()
    });
}
else{
    ;(async function(){
        //mongodb连接例子
        var MongoClient = require('mongodb').MongoClient;

        //读取文件夹conf/mongodb.json
        var fs = require('fs');
        var path = require('path');
        var filePath = path.join(__dirname, 'conf/mongodb.json');
        var fileContent = fs.readFileSync(filePath, 'utf-8');
        var mongodbConfig = JSON.parse(fileContent);

        const connectionString = mongodbConfig.connectionString;
        const dbName = mongodbConfig.dbName;
        const collectionName = mongodbConfig.collectionName;

        //读取文件夹conf/server.json
        var filePath = path.join(__dirname, 'conf/server.json');
        var fileContent = fs.readFileSync(filePath, 'utf-8');
        var serverConfig = JSON.parse(fileContent);

        const serverPort = serverConfig.port;

        const client = new MongoClient(connectionString);
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        //collection字段(createdAt)2小时后自动删除
        await collection.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 7200 });
        //type字段索引
        await collection.createIndex({ "type": 1, "key": 1 });
        

        //express例子
        var express = require('express');
        var app = express();

        app.get('/', function (req, res) {
            res.send('Hello World!');
        });

        app.post('/map/set', function (req, res) {
            //获取type参数
            var type = req.query.type;
            var key = req.query.key;
            //获取body参数
            req.rawBody = '';
            req.on('data', function(chunk) { 
                req.rawBody += chunk;
            });
            req.on('end', async function() {
                try{
                    //如果type和key已经存在，更新,否则插入
                    var result = await collection.updateOne({
                        type: type,
                        key: key
                    },{
                        $set: {
                            content: req.rawBody,
                            createdAt: new Date()
                        }
                    },{
                        upsert: true
                    });
                    res.status(200).send('ok');
                }
                catch(e){
                    res.status(400).send('error');
                }
            });
        });

        app.get('/map/get', async function (req, res) {
            //获取type参数
            var type = req.query.type;
            var key = req.query.key;
            try{
                var result = await collection.findOne({
                    type: type,
                    key: key
                })
                if(result._id){
                    res.status(200).send(result.content);
                }
                else{
                    res.status(400).send('error');
                }
            }
            catch(e){
                res.status(400).send('error');
            }
        });

        app.get('/map/del', async function (req, res) {
            //获取type参数
            var type = req.query.type;
            var key = req.query.key;
            try{
                var result = await collection.deleteOne({
                    type: type,
                    key: key
                });
                if(result.deletedCount==1){
                    res.status(200).send('ok');
                }else{
                    res.status(400).send('error');
                }
            }
            catch(e){
                res.status(400).send('error');
            }
        });

        app.get('/map/has', async function (req, res) {
            //获取type参数
            var type = req.query.type;
            var key = req.query.key;
            try{
                var result = await collection.countDocuments({
                    type: type,
                    key: key
                });
                if(result==1){
                    res.status(200).send('ok');
                }else{
                    res.status(400).send('error');
                }
            }
            catch(e){
                res.status(400).send('error');
            }
        });

        app.get('/map/size', async function (req, res) {
            //获取type参数
            var type = req.query.type;
            try{
                var result = await collection.countDocuments({
                    type: type
                });
                res.status(200).send(result.toString());
            }
            catch(e){
                res.status(400).send('error');
            }
        });

        app.listen(serverPort, function () {
            console.log('Example app listening on port '+serverPort+'!');
        });

    })();
}