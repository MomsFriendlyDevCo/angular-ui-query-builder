#!/usr/bin/env node
/**
* Extremely simple static website serving script
* This is provided in case you need to deploy a quick demo
*
* Install + run:
*
* 		# from parent directory
*
*		cd demo
*		npm install
*		node server
*
*/

var express = require('express');

var root = __dirname + '/..';
var app = express();
app.use('/node_modules', express.static(root + '/node_modules'));

app.get('/', function(req, res) {
	res.sendFile('index.html', {root: __dirname});
});

app.get('/app.js', function(req, res) {
	res.sendFile('app.js', {root: root + '/demo'});
});

app.get('/dist/angular-ui-query-builder.js', function(req, res) {
	res.sendFile('angular-ui-query-builder.js', {root: root + '/dist'});
});

app.get('/dist/angular-ui-query-builder.css', function(req, res) {
	res.sendFile('angular-ui-query-builder.css', {root: root + '/dist'});
});

// Generate fake data on load {{{
var faker = require('faker');
var data = [...Array(100)].map((i, offset) => ({
	id: `user${offset}`,
	name: `${faker.name.firstName()} ${faker.name.lastName()}`,
	username: faker.internet.userName(),
	email: faker.internet.email(),
	address: {
		street: faker.address.streetAddress(),
		city: faker.address.city(),
		zip: faker.address.zipCode(),
		state: faker.address.state(),
		country: faker.address.country(),
	},
	phone: Math.random < 0.7
		? faker.phone.phoneNumber()
		: undefined,
	website: Math.random() > 0.5
		? faker.internet.url()
		: undefined,
	company: Math.random() > 0.5
		? {name: faker.company.companyName()}
		: undefined,

}));
console.log('DATA', data);
// }}}

app.get('/api/data', function(req, res) {
	// FIXME: Insert really dumb ReST server like function here
	res.send(data);
});

app.use(function(err, req, res, next){
	console.error(err.stack);
	res.status(500).send('Something broke!').end();
});

var port = process.env.PORT || process.env.VMC_APP_PORT || 8080;
var server = app.listen(port, function() {
	console.log('Web interface listening on port', port);
});
