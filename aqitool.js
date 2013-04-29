
var AqiApi = require('chineseaqi');
var C = require('./config').config();
var db = require('mongojs').connect(C.db.url , C.db.collections);
var api = new AqiApi(C.PM25APPKEY);
var ejs = require('ejs');
var dateformat = require('dateformat');

var getRealnameByNickname = function(nickname) {
  var names = {
    '帝都': '北京',
    '魔都': '上海',
  };
  if (!! names[nickname]) {
    return names[nickname];
  } else {
    return nickname;
  }
};

var tpl = '<%=area%>';
tpl += '<%if (!!chinese && chinese.aqi!= undefined) {%>\n\r[污染指数] <%=chinese.aqi%>\n\r[pm2.5浓度] <%=chinese.pm2_5%>\n\r[空气质量] <%=chinese.quality%> \n\r[更新时间] <%=chinese.time_point%><%}%>\n\r数据来自http://pm25.in';
tpl += '<%if (!!usem) {%>\n\r\n\r美使馆数据\n\r[污染指数] <%=usem.aqi%>\n\r[pm2.5浓度] <%=usem.pm2_5%>\n\r[空气质量] <%=usem.quality%> \n\r[更新时间] <%=usem.time_point%><% } %>';
tpl += '<%if (!!weather) {%>\n\r\n\r天气预报\n\r<%=weather.weather%> <%=weather.temp1%>~<%=weather.temp2%><%}%>\n\r[更新时间] <%=weather.ptime%>'

var sendMessage = function(data, res) {
  if (!data.chinese && !data.usem && !data.weather) {
    res.reply('Sorry，目前没有这个地方的空气污染指数或天气数据，换个别的城市试试~');
    return ;
  }
  var compiled = ejs.compile(tpl);
  var message = compiled(data);
  res.reply(message);
  console.log('message send');

};

var getWeatherData = function(params) {
  var data = params.data;
  api.getWeatherForCity({
    city: data.area,
    callback: function(weatherData) {
      if (params.callback && typeof(params.callback) == 'function') {
        params.callback(data, weatherData);
      }
    },
    errorCallback: function() {
      console.log('get weather data for ', data.area, ' error');
      if (params.errorCallback && typeof(params.errorCallback) == 'function') {
        params.errorCallback(data);
      }
    }
  });
  
};

var getUsemData = function(params) {
  var data = params.data;
  var request_time = params.request_time;
  db.usemaqi.find({'area': data.area, 'time_point': request_time}, function(error, result) {
    if(error) { // 数据库down掉的时候直接从网络获取数据
      console.log('mongodb is down while getUsemData for city ', data.area);
      api.getUsemPm25ForCity({
        city: data.area,
        errorCallback: function() {
          console.log('no usem data for city: ', data.area);
          params.next({
            area: data.area,
            chinese: data.chinese,
            usem: null
          });
        },
        callback: function(res) {
          var usemdata = res[0];
          var d = new Date(usemdata.time_point);
          var time_point_of_latest_data = dateformat(d, 'yyyy-mm-dd-HH');
          usemdata.time_point = dateformat(d, 'HH:00:00');
          usemdata.quality = usemdata.quality.replace(/\(.*\)/, '');
          params.next({
            area: data.area,
            chinese: data.chinese,
            usem: usemdata
          });
        }
      });
    } else if (result && result.length > 0 && request_time == result[0].time_point_of_latest_data) {
        console.log('命中usem cache');
        data.usem = result[0].data;
        params.next({
          area: data.area,
          chinese: data.chinese,
          usem: result[0].data
        });
    } else {
      api.getUsemPm25ForCity({
        city: data.area,
        errorCallback: function() {
          console.log('no usem data for city: ', data.area);
          params.next({
            area: data.area,
            chinese: data.chinese,
            usem: null
          });
        },
        callback: function(res) {
          var usemdata = res[0];
          var d = new Date(usemdata.time_point);
          var time_point_of_latest_data = dateformat(d, 'yyyy-mm-dd-HH');
          usemdata.time_point = dateformat(d, 'HH:00:00');
          usemdata.quality = usemdata.quality.replace(/\(.*\)/, '');
          params.next({
            area: data.area,
            chinese: data.chinese,
            usem: usemdata
          });
          if (!result || result.length == 0) {
            db.usemaqi.save({
              area: data.area,
              data: usemdata,
              time_point: request_time,
              time_point_of_latest_data: time_point_of_latest_data
            } , function(error) {
              if (error) {
                console.log('save usemaqi error: ', error);
              }
            });
          } else {
            db.usemaqi.update({'area': data.area, 'time_point': request_time}, 
                {$set: {data: usemdata, time_point_of_latest_data: time_point_of_latest_data}},
                function(err, updated) {
                  if (err || !updated) {
                    console.log('update usemaqi error: ', err);
                  } else {
                    console.log('usem data update');
                  }
                }
            ); 
          }
        }
      });
    
    }
  });
};

var getChineseData = function(params) {
  db.aqi.find({'area': params.city, 'time_point': params.time_point}, function(error, result) {
    if (error) { // 数据库down掉的话，直接从网络获取数据
      console.log('mongodb down while getChineseData for ', params.city);
      api.getAvgPm25ForCity({city: params.city, 
        callback: function(data){
          var time_point_of_latest_data = data.time_point.substring(0, 13).replace('T', '-');
          data.time_point = data.time_point.substring(11, data.time_point.length-1);
          params.next({
              area: params.city,
              chinese: data,
              usem: null
          });
        },
        errorCallback: function(data) {
          console.log('no chinese data for ', params.city);
          params.next({
            area: params.city,
            chinese: null
          });
        }
      });

    } else if (result && result.length > 0 && params.time_point == result[0].time_point_of_latest_data ) {
      console.log('命中chinese cache');
      params.next({
          area: params.city,
          chinese: result[0].data,
          usem: null
      });
    } else {
      api.getAvgPm25ForCity({city: params.city, 
        callback: function(data){
          var time_point_of_latest_data = data.time_point.substring(0, 13).replace('T', '-');
          data.time_point = data.time_point.substring(11, data.time_point.length-1);
          // data.time_point = '14:00:00';
          params.next({
              area: params.city,
              chinese: data,
              usem: null
          });
          if (!result || result.length == 0) {
            db.aqi.save({
              area: params.city,
              data: data,
              time_point: params.time_piont,
              time_point_of_latest_data: time_point_of_latest_data
            } , function(error) {
              if (error) {
                console.log(error);
              }
            });
          } else {
            db.aqi.update({'area': params.city, 'time_point': params.time_point}, 
                {$set: {data: data, time_point_of_latest_data: time_point_of_latest_data}},
                function(err, updated) {
                  if (err || !updated) {
                    console.log(err);
                  } else {
                    console.log('chinese data update');
                  }
                }
            ); 
          }
        },
        errorCallback: function(data) {
          console.log('no chinese data for ', params.city);
          params.next({
            area: params.city,
            chinese: null
          });
        }
      });
    } 
  });
};

module.exports = {
  getChineseData: getChineseData,
  getUsemData: getUsemData,
  getWeatherData: getWeatherData,
  sendMessage: sendMessage,
  getRealnameByNickname: getRealnameByNickname,
  template: tpl
};
