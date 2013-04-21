var C = require('./config').config();
var AqiApi = require('chineseaqi');
var db = require('mongojs').connect(C.db.url , C.db.collections);
var chinesecities = require('chinesecities');
var dateformat = require('dateformat');

var api = new AqiApi(C.PM25APPKEY);

var aqiSupportCities = [ '上海','东莞','中山','丽水','乌鲁木齐','佛山','保定','兰州','北京','南京',
'南宁','南昌','南通','厦门','台州','合肥','呼和浩特','哈尔滨','唐山','嘉兴','大连','天津','太原','宁波',
'宿迁','常州','广州','廊坊','张家口','徐州','惠州','成都','扬州','承德','拉萨','无锡','昆明','杭州',
'武汉','江门','沈阳','沧州','泰州','济南','海口','淮安','深圳','温州','湖州','珠海','盐城','石家庄',
'福州','秦皇岛','绍兴','肇庆','舟山','苏州','衡水','衢州','西宁','西安','贵阳','连云港','邢台','邯郸',
'郑州','重庆','金华','银川','镇江','长春','长沙','青岛' ];

var usemSupportCities = ['北京', '上海', '广州', '成都'];

var getChineseDataForCity = function(city, lastest_time_point) {
  console.log('get chinese aqi data for city: ', city);
  db.aqi.find(
    {area: city, time_point: lastest_time_point},
    function(error, result) {
      if (error) {

      } else if (result && result.length > 0 && lastest_time_point == result[0].time_point_of_latest_data ) {
        // 数据已存在，不需要再次请求
      } else {
        api.getAvgPm25ForCity({
          city: city,
          callback: function(data) {
            var time_point_of_latest_data = data.time_point.substring(0, 13).replace('T', '-');
            data.time_point = data.time_point.substring(11, data.time_point.length-1);
            if (!result || result.length == 0) {
              db.aqi.save({
                area: city,
                data: data,
                time_point: lastest_time_point,
                time_point_of_latest_data: time_point_of_latest_data
              } , function(error) {
                if (error) {
                  console.log(error);
                }
              });
            } else {
              db.aqi.update({'area': city, 'time_point': lastest_time_point}, 
                  {$set: {data: data, time_point_of_latest_data: time_point_of_latest_data}},
                  function(err, updated) {
                    if (err || !updated) {
                      console.log(err);
                    } else {
                      console.log(city, ' chinese data update');
                    }
                  }
              ); 
            }

          },
          errorCallback: function() {
            console.log('error: get aqi data for ', city, ' error');
          }
        });
      }
    }
  );
};

var getUsemDataForCity = function(city, lastest_time_point) {
  console.log('get useem aqi data for city: ', city);
  db.usemaqi.find({'area': city, 'time_point': lastest_time_point}, function(error, result) {
    if(error) {
    } else if (result && result.length > 0 && lastest_time_point == result[0].time_point_of_latest_data) {
    } else {
      api.getUsemPm25ForCity({
        city: city,
        errorCallback: function() {
          console.log('no usem data for city: ', data.area);
        },
        callback: function(res) {
          var usemdata = res[0];
          var d = new Date(usemdata.time_point);
          var time_point_of_latest_data = dateformat(d, 'yyyy-mm-dd-HH');
          usemdata.time_point = dateformat(d, 'HH:00:00');
          usemdata.quality = usemdata.quality.replace(/\(.*\)/, '');
          if (!result || result.length == 0) {
            db.usemaqi.save({
              area: city,
              data: usemdata,
              time_point: lastest_time_point,
              time_point_of_latest_data: time_point_of_latest_data
            } , function(error) {
              if (error) {
                console.log('save usemaqi error: ', error);
              }
            });
          } else {
            db.usemaqi.update({'area': city, 'time_point': lastest_time_point}, 
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

var getWeatherDataForCity = function(city, lastest_time_point) {
  console.log('get weather data for city: ', city);
    db.weather.find({'area': city, 'time_point': lastest_time_point}, function(error, result) {
    if(error) {
    } else if (result && result.length > 0 && lastest_time_point == result[0].time_point_of_latest_data) {
    } else {
      api.getWeatherForCity({
        city: city,
        errorCallback: function() {
          console.log('no weather data for city: ', data.area);
        },
        callback: function(res) {
          //var weatherdata = res.weatherinfo;
          var t = res.weathinfo.ptime; // 08:00
          var time_point_of_latest_data = lastest_time_point.substring(0, 11) + '-' + t.substring(0, 2);

          var weatherdata = {
            area: res.weatherinfo.city,
            data: {
              temp1: res.weatherinfo.temp1,
              temp2: res.weatherinfo.temp2,
              weather: res.weatherinfo.weather,
              time_point: res.weatherinfo.ptime
            },
            time_point: lastest_time_point,
            time_point_of_latest_data: time_point_of_latest_data
          }

          if (!result || result.length == 0) {
            db.weather.save(weatherdata , function(error) {
              if (error) {
                console.log('save usemaqi error: ', error);
              }
            });
          } else {
            db.weather.update({'area': city, 'time_point': lastest_time_point}, 
                {$set: {data: weatherdata.data, time_point_of_latest_data: time_point_of_latest_data}},
                function(err, updated) {
                  if (err || !updated) {
                    console.log('update weaterh error: ', err);
                  } else {
                    console.log('weather data update');
                  }
                }
            ); 
          }
        }
      });
    
    }
  });
};

var updateData = function() {
  var now = new Date();
  var serverTime = now.getTime();
  var utcTime = serverTime + now.getTimezoneOffset() * 60000;
  var clientTime = utcTime + C.timezone * 3600000;
  var requestTime =  new Date(clientTime);
  var query_lastest_time_point = dateformat(requestTime, 'yyyy-mm-dd-HH');
  console.log('update data at ', dateformat(requestTime, 'yyyy-mm-dd HH:MM:ss'));
  /*
  for (var i = 0, iMax = aqiSupportCities.length; i < iMax ; i++) {
    var city = aqiSupportCities[i];
    getChineseDataForCity(city, query_lastest_time_point);
  };
  for (var i = 0, iMax = usemSupportCities.length; i < iMax ; i++) {
    var city = usemSupportCities[i];
    getUsemDataForCity(city, query_lastest_time_point);
  };
  */
  getWeatherDataForCity('北京', query_lastest_time_point);
};

updateData();

setInterval(function(){
    updateData();
}, 1000 * 60 * C.robotFrequency);



