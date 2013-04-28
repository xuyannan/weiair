// 数据库及微信公众后台监控
var C = require('./config').config();
var Email = require('email').Email;
var db = require('mongojs').connect(C.db.url , C.db.collections);
var dateformat = require('dateformat');
var weixinmp = require('./mp.weixin.js');
var md5 = require('MD5');

var now = new Date();
var serverTime = now.getTime();
var utcTime = serverTime + now.getTimezoneOffset() * 60000;
var clientTime = utcTime + C.timezone * 3600000;
var requestTime =  new Date(clientTime);

var now_str = dateformat(requestTime, 'yyyy-mm-dd HH:MM:ss');

// 数据库
db.users.find({}, function(error, resutl) {
  if (error) {
    var msg = new Email({
      from: 'aqi@cutefool.net',
      to: 'xyn0563@gmail.com',
      subject: '[' + now_str + '] 我擦数据库挂了!',
      body: error + ''
    });
    msg.send(function(err){
      console.log(err);
    });
  } else {
    console.log('[', now_str, '] database is all right');
  }
});

// 微信公众平台
weixinmp.login({
  username: C.mp.username,
  pwd: md5(C.mp.pwd),
  callback: function(cookie, token) {
    console.log('[', now_str, '] weixin is all right');
  },
  errorback: function(res) {
    var msg = new Email({
      from: 'aqi@cutefool.net',
      to: 'xyn0563@gmail.com',
      subject: '[' + now_str + '] 微信sb了!',
      body: res + ''
    });
    msg.send(function(err){
      console.log(err);
    });
  }
});
