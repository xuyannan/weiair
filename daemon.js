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
var exec = require('child_process').exec

var now_str = dateformat(requestTime, 'yyyy-mm-dd HH:MM:ss');

// 主服务
exec('ps -ef | grep -v grep | grep -v vim | grep node | grep weiair | grep app.js', function(error, stdout, stderr){
  if(stdout && stdout!='') {
    console.log('[', now_str, '] main service is all right');
  } else {
    var msg = new Email({
      from: 'aqi@cutefool.net',
      to: C.email,
      subject: '[' + now_str + '] 微空气主服务挂了!',
      body: error + ''
    });
    msg.send(function(err){
      console.log(err);
    });
    console.log('!!!!restart main service!!!!');
    exec('sudo start weiair', function(error, stdout, stderr){
      if (error) {
        console.log('start main service error:', error);
      }
    });
  }
});


// 数据库
db.users.find({}, function(error, resutl) {
  if (error) {
    var msg = new Email({
      from: 'aqi@cutefool.net',
      to: C.email,
      subject: '[' + now_str + '] 我擦数据库挂了!',
      body: error + ''
    });
    msg.send(function(err){
      console.log(err);
    });
    console.log('!!!!restart mongodb!!!!');
    exec('sudo /etc/init.d/mongodb start', function(error, stdout, stderr){
      if (error) {
        console.log('start mongodb error:', error);
      }
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
    db.failedpush.find({success: 0, pushtime:dateformat(requestTime, 'yyyy-mm-dd-HH')}, function(error, result){
      if(error) {
      } else if(result && result.length > 0) {
        for(var i = 0, iMax = result.length; i < iMax; i++) {
          var res = result[i];
          repush({
            cookie: cookie,
            token: token,
            msg: res
          });
        }
      }
    });
  },
  errorback: function(res) {
    var msg = new Email({
      from: 'aqi@cutefool.net',
      to: C.email,
      subject: '[' + now_str + '] 微信sb了!',
      body: res + ''
    });
    msg.send(function(err){
      console.log(err);
    });
  }
});

// 重新push发送失败的
var repush = function(params) {
  console.log('repushing: ', params.msg);
  weixinmp.pushTextMessage({
    cookie: params.cookie,
    token: params.token,
    content: params.msg.content,
    tofakeid: params.msg.tofakeid,
    errorCallback: function() {
    },
    callback: function() {
      params.msg.success = 1;
      db.failedpush.save(params.msg, function(err) {});
    }
  });
};

setTimeout(function(){
  console.log('exit daemon');
  process.exit(0);
}, 0.5*60*1000
);
