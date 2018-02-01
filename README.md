angular-ui-query-builder
========================
MongoDB format query-builder UI component for Angular.

[Demo](https://momsfriendlydevco.github.io/angular-ui-query-builder).


Installation
------------
1. Grab the NPM

```shell
npm install --save @momsfriendlydevco/angular-ui-query-builder
```


2. Install the required script + CSS somewhere in your build chain or include it in a HTML header:

```html
<script src="/libs/angular-ui-query-builder/dist/angular-ui-query-builder.min.js"/>
<link href="/libs/angular-ui-query-builder/dist/angular-ui-query-builder.min.css" rel="stylesheet" type="text/css"/>
```

3. Include the router in your main `angular.module()` call:

```javascript
var app = angular.module('app', ['angular-ui-query-builder'])
```

4. Use somewhere in your template:

```html
<ui-query-builder query="$ctrl.myQuery" spec="$ctrl.mySpec"></ui-query-builder>
```

A demo is also available. To use this [follow the instructions in the demo directory](./demo/README.md).


API
====

ui-query-builder (directive)
----------------------------
Simply create a query object and link it up to the directive.

In a controller:

```javascript
$scope.mySpec = {
	_id: {type: 'objectId'},
	name: {type: 'string'},
	email: {type: 'string'},
	status: {type: 'string', enum: ['pending', 'active', 'deleted']},
};

$scope.myQuery = {
	status: 'active', // Assumes you have a status field
	limit: 10,
	skip: 0,
};
```

In a HTML template:

```html
<ui-query-builder query="$ctrl.myQuery" spec="$ctrl.mySpec"></ui-query-builder>
```

... or see the [Demo](https://momsfriendlydevco.github.io/angular-ui-query-builder).

The ui-query-builder directive takes the following parameters:

| Parameter | Type   | Description                                                                           |
|-----------|--------|---------------------------------------------------------------------------------------|
| `query`   | Object | The current query, this object will be mutated into / from a MongoDB compatible query |
| `spec`    | Object | A base specification of field types to use when providing the UI                      |


qb-table, qb-col, qb-pagination (directives)
--------------------------------------------
If using either the full JS release (`angular-ui-query-builder.js`) or the table add-on (`angular-ui-query-builder-tables.js`) additional functionality is provided for Tables including column setup, pagination and other functionality.

To use:

1. Add the `qb-table` directive to the table header with a pointer to the query object to mutate
2. (Optional) Add the `qb-col` directive to any table column to extend, include attributes like `sortable` to add that functionality
3. (Optional) Add the `qb-pagination` directive into the table footer to add pagination functionality

For example:

```html
<table class="table table-bordered table-striped table-hover" qb-table="query">
	<thead>
		<tr>
			<th qb-col="name" sortable>Name</th>
			<th qb-col="username" sortable>Username</th>
			<th qb-col="email" sortable>Email</th>
		</tr>
	</thead>
	<tbody>
		<tr ng-repeat="row in data track by row.id">
			<td>{{row.name}}</td>
			<td>{{row.username}}</td>
			<td>{{row.email}}</td>
		</tr>
	</tbody>
	<tfoot>
		<tr>
			<td colspan="3">
				<qb-pagination></qb-pagination>
			</td>
		</tr>
	</tfoot>
</table>
```

For a more complex example see the [demo](https://momsfriendlydevco.github.io/angular-ui-query-builder).


qb-table (directive)
--------------------
Use on a `<table/>` element to designate that it should be managed by this module.

Valid attributes are:

| Attribute      | Type      | Description                                                                               |
|----------------|-----------|-------------------------------------------------------------------------------------------|
| `qb-table`     | `Object`  | The main query object to mutate when the table is interacted with                         |
| `sticky-thead` | `boolean` | Indicates that the `<thead/>` portion of the table should remain on screen when scrolling |
| `sticky-tfoot` | `boolean` | Indicates that the `<tfoot/>` portion of the table should remain on screen when scrolling |



TODO
====

* [x] Basic field filtering
* [ ] CSS tidyup
* [ ] Compound queries - `$or` / `$and`
* [x] Automatically moving from a static string (`$eq` condition) to a multiple choice enum (`$in`) when a comma is used in a string
* [ ] Convert string ENUMs to a `$in` type automatically
* [ ] Number filtering - above, below, between
* [x] Date support - date selector, before, after
* [ ] Nicer syntax support for `$regexp`
* [ ] Support for `$length`
* [ ] Nicer multi level path support
