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

var _ = require('lodash');
var express = require('express');

var root = __dirname + '/..';
var app = express();
app.use('/node_modules', express.static(root + '/node_modules'));

app.get('/', function(req, res) {
	res.sendFile('index.html', {root: __dirname});
});

app.get('/app.js', (req, res) => res.sendFile('app.js', {root: root + '/demo'}));
app.get('/app.css', (req, res) => res.sendFile('app.css', {root: root + '/demo'}));

app.get('/dist/angular-ui-query-builder.js', (req, res) => res.sendFile('angular-ui-query-builder.js', {root: root + '/dist'}));
app.get('/dist/angular-ui-query-builder.css', (req, res) => res.sendFile('angular-ui-query-builder.css', {root: root + '/dist'}));

// Generate fake data on load {{{
var faker = require('faker');
var data = [...Array(100)].map((i, offset) => ({
	id: `user${offset}`,
	name: `${faker.name.firstName()} ${faker.name.lastName()}`,
	username: faker.internet.userName(),
	email: Math.random() > 0.8
		? faker.internet.email()
		: undefined,
	address: {
		street: faker.address.streetAddress(),
		city: faker.address.city(),
		zip: faker.address.zipCode(),
		state: faker.address.state(),
		country: faker.address.country(),
	},
	phone: Math.random() > 0.5
		? faker.phone.phoneNumber()
		: undefined,
	website: Math.random() > 0.5
		? faker.internet.url()
		: undefined,
	company: Math.random() > 0.7
		? {name: faker.company.companyName()}
		: undefined,
	role:
		Math.random() > 0.3 ? 'user'
		: Math.random() > 0.3 ? 'admin'
		: 'root',
	status:
		Math.random() > 0.3 ? 'active'
		: Math.random() > 0.3 ? 'pending'
		: 'deleted',
	lastLogin: Math.random() > 0.5
		? faker.date.past()
		: faker.date.recent(),
}));
// }}}

app.get('/api/data', function(req, res) {
	var outData = [...data];

	// Very basic simulation of a ReST server to sort / mutate output data {{{

	// Sorting {{{
	if (req.query.sort) {
		if (!req.query.sort.startsWith('-')) {
			outData = _.sortBy(outData, req.query.sort);
		} else { // Sort reverse
			outData = _(outData)
				.sortBy(req.query.sort.substr(1))
				.reverse()
				.value();
		}
	}
	// }}}

	// Limiting / Skip {{{
	if (req.query.skip) outData = outData.slice(req.query.skip);
	if (req.query.limit) outData = outData.slice(0, req.query.limit);
	// }}}

	// }}}

	res.send(outData);
});

app.use(function(err, req, res, next){
	console.error(err.stack);
	res.status(500).send('Something broke!').end();
});

var port = process.env.PORT || process.env.VMC_APP_PORT || 8080;
var server = app.listen(port, function() {
	console.log('Web interface listening on port', port);
});
