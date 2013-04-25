var C = require('./config').config();
var weixinmp = require('./mp.weixin.js');
var db = require('mongojs').connect(C.db.url , C.db.collections);
var md5 = require('MD5');
var dateformat = require('dateformat');
var tool = require('./aqitool.js');
var ejs = require('ejs');


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
                tofakeid: sub.userid
              });
            },
            errorCallback: function(aqiData) {
              var compiled = ejs.compile(tool.template);
              var message = compiled(aqiData);
              weixinmp.pushTextMessage({
                cookie: cookie,
                token: token,
                content: message,
                tofakeid: sub.userid
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
  console.log('pushin messages at ', queryTimePoint);
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
/*
setInterval(function(){
  pushTextMessages();
},60 * 1000);
*/
