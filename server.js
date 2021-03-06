var express = require("express");
var MongoClient = require('mongodb').MongoClient;
var constants = require('./constants.json');
var cors  = require('cors');

//online users
var users = {};

var app = express();
var database;

//declare soeckt IO SERVER
var server = require('http').Server(app);
var io = require('socket.io')(server);
app.use(cors());
MongoClient.connect(constants.database.url, function (err, db) {
  database = db;
});

var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 


io.on('connection', function(socket){
    socket.on('auth', function(jData){
        users[jData.username.replace('.','_')] = socket.id;
        console.log(users);
    })

    socket.on('message', function(jData){
        jNewData = {};
        jNewData.author = jData.target;
        jNewData.target = jData.author;
        jNewData.message = jData.message;
        jNewData.realAuthor = jData.author;
        jData.realAuthor = jData.author;
        jData.newMessage = true;
        jNewData.newMessage = false;
        if(users[jData.target]){
            socket.broadcast.to(users[jData.target]).emit('message now',jData);
        }
        
        
        addMessage(database, jData);
        addMessage(database, jNewData);

    })
})



app.post('/auth/signup', function(req, res){


    addUser(database, req.body).then(function () {
        res.status(200);
        res.end();
    })
    .catch(error => {
        res.status(400);
        res.end();
  })
})

app.post('/auth/login', function(req, res){

    loginUser(database, req.body).then(function(){
        res.status(200);
        res.end();
    })
    .catch(error => {
        res.status(400);
        res.end();
    })
})

app.get('/users', function( req, res){
    getUsers(database).then(users =>{
        res.json(users);
    });
})

app.get('/messages/:email/:username', function(req, res){
    var email =req.params['email'];
    var username = req.params['username'];
    getMessages(database, email, username).then(messages =>{
        
        res.send(messages);
    }).catch(err => res.json({"status":"no messages"}))
    
})

app.get('/seen/:email/:username', function(req, res){
    var email = req.params['email'];
    var username = req.params['username'];
    seenMessage(database, email, username).then(() => {
        res.send("ok");
    })
    
})

server.listen(8080, function(){
    console.log("SERVER IS LISTENING ON PORT 8080")
})

function addUser(db, jData){
     return new Promise((resolve, reject) => {
        cUsers = database.collection('users');
        var jUser = {
        '_id': jData.email,
        'username': jData.email.replace('.','_'),
        'name': jData.username,
        'email': jData.email,
        'password':jData.password,
        'messages':{}
        }
    cUsers.insert(jUser,function(err, docs){
        if(docs.ops)
        resolve();

        else reject("email already in use");

    });
    })
    
}

function loginUser(db, jData){
    return new Promise( (resolve, reject) => {
        var cUsers = db.collection('users');
        var email = jData.email;
        var password = jData.password;
        var jUser = {'email':email, 'password': password};
        cUsers.find(jUser).limit(1).toArray(function(err, docs){
            if(docs[0])
                resolve(docs);
            else reject("username or password incorrect");
        })
    })

}

function getUsers(db){
    return new Promise(resolve => {
        var cUsers = db.collection('users');
        cUsers.find({}).toArray(function(err, docs){
            resolve(docs);
        })
    })

}

function addMessage(db, jData){
        
        cUsers = db.collection('users');
        cUsers.find({"username":jData.target}).limit(1).toArray(function(err, docs){
            var jUser = docs[0];
            
            var messages = jUser.messages;
            var newMessages = jUser.newMessages;
            if(messages[jData.author]){
                messages[jData.author].push({"message":jData.message, "author":jData.realAuthor});
                newMessages.push(jData.realAuthor);
                cUsers.update({'username':jData.target},{$set:{'messages':messages, 'newMessages':newMessages}})
            }
            else{
                messages[jData.author] = [{"message":jData.message, "author":jData.realAuthor}];
                newMessages.push(jData.realAuthor);
                cUsers.update({'username':jData.target}, {$set:{'messages':messages,'newMessages':newMessages}});
            }
            
        })
}

function getMessages(db, email, username){
    return new Promise((resolve, reject) => {
        
        cUsers = db.collection('users');
         
        
        cUsers.find({"email":email}).limit(1).toArray(function(err, docs){
            
            if(docs[0].messages[username]){
            resolve(docs[0].messages[username]);
            }
            else reject("no messages");
        })
    
    })
    }
 function seenMessage(db, email,username){
    return new Promise( resolve => {
    cUsers = db.collection('users');
    cUsers.find({"email":email}).limit(1).toArray(function(err, docs){    
        var newMessages = docs[0].newMessages;
        console.log(newMessages+ "*****"+email+" ****" +username);
        var index = newMessages.indexOf(username);
        while(index > -1){
            newMessages.splice(index, 1);
            index=newMessages.indexOf(username);
        }
            cUsers.update({"email":email}, {$set: {"newMessages":newMessages}});
            resolve();
        
        
        
    })

    })
 }

 
