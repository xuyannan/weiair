
/**
 * Module dependencies.
 */
var C = require('./config').config();
var express = require('express')
  , routes = require('./routes');
var url = require('url');
var sha1 = require('sha1');
var dateformat = require('dateformat');
var wechat = require('wechat');
var http = require('http');
var connect = require('connect');
var chinesecities = require('chinesecities');
var md5 = require('MD5');
var db = require('mongojs').connect(C.db.url , C.db.collections);
var weixinmp = require('./mp.weixin.js');

var app = module.exports = express.createServer();

var tool = require('./aqitool.js');
app.get('/', function(req, res) {
    var signature = req.query.signature;
    var timestamp = req.query.timestamp;
    var nonce = req.query.nonce;
    var echostr = req.query.echostr;
    res.send(echostr);
});
var port = 3000;
app.listen(port);
console.log("Express server listening on port %d", port);
