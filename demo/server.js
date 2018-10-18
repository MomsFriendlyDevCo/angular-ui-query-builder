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
var sift = require('sift').default;

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


/**
* Apply a simple ReST server filter
* @param {array} data The data to filter
* @param {Object} [query] The query to apply
* @param {string} [query.sort] Sorting criteria to apply - if this has the '-' prefix it will be reversed
* @param {number} [query.limit] Record limitation
* @param {number} [query.skip] Record skipping
* @param {*} [query.*] Additional MongoDB / Sift compatible filters to apply
* @returns {array} The input data with the applied filters / mutators
*/
var applyFiltering = (data, query) => {
	var metaParams = ['sort', 'limit', 'skip'];
	var metaOperations = _.pick(query, metaParams);
	var query = _.omit(query, metaParams);

	// console.log('applyFiltering', {metaOperations, query});

	return _(data)
		// Filtering (handled by sift) {{{
		.thru(d => {
			return sift(query, data);
		})
		// }}}
		// Sorting {{{
		.thru(d => {
			if (!metaOperations.sort) return d;
			if (!metaOperations.sort.startsWith('-')) {
				return _.sortBy(d, metaOperations.sort);
			} else { // Sort reverse
				return _(d)
					.sortBy(metaOperations.sort.substr(1))
					.reverse()
					.value();
			}
		})
		// }}}
		// Limit {{{
		.thru(d =>
			metaOperations.limit ?  d.slice(0, metaOperations.limit) : d
		)
		// }}}
		// Skip {{{
		.thru(d =>
			metaOperations.skip ? d.slice(metaOperations.skip) : d
		)
		// }}}
		.value()
};

app.get('/api/data', (req, res) => res.send(applyFiltering(data, req.query)));

app.get('/api/count', (req, res) => res.send({count: applyFiltering(data, req.query).length}));

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
