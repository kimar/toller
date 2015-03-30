'use strict';

var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));
var cheerio = Promise.promisifyAll(require('cheerio'));

/**
 * Returns instance of Toller
 * 
 * @param  {String} Username
 * @param  {String} Password
 * @return {Object} An instance of Toller
 */
var Toller = module.exports = function Toller (username, password) {
  this.username = username;
  this.password = password;
  this.cookie = request.jar();
  this.baseurl = 'https://myrta.com/myEToll/secure';
  this.headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0'
  };
};

/**
 * Check whether 'Location' field of response header points to login page
 * 
 * @param  {String} location Location header value
 * @return {Boolean}         true or false
 */
var authenticationNeeded = function (location, body) {
  if (/Action=externalETollHomepage/.test(location)) {
    return true;
  }
  if (typeof body !== 'undefined' && /RTA redirect/.test(body)) {
    return true;
  }
  return false;
};

/**
 * Converts RTA date string to Date() parseable string
 * E.g.: 27/03/2015 12:12:00 will be 27.03.2015 12:12:00
 * 
 * @param  {String} dateString The date string
 * @return {String}            Formatted date string
 */
var parseableDateString = function (dateString) {
  var dateRegex = /([0-9]{2})\/([0-9]{2})\/([0-9]{4}) ([0-9:]+$)/;
  var dateReplace = '$3.$2.$1 $4';
  if (dateString) {
    dateString = dateString.replace(dateRegex, dateReplace);
  }
  return dateString;
}

/**
 * Converts a date string to a unix timestamp
 * @param  {String} dateString Input date string
 * @return {Integer}           Unix time stamp
 */
var dateStringToTimestamp = function (dateString) {
  var timeStamp;
  if (dateString) {
    try {
      timeStamp = Math.round(new Date(dateString).getTime() / 1000);
    } catch (e) {
      timeStamp = ''
    }
  };
  return timeStamp;
}

/**
 * Instantiates a GET request with form data to given path
 * 
 * @param  {String} path A string pointing to the path
 * @param  {Function} Callback function
 * @return {Promise} Returns a bluebird promise
 */
Toller.prototype.getRequest = function (path, cb) {
  return new Promise(function (resolve, reject) {
    var params = {
      headers: this.headers,
      jar: this.cookie
    };
    request.getAsync(this.baseurl + path, params)
    .then(function (httpResponse) {
      var location = httpResponse[0].headers.location;
      var body = httpResponse[0].body;
      if (authenticationNeeded(location, body)) {
        this.authenticate()
        .then(function (location) {
          return this.getRequest(path, cb);
        }.bind(this))
        .then(function (body) {
          resolve(body);
        })
        .error(function (err) {
          reject(err);
        });
        return;
      }
      resolve(body);
    }.bind(this))
    .error(function (err) {
      reject(err);
    });
  }.bind(this)).nodeify(cb);
};

/**
 * Instantiates a POST request with form data to given path
 * 
 * @param  {Object} form A form-data object
 * @param  {String} path A string pointing to the path
 * @param  {Function} Callback function
 * @return {Promise} Returns a bluebird promise
 */
Toller.prototype.postRequest = function (form, path, cb) {
  return new Promise(function (resolve, reject) {
    var params = {
      form: form,
      headers: this.headers,
      jar: this.cookie
    };
    request.postAsync(this.baseurl + path, params)
    .then(function (httpResponse) {
      var location = httpResponse[0].headers.location;
      var body = httpResponse[0].body;
      if (authenticationNeeded(location)) {
        this.authenticate()
        .then(function (location) {
          return this.postRequest(form, path, cb);
        }.bind(this))
        .then(function (body) {
          resolve(body);
        })
        .error(function (err) {
          reject(err);
        });
        return;
      }
      resolve(body);
    }.bind(this))
    .error(function (err) {
      reject(err);
    });
  }.bind(this)).nodeify(cb);
};

/**
 * Instantiates a request used for account details
 * 
 * @param  {Function} Callback
 * @return {Promise} A bluebird promise
 */
Toller.prototype.accountDetailsRequest = function (cb) {
  return this.getRequest('/viewAccountDetails.do?action=viewAccountDetails', cb);
};

/**
 * Instantiates a request used for customer details
 * 
 * @param  {Function} Callback
 * @return {Promise} A bluebird promise
 */
Toller.prototype.customerDetailsRequest = function (cb) {
  return this.getRequest('/manageCustomer.do?action=doDisplayCustomerDetailsReadOnly', cb);
};

/**
 * Instantiates a request used for statements
 * 
 * @param  {Function} Callback
 * @return {Promise} A bluebird promise
 */
Toller.prototype.tagUsageRequest = function (cb) {
  return this.postRequest({
    action: 'tagUsage',
    format: 'none'
  }, '/statements.do', cb);
};

/**
 * Instantiates a request used for all tags
 * 
 * @param  {Function} Callback
 * @return {Promise} A bluebird promise
 */
Toller.prototype.listAllTagsRequest = function (cb) {
  return this.postRequest({
    action: 'searchTagDetails',
    tagServiceId: '',
    listAllTagsSelected: 'on'
  }, '/manageTagDetails.do', cb);
};

/**
 * Performs authentication against myrta.com
 * 
 * @param  {Function} Callback
 * @return {[Promise]} A bluebird promise
 */
Toller.prototype.authenticate = function (cb) {
  return new Promise(function (resolve, reject) {
    var url = this.baseurl + '/guiLogin.do';
    var params = {
      form: {
        username: this.username,
        password: this.password
      },
      headers: this.headers,
      jar: this.cookie
    };
    
    request.postAsync(url, params)
    .then(function (httpResponse, body) {
      var statusCode = httpResponse[0].statusCode;
      var location = httpResponse[0].headers.location;
      if (statusCode !== 302) {
        return reject(new Error('Wrong status code when authenticating, expected 302 and location headers.'));
      }
      if (typeof location !== 'string') {
        return reject(new Error('Expected location header'));
      }
      resolve(location);
    })
    .error(function (err) {
      reject(err);
    });
  }.bind(this)).nodeify(cb);
};

/**
 * Get RTA account details
 * 
 * @param  {Function} Callback
 * @return {[Promise]} A bluebird promise
 */
Toller.prototype.getAccountDetails = function (cb) {
  return new Promise(function (resolve, reject) {
    this.accountDetailsRequest()
    .then(function (body) {
      var $ = cheerio.load(body);
      var table = $('.borderTable');
      var data = {};
      var index = 0;
      table.children('tr').each(function () {
        var value = $(this).children('td').eq(1);
        if (!value) {
           return;
         }
        var sanitizedValue = value.text().trim();
        switch (index) {
          case 0:
            data["tagCount"] = parseInt(sanitizedValue);
            break;
          case 1:
           data["accountType"] = sanitizedValue;
           break;
          case 2:
            data["accountCredit"] = parseFloat(sanitizedValue.replace(/^(.(?!\d)|\D)+/, ''));
            break;
          case 3:
            data["topupAmount"] = parseFloat(sanitizedValue.replace(/^(.(?!\d)|\D)+/, ''));
            break;
          case 4:
            data["topupTrigger"] = parseFloat(sanitizedValue.replace(/^(.(?!\d)|\D)+/, ''));
            break;
        }
        index++;
      });
      resolve(data);
    })
    .error(function (err) {
      reject(err);
    });
  }.bind(this)).nodeify(cb);
};

/**
 * Get RTA customer details
 * 
 * @param  {Function} Callback
 * @return {[Promise]} A bluebird promise
 */
Toller.prototype.getCustomerDetails = function (cb) {
  return new Promise(function (resolve, reject) {
    this.customerDetailsRequest()
    .then(function (body) {
      var $ = cheerio.load(body);
      var data = {};
      var index = 0;
      var table = $('.label').parents('table').first();
      // console.log(table.html());
      table.children('tr').each(function () {
        var value = $(this).children('td').eq(1);
        if (!value) {
          return;
        }
        var sanitizedValue = value.text().trim();
        switch (index) {
          case 1:
            data["title"] = sanitizedValue;
            break;
          case 2:
            data["firstNames"] = sanitizedValue;
            break;
          case 3:
            data["lastName"] = sanitizedValue;
            break;
          case 4:
            data["driverLicenseNumber"] = sanitizedValue;
            break;
          case 7:
            if (!data["mailingAddress"]) {
              data["mailingAddress"] = {};
            }
            data["mailingAddress"]["street"] = sanitizedValue;
            break;
          case 8:
            if (!data["mailingAddress"]) {
              data["mailingAddress"] = {};
            }
            data["mailingAddress"]["suburb"] = sanitizedValue;
            break;
          case 9:
            if (!data["mailingAddress"]) {
              data["mailingAddress"] = {};
            }
            data["mailingAddress"]["state"] = sanitizedValue;
            break;
          case 10:
            if (!data["mailingAddress"]) {
              data["mailingAddress"] = {};
            }
            data["mailingAddress"]["postcode"] = sanitizedValue;
            break;
          case 13:
            if (!data["tagDeliveryAddress"]) {
              data["tagDeliveryAddress"] = {};
            }
            data["tagDeliveryAddress"]["street1"] = sanitizedValue;
            break;
          case 14:
            if (!data["tagDeliveryAddress"]) {
              data["tagDeliveryAddress"] = {};
            }
            data["tagDeliveryAddress"]["street2"] = sanitizedValue;
            break;
          case 15:
            if (!data["tagDeliveryAddress"]) {
              data["tagDeliveryAddress"] = {};
            }
            data["tagDeliveryAddress"]["suburb"] = sanitizedValue;
            break;
          case 16:
            if (!data["tagDeliveryAddress"]) {
              data["tagDeliveryAddress"] = {};
            }
            data["tagDeliveryAddress"]["state"] = sanitizedValue;
            break;
          case 17:
            if (!data["tagDeliveryAddress"]) {
              data["tagDeliveryAddress"] = {};
            }
            data["tagDeliveryAddress"]["postcode"] = sanitizedValue;
            break;
        }
        index++;
      });
      resolve(data);
    })
    .error(function (err) {
      reject(err);
    });
  }.bind(this)).nodeify(cb);
};

/**
 * Gets all statements
 * 
 * @param  {Function} Callback
 * @return {Promise} A bluebird promise
 */
Toller.prototype.getAllStatements = function (cb) {
  return new Promise(function (resolve, reject) {
    this.tagUsageRequest()
    .then(function (body) {
      var $ = cheerio.load(body);
      var table = $('#headerDate').parents('table').first();
      var data = [];
      table.children('tr').each(function () {
          var buffer = [];
          $(this).find('td').each(function () {
            buffer.push($(this).text().trim());
          });
          data.push({
            time: new Date(parseableDateString(buffer[0])),
            place: buffer[1],
            lane: buffer[2],
            toll: parseFloat(buffer[3]),
          });
      });
      data = data.slice(1, data.length - 1);
      resolve(data);
    })
    .error(function (err) {
      reject(err);
    });
  }.bind(this)).nodeify(cb);
};

/**
 * Lists all tags
 * 
 * @param  {Function} Callback
 * @return {Promise} A bluebird promise
 */
Toller.prototype.getAllTags = function (cb) {
  return new Promise(function (resolve, reject) {
    this.listAllTagsRequest()
    .then(function (body) {
      var $ = cheerio.load(body);
      var table = $('#headerTagId').parents('table').first();
      var data = [];
      table.children('tr').each(function () {
          var buffer = [];
          $(this).find('td').each(function () {
            buffer.push($(this).text().trim());
          });
          data.push({
            id: buffer[0],
            vehicleClass: buffer[1],
            status: buffer[2]
          });
      });
      data = data.slice(1, data.length);
      resolve(data);
    })
    .error(function (err) {
      reject(err);
    });
  }.bind(this)).nodeify(cb);
}