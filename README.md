## Toller

### Disclaimer
Easily retrieve data from your RTA E-Toll account.
This piece of software is in no way affiliated with the RTA or any other insitution. It comes for free and I'm not held laible for anything doe with it :-)

Please be also aware that this module may break as soon as the website parse changes. I can't give any gurantees on the values returned nor will I be held responsible for any damage or whatsoever will be produced by this piece of software.

### Usage

Install `Toller` using `npm`:

```
npm install -S toller
```

then use it inside your app like any other node module:

```
var Toller = require('toller');
var toller = Toller('username', 'password');

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
```

### Example

Open up `example/example.js` for an example on how to use Toller.
You may insert your credentials and run the example using `node example.js` this should authneticate you and show your tags as well as your current statements.

### License
See [LICENSE.md](LICENSE.md).