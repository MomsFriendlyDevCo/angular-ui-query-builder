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
var data = require('./testData');

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

app.get('/api/data', function(req, res) {
	var outData = [...data];

	// Very basic simulation of a ReST server to sort / mutate output data {{{

	// Filtering {{{
	var dataFilter = _(req.query)
		.omit(['sort', 'skip', 'limit'])
		.pickBy(v => _.isString(v) || _.isNumber(v)) // Ignore all complex queries - yes this is wrong but we can't aford to include a full Mongo stack here
		.value()

	outData = _.filter(outData, dataFilter);
	// }}}

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

app.get('/api/count', function(req, res) {
	res.send({count: data.length});
});

app.get('/api/data/export', function(req, res) {
	res.send(`
		<html>
			<head>
				<title>Export data</title>
			</head>
			<body>
				<p><strong>Beep Boop. I'm pretending to be a data-server</strong></p>
				<p>At this point I would export data matching the ReST (like) query below:</p>
	` + '<pre>' + JSON.stringify(req.query, null, '\t') + '</pre>' + `
			</body>
		</html>
	`);
});

app.use(function(err, req, res, next){
	console.error(err.stack);
	res.status(500).send('Something broke!').end();
});

var port = process.env.PORT || process.env.VMC_APP_PORT || 8080;
var server = app.listen(port, function() {
	console.log('Web interface listening on port', port);
});
