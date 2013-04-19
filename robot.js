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

var now = new Date();

var query_lastest_time_point = dateformat(now, 'yyyy-mm-dd-HH'));

for (var i = 0, iMax = aqiSupportCities.length; i < iMax ; i++) {
  var city = aqiSupportCities[i];
  db.aqi.find(
    {area: city, time_point: query_lastet_time_point},
    function(error, result) {
      if (error) {

      } else if (result && result.length > 0 && query_lastest_time_point == result[0].time_point_of_latest_data ) {
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
                time_point: query_lastest_time_point,
                time_point_of_latest_data: time_point_of_latest_data
              } , function(error) {
                if (error) {
                  console.log(error);
                }
              });
            } else {
              db.aqi.update({'area': city, 'time_point': query_lastest_time_point}, 
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



