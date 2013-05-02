var C = require('./config').config();
var weixinmp = require('./mp.weixin.js');
var db = require('mongojs').connect(C.db.url , C.db.collections);
var md5 = require('MD5');
var dateformat = require('dateformat');
var tool = require('./aqitool.js');
var ejs = require('ejs');

var saveFailedPush = function(params) {
  db.failedpush.find({pushtime: params.queryTimePoint, tofakeid: params.tofakeid}, function(error, result){
    if (error) {
    } else if(result && result.length > 0) {
    } else {
      db.failedpush.save({
        pushtime: params.pushtime,
        content: params.content,
        tofakeid: params.tofakeid,
        success: 0
      }, function(error){
        
      });
    }
  });
};


var sendMessage = function(cookie, token, sub, queryTimePoint) {
  tool.getChineseData({
    city: sub.city,
    time_point: queryTimePoint,
    next: function(data) {
      tool.getUsemData({
        data: data, 
        request_time: queryTimePoint,
        next: function(data) {
          tool.getWeatherData({
            data: data,
            callback: function(aqiData, weatherData){
              aqiData.weather = weatherData.weatherinfo;
              var compiled = ejs.compile(tool.template);
              var message = compiled(aqiData);
              weixinmp.pushTextMessage({
                cookie: cookie,
                token: token,
                content: message,
                tofakeid: sub.userid,
                errorCallback: function() {
                  saveFailedPush({
                    content: message,
                    tofakeid: sub.userid,
                    pushtime: queryTimePoint
                  });
                }
              });
            },
            errorCallback: function(aqiData) {
              var compiled = ejs.compile(tool.template);
              var message = compiled(aqiData);
              weixinmp.pushTextMessage({
                cookie: cookie,
                token: token,
                content: message,
                tofakeid: sub.userid,
                errorCallback: function() {
                  saveFailedPush({
                    content: message,
                    tofakeid: sub.userid,
                    pushtime: queryTimePoint
                  });
                }
              });
            }
          });
        }
      });
    }
  });
};


var pushTextMessages = function() {
  var now = new Date();
  var serverTime = now.getTime();
  var utcTime = serverTime + now.getTimezoneOffset() * 60000;
  var clientTime = utcTime + C.timezone * 3600000;
  var requestTime =  new Date(clientTime);
  var queryTimePoint = dateformat(requestTime, 'yyyy-mm-dd-HH');
  var hour = dateformat(requestTime, 'H');
  var fullHour = dateformat(requestTime, 'HH');
  console.log('pushing messages at ', queryTimePoint);
  db.subscribe.find({pushtime: {$in: [hour, fullHour] }}, function(error, result){
    if (error) {
      console.log(error);
    } else if (result && result.length > 0) {
      weixinmp.login({username: C.mp.username, pwd: md5(C.mp.pwd),
        callback: function(cookie, token) {
          for(var i = 0, iMax = result.length; i < iMax; i ++) {
            var sub = result[i];
            console.log(sub);
            sendMessage(cookie, token, sub, queryTimePoint);
          }
        
        }
      });
    }
  });
};

pushTextMessages();
setTimeout(function(){
  console.log('exit push process');
  process.exit(0);
}, 0.5*60*1000
);
/*
weixinmp.login({username: C.mp.username, pwd: md5(C.mp.pwd),
  callback: function(cookie, token) {
    weixinmp.pushTextMessage({
      cookie: cookie,
      token: token,
      content: 'aaaaa',
      tofakeid: '14114475',
      errorCallback: function() {
        saveFailedPush({
          content: 'error message',
          tofakeid: '14114475',
          pushtime: '2013-05-02-11' 
        });
      }
    });
  
  }
});
*/
