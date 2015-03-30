'use strict';

var Toller = require('../index.js');

var username = '';
var password = '';

var toller = new Toller(username, password);

toller.getCustomerDetails()
.then(function (details) {
  console.log('Customer Details:\n', details);
  return toller.getAllTags();
})
.then(function (tags) {
  console.log('Tags:\n', tags);
  return toller.getAccountDetails();
})
.then(function (details) {
  console.log('Account Details:\n', details);
  return toller.getAllStatements();
})
.then(function (statements) {
    console.log('Statements:\n', statements);
})
.error(function (err) {
  console.log('Error:\n', err);
});