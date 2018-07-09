'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

angular.module('angular-ui-query-builder', [])

// Service: QueryBuilder {{{
.service('QueryBuilder', function () {
	var QueryBuilder = this;

	/**
 * Apply various tidy functions to a raw spec before we process it
 * @param {Object} spec The raw spec to clean
 * @returns {Object} The output spec post cleaning
 */
	QueryBuilder.cleanSpec = function (spec) {
		return _(spec).mapValues(function (v, k) {
			return {
				type: v.type,
				enum: _(v.enum).map(function (e) {
					return _.isString(e) ? { id: e, title: _.startCase(e) } : e;
				}).sortBy('title').value()
			};
		}).value();
	};

	/**
 * List of additional properties that we support but need special treatment
 * @var {Object} Each key is the property name with additional details in the Object value
 * @param {string} [type='hidden'] How to handle each property within the UI
 * @param {boolean} [canDelete=true] Disable deletion on the field
 * @param {*} [...] Other inherited properties (see QueryBuilder.queryToArray) for examples
 */
	QueryBuilder.metaProperties = {
		limit: {
			type: 'keyVal',
			actions: [{ id: '$eq', title: 'Equals' }],
			action: '$eq',
			canDelete: true
		},
		populate: { type: 'hidden' },
		skip: {
			type: 'keyVal',
			actions: [{ id: '$eq', title: 'Equals' }],
			action: '$eq',
			canDelete: true
		},
		sort: {
			type: 'keyVal',
			actions: [{ id: '$eq', title: 'Equals' }],
			action: '$eq',
			canDelete: false
		}
	};

	/**
 * Returns a queryList collection from a query object
 * @param {Object} query The raw MongoDB / Sift object to transform from an object into a collection
 * @returns {array} An array where each parameter is represented as a object for easier handling
 */
	QueryBuilder.queryToArray = function (query, spec) {
		// Actions applicable to all fields {{{
		var actions = [{ id: '$eq', title: 'Equals' }, { id: '$neq', title: 'Doesnt equal' }, { id: '$lt', title: 'Is less than' }, { id: '$lte', title: 'Is equal to or less than' }, { id: '$gt', title: 'Is greater than' }, { id: '$gte', title: 'Is equal or greater than' }, { id: '$in', title: 'Is one of' }, { id: '$nin', title: 'Is not one of' }, { id: '$exists', title: 'Has a value' }, { id: '$nexists', title: 'Does not have a value' }];
		// }}}

		return _(query).pickBy(function (v, k) {
			var maps = spec[k] // Maps onto a spec path
			|| k == '$and' || k == '$or' || QueryBuilder.metaProperties[k]; // is a meta directive

			if (!maps) console.warn('query-builder', 'Incomming query path', k, 'Does not map to anything in spec', spec);
			return !!maps;
		}).map(function (v, k) {
			var s = spec[k];
			var firstKey = _.isObject(v) && _(v).keys().first();
			var firstValue = _.isObject(v) ? _(v).values().first() : v;

			if ( // Looks like a meta 'search' entry?
			k == '$or' && v.every(function (i) {
				return _.isObject(i) && _.keys(i).length == 1;
			}) && v.map(function (i) {
				return _.chain(i).first().values().first().keys().find(function (i) {
					return i == '$regexp';
				}).value();
			}).length == v.length // Every key has a $regexp search
			) {
					return {
						path: k,
						type: 'search',
						title: 'Search',
						value: // Horrible expression to find the first regexp value
						_.chain(v).first().values().first().get('$regexp').value(),
						fields: _(v).map(function (i) {
							return _.keys(i);
						}).flatten().value(),
						actions: actions
					};
				} else if (k == '$and' || k == '$or') {
				// Meta combinational types
				if (!_.isArray(v)) {
					console.warn('query-builder', 'Query path', k, 'is a meta key', v, 'but is not an array!', 'Given', typeof v === 'undefined' ? 'undefined' : _typeof(v));
					v = [];
				}

				return {
					path: k,
					type: 'binaryGroup',
					title: k == '$and' ? 'AND' : k == '$or' ? 'OR' : 'UNKNOWN',
					condition: k.replace(/\$/, ''),
					children: v.map(function (i) {
						return QueryBuilder.queryToArray(i, spec);
					}),
					actions: actions
				};
			} else if (QueryBuilder.metaProperties[k]) {
				// Is a meta property
				return Object.assign({
					path: k,
					title: _.startCase(k),
					value: v,
					type: 'hidden',
					action: '$hidden',
					actions: actions
				}, QueryBuilder.metaProperties[k]);
			} else if (firstKey == '$exists') {
				return {
					path: k,
					title: v.title || _.startCase(k), // Create a title from the key if its omitted
					value: !!v,
					type: 'exists',
					action: '$exists',
					actions: actions
				};
			} else if (s.type == 'string' && _.isArray(s.enum) && s.enum.length) {
				return {
					path: k,
					title: v.title || _.startCase(k),
					type: 'enum',
					action: v.$in ? '$in' : v.$nin ? '$nin' : s.enum.length ? '$in' : '$eq',
					enum: s.enum,
					value: v.$in ? v.$in : v.$nin ? v.$nin : s.enum.length && !_.isArray(v) ? [v] : v,
					actions: actions
				};
			} else {
				// General fields
				return {
					path: k,
					title: v.title || _.startCase(k), // Create a title from the key if its omitted
					type: s.type == 'string' ? 'string' : s.type == 'number' ? 'number' : s.type == 'date' ? 'date' : 'string',
					action: '$eq',
					value: s.type == 'date' ? moment(firstValue).toDate() // Convert date string weirdness into real dates
					: firstValue,
					actions: actions
				};
			}
		}).value();
	};

	/**
 * Reverse of `queryToArray()`
 * @param {array} queryList the internal array composed by queryToArray
 * @returns {Object} A Mongo / Sift compatible object
 */
	QueryBuilder.arrayToQuery = function (queryList) {
		var composer = function composer(ql) {
			return _(ql).mapKeys(function (ql) {
				return ql.path;
			}).mapValues(function (ql) {
				switch (ql.type) {
					case 'string':
					case 'number':
					case 'date':
						if (ql.action == '$eq') {
							return ql.value;
						} else {
							return _defineProperty({}, ql.action, ql.value);
						}
					case 'enum':
						return _defineProperty({}, ql.action, ql.value);
					case 'exists':
						return { $exists: ql.action == '$exists' };
					case 'search':
						return ql.fields.map(function (f) {
							return _defineProperty({}, f, {
								$regexp: ql.value,
								options: 'i'
							});
						});
					case 'keyVal':
					case 'hidden':
						return ql.value;
					default:
						console.warn('Unknown type to convert:', ql.type);
				}
			}).value();
		};

		return composer(queryList);
	};
})
// }}}

// Component: uiQueryBuilder {{{
/**
* Master query builder component
* This is the top-most query element
* @param {Object} query Raw Mongo / Sift query (will be converted internally to something usable). This will be updated if any data changes
* @param {Object} spec The spec of the data structure
*/
.component('uiQueryBuilder', {
	bindings: {
		query: '=',
		spec: '<'
	},
	template: '\n\t\t<div class="ui-query-builder">\n\t\t\t<div class="query-container">\n\t\t\t\t<ui-query-builder-group\n\t\t\t\t\tqb-group="$ctrl.qbQuery"\n\t\t\t\t\tqb-spec="$ctrl.qbSpec"\n\t\t\t\t></ui-query-builder-group>\n\t\t\t</div>\n\t\t</div>\n\t',
	controller: ['$scope', '$timeout', 'QueryBuilder', function controller($scope, $timeout, QueryBuilder) {
		var $ctrl = this;

		// Main loader {{{
		$ctrl.qbSpec;
		$ctrl.qbQuery;

		var initUnwatch = $scope.$watchGroup(['$ctrl.query', '$ctrl.spec'], function () {
			if (!$ctrl.spec || !$ctrl.query) return; // Not yet got everything we need
			$ctrl.qbSpec = QueryBuilder.cleanSpec($ctrl.spec);
			$ctrl.qbQuery = QueryBuilder.queryToArray($ctrl.query, $ctrl.qbSpec);
			initUnwatch(); // Release the watcher so we don't get stuck in a loop
		});
		// }}}

		/**
  * Emitted by lower elements to inform the main builder that something has changed
  * This will recompute the output query
  */
		$scope.$on('queryBuilder.change', function (e, replaceQuery) {
			return $timeout(function () {
				// Timeout to wait for Angular to catch up with its low level populates
				if (replaceQuery) {
					// If we're given an entire query to overwrite - recompute it
					$ctrl.query = replaceQuery;
					$ctrl.qbQuery = QueryBuilder.queryToArray($ctrl.query, $ctrl.qbSpec);
				} else {
					$ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);
				}
			});
		});

		/**
  * Remove an item from the query by path
  * @param {Object} event
  * @param {string} path The path to remove
  */
		$scope.$on('queryBuilder.pathAction.drop', function (e, path) {
			$ctrl.qbQuery = $ctrl.qbQuery.filter(function (p) {
				return p.path != path;
			});
			$ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);
		});

		/**
  * Swap an item from within query by path
  * @param {Object} event
  * @param {string} path The path to swap
  * @param {string} newPath The new path to use
  */
		$scope.$on('queryBuilder.pathAction.swap', function (e, path, newPath) {
			// Drop existing path
			$ctrl.qbQuery = $ctrl.qbQuery.filter(function (p) {
				return p.path != path;
			});
			$ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);

			// Add new path query (also performs a recompute)
			$scope.$emit('queryBuilder.pathAction.add', newPath);
		});

		$scope.$on('queryBuilder.pathAction.swapAction', function (e, path, newAction) {
			console.log('SWAPACTION', path, newAction);
		});

		/**
  * Add a new item by path
  * @param {Object} event
  * @param {string} path The new path to add
  */
		$scope.$on('queryBuilder.pathAction.add', function (e, path) {
			// Append new path and set to blank
			$ctrl.query[path] = '';
			$ctrl.qbQuery = QueryBuilder.queryToArray($ctrl.query, $ctrl.qbSpec);

			// Recompute
			$ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);
		});
	}]
})
// }}}

// Component: uiQueryBuilderGroup {{{
/**
* Query builder element that holds a collection of queries - an array
* @param {array} qbGroup Collection of fields to render
* @param {Object} qbSpec Processed queryBuilder spec to pass to sub-controls
*/
.component('uiQueryBuilderGroup', {
	bindings: {
		qbGroup: '=',
		qbSpec: '<'
	},
	template: '\n\t\t<div ng-repeat="row in $ctrl.qbGroup | filter:$ctrl.qbGroupFilter" meta-key="{{row.path}}">\n\t\t\t<ui-query-builder-row\n\t\t\t\tqb-item="row"\n\t\t\t\tqb-spec="$ctrl.qbSpec"\n\t\t\t></ui-query-builder-row>\n\t\t</div>\n\t\t<button ng-click="$ctrl.add()" type="button" class="btn-add"></button>\n\t',
	controller: ['$scope', 'QueryBuilder', function controller($scope, QueryBuilder) {
		var $ctrl = this;

		$ctrl.qbGroupFilter = function (item) {
			return item.type != 'hidden';
		};
	}]
})
// }}}

// Component: uiQueryBuilderRow {{{
/**
* Individual line-item for a query row
* @param {Object} qbItem Individual line item to render
*/
.component('uiQueryBuilderRow', {
	bindings: {
		qbItem: '=',
		qbSpec: '<'
	},
	controller: ['$scope', 'QueryBuilder', function controller($scope, QueryBuilder) {
		var $ctrl = this;

		$ctrl.delete = function (path) {
			return $scope.$emit('queryBuilder.pathAction.drop', path);
		};
		$ctrl.setChanged = function () {
			return $scope.$emit('queryBuilder.change');
		};
		$ctrl.setAction = function (action) {
			return $scope.$emit('queryBuilder.pathAction.swapAction', $ctrl.qbItem, action);
		};
	}],
	template: '\n\t\t<div ng-switch="$ctrl.qbItem.type">\n\t\t\t<!-- $and / $or condition {{{ -->\n\t\t\t<div ng-switch-when="binaryGroup" class="query-row">\n\t\t\t\t<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-1 btn-block">\n\t\t\t\t\t\t{{$ctrl.qbItem.title}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div ng-repeat="conditional in $ctrl.qbItem.children" class="query-container clearfix">\n\t\t\t\t\t<ui-query-builder-group\n\t\t\t\t\t\tqb-group="conditional"\n\t\t\t\t\t\tqb-spec="$ctrl.spec"\n\t\t\t\t\t></ui-query-builder-group>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- String {{{ -->\n\t\t\t<div ng-switch-when="string" class="query-row">\n\t\t\t\t<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="1"\n\t\t\t\t\tselected="$ctrl.qbItem.path"\n\t\t\t\t\tqb-spec="$ctrl.qbSpec"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="2"\n\t\t\t\t\tselected="$ctrl.qbItem.action"\n\t\t\t\t\toptions="$ctrl.qbItem.actions"\n\t\t\t\t\ton-change="$ctrl.setAction(selected)"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-3 btn-block">\n\t\t\t\t\t\t<input\n\t\t\t\t\t\t\tng-model="$ctrl.qbItem.value"\n\t\t\t\t\t\t\tng-change="$ctrl.setChanged()"\n\t\t\t\t\t\t\ttype="text"\n\t\t\t\t\t\t\tclass="form-control"\n\t\t\t\t\t\t/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Enum {{{ -->\n\t\t\t<div ng-switch-when="enum" class="query-row">\n\t\t\t\t<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="1"\n\t\t\t\t\tselected="$ctrl.qbItem.path"\n\t\t\t\t\tqb-spec="$ctrl.qbSpec"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="2"\n\t\t\t\t\tselected="$ctrl.qbItem.action"\n\t\t\t\t\toptions="$ctrl.qbItem.actions"\n\t\t\t\t\ton-change="$ctrl.setAction(selected)"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<ui-query-builder-block-menu-multiple\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="3"\n\t\t\t\t\tselected="$ctrl.qbItem.value"\n\t\t\t\t\toptions="$ctrl.qbItem.enum"\n\t\t\t\t></ui-query-builder-block-menu-multiple>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Date {{{ -->\n\t\t\t<div ng-switch-when="date" class="query-row">\n\t\t\t\t<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="1"\n\t\t\t\t\tselected="$ctrl.qbItem.path"\n\t\t\t\t\tqb-spec="$ctrl.qbSpec"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="2"\n\t\t\t\t\tselected="$ctrl.qbItem.action"\n\t\t\t\t\toptions="$ctrl.qbItem.actions"\n\t\t\t\t\ton-change="$ctrl.setAction(selected)"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-3 btn-block">\n\t\t\t\t\t\t<input\n\t\t\t\t\t\t\tng-model="$ctrl.qbItem.value"\n\t\t\t\t\t\t\tng-change="$ctrl.setChanged()"\n\t\t\t\t\t\t\ttype="date"\n\t\t\t\t\t\t\tclass="form-control"\n\t\t\t\t\t\t/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Number {{{ -->\n\t\t\t<div ng-switch-when="number" class="query-row">\n\t\t\t\t<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="1"\n\t\t\t\t\tselected="$ctrl.qbItem.path"\n\t\t\t\t\tqb-spec="$ctrl.qbSpec"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="2"\n\t\t\t\t\tselected="$ctrl.qbItem.action"\n\t\t\t\t\toptions="$ctrl.qbItem.actions"\n\t\t\t\t\ton-change="$ctrl.setAction(selected)"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-3 btn-block">\n\t\t\t\t\t\t<input\n\t\t\t\t\t\t\tng-value="$ctrl.qbItem.value"\n\t\t\t\t\t\t\tng-changed="$ctrl.setChanged()"\n\t\t\t\t\t\t\ttype="number"\n\t\t\t\t\t\t\tclass="form-control"\n\t\t\t\t\t\t/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Exists {{{ -->\n\t\t\t<div ng-switch-when="exists" class="query-row">\n\t\t\t\t<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="1"\n\t\t\t\t\tselected="$ctrl.qbItem.path"\n\t\t\t\t\tqb-spec="$ctrl.qbSpec"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="2"\n\t\t\t\t\tselected="$ctrl.qbItem.action"\n\t\t\t\t\toptions="$ctrl.qbItem.actions"\n\t\t\t\t\ton-change="$ctrl.setAction(selected)"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Search {{{ -->\n\t\t\t<div ng-switch-when="search" class="query-row">\n\t\t\t\t<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="1"\n\t\t\t\t\tselected="$ctrl.qbItem.path"\n\t\t\t\t\tqb-spec="$ctrl.qbSpec"\n\t\t\t\t\ton-change="$ctrl.setAction(selected)"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-2 btn-block">\n\t\t\t\t\t\t<input\n\t\t\t\t\t\t\tng-model="$ctrl.qbItem.value"\n\t\t\t\t\t\t\tng-change="$ctrl.setChanged()"\n\t\t\t\t\t\t\ttype="text"\n\t\t\t\t\t\t\tclass="form-control"\n\t\t\t\t\t\t/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- keyVal (Only title + value) {{{ -->\n\t\t\t<div ng-switch-when="keyVal" class="query-row">\n\t\t\t\t<a ng-if="$ctrl.qbItem.canDelete === undefined || $ctrl.qbItem.canDelete" ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>\n\t\t\t\t<ui-query-builder-block\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="1"\n\t\t\t\t\ttitle="$ctrl.qbItem.title"\n\t\t\t\t></ui-query-builder-block>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-2 btn-block">\n\t\t\t\t\t\t<input\n\t\t\t\t\t\t\tng-model="$ctrl.qbItem.value"\n\t\t\t\t\t\t\tng-change="$ctrl.setChanged()"\n\t\t\t\t\t\t\ttype="text"\n\t\t\t\t\t\t\tclass="form-control"\n\t\t\t\t\t\t/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Unknown {{{ -->\n\t\t\t<div ng-switch-default class="query-row">\n\t\t\t\t<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="1"\n\t\t\t\t\tselected="$ctrl.qbItem.path"\n\t\t\t\t\tqb-spec="$ctrl.qbSpec"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-warning btn-block">\n\t\t\t\t\t\tUnknown handler: {{$ctrl.qbItem.type}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t</div>\n\t'
})
// }}}

// Component: uiQueryBuilderPath {{{
/**
* Component for drawing a path selection component
* This is usually made up of segmented dropdown lists to choose a path in dotted notation
* @param {number} level The level of button we are drawing
* @param {string} selected The currently selected path in dotted notation
* @param {Object} qbSpec Processed queryBuilder spec of the query to allow choices from
*/
.component('uiQueryBuilderPath', {
	bindings: {
		level: '<',
		selected: '<',
		qbSpec: '<'
	},
	controller: ['$scope', function controller($scope) {
		var $ctrl = this;

		$ctrl.setSelected = function (option) {
			return $scope.$emit('queryBuilder.pathAction.swap', $ctrl.selected, option);
		};

		$ctrl.options;
		$ctrl.$onInit = function () {
			$ctrl.options = _.map($ctrl.qbSpec, function (info, path) {
				return Object.assign({}, {
					path: path,
					title: _.startCase(path)
				}, info);
			});

			$ctrl.selectedOption = $ctrl.options.find(function (p) {
				return p.path == $ctrl.selected;
			});
		};
	}],
	template: '\n\t\t<a class="btn btn-block btn-{{$ctrl.level}} dropdown-toggle" data-toggle="dropdown">\n\t\t\t{{$ctrl.selectedOption.title}}\n\t\t\t<i class="fa fa-caret-down"></i>\n\t\t</a>\n\t\t<ul class="dropdown-menu pull-right">\n\t\t\t<li ng-repeat="path in $ctrl.options track by path.path"><a ng-click="$ctrl.setSelected(path.path)">{{path.title}}</a></li>\n\t\t</ul>\n\t'
})
// }}}

// Component: uiQueryBuilderBlock {{{
/**
* Component for drawing a Block with no-interactivity
* @param {number} level The level of button we are drawing
* @param {string} title The title of the block to display
*/
.component('uiQueryBuilderBlock', {
	bindings: {
		level: '<',
		title: '<'
	},
	controller: ['$scope', function controller($scope) {
		var $ctrl = this;
	}],
	template: '\n\t\t<a class="btn btn-block btn-{{$ctrl.level}}">\n\t\t\t{{$ctrl.title}}\n\t\t</a>\n\t'
})
// }}}

// Component: uiQueryBuilderBlockMenu {{{
/**
* Component for drawing a Block as a dropdown list of options
* @param {number} level The level of button we are drawing
* @param {array} options A collection of options to display. Each should be of the form {id, title}
* @param {function} onChange Funciton to call as ({selected}) when the selection changes
* @param {*} selected The currently selected ID
*/
.component('uiQueryBuilderBlockMenu', {
	bindings: {
		level: '<',
		options: '<',
		selected: '=',
		onChange: '&?'
	},
	controller: ['$scope', function controller($scope) {
		var $ctrl = this;

		$ctrl.setSelected = function (option) {
			$ctrl.selected = option.id;
			if (angular.isFunction($ctrl.onChange)) $ctrl.onChange({ selected: $ctrl.selected });
		};

		$ctrl.selectedOption;
		$scope.$watchGroup(['$ctrl.options', '$ctrl.selected'], function () {
			$ctrl.selectedOption = $ctrl.options.find(function (i) {
				return i.id == $ctrl.selected;
			});
		});
	}],
	template: '\n\t\t<a class="btn btn-block btn-{{$ctrl.level}} dropdown-toggle" data-toggle="dropdown">\n\t\t\t{{$ctrl.selectedOption.title}}\n\t\t\t<i class="fa fa-caret-down"></i>\n\t\t</a>\n\t\t<ul class="dropdown-menu pull-right">\n\t\t\t<li ng-repeat="option in $ctrl.options track by option.id"><a ng-click="$ctrl.setSelected(option)">{{option.title}}</a></li>\n\t\t</ul>\n\t'
})
// }}}

// Component: uiQueryBuilderBlockMenuMultiple {{{
/**
* Component for drawing a Block as a dropdown list of multiple-select options
* @param {number} level The level of button we are drawing
* @param {array} options A collection of options to display. Each should be of the form {id, title}
* @param {*} selected The currently selected ID
*/
.component('uiQueryBuilderBlockMenuMultiple', {
	bindings: {
		level: '<',
		options: '<',
		selected: '='
	},
	controller: ['$scope', function controller($scope) {
		var $ctrl = this;

		$ctrl.toggle = function (option) {
			if (!$ctrl.selected) $ctrl.selected = [];

			if ($ctrl.selected.includes(option.id)) {
				$ctrl.selected = $ctrl.selected.filter(function (i) {
					return i != option.id;
				});
			} else {
				$ctrl.selected.push(option.id);
			}
			$scope.$emit('queryBuilder.change');
		};

		$ctrl.selectedOptions;
		$scope.$watch('$ctrl.selected', function () {
			$ctrl.selectedOptions = $ctrl.options.filter(function (i) {
				return ($ctrl.selected || []).includes(i.id);
			});

			$ctrl.options.forEach(function (o) {
				return o.selected = $ctrl.selectedOptions.some(function (s) {
					return s.id == o.id;
				});
			});
		}, true);
	}],
	template: '\n\t\t<a class="btn btn-block btn-{{$ctrl.level}} dropdown-toggle" data-toggle="dropdown">\n\t\t\t<span ng-repeat="item in $ctrl.selectedOptions track by item.id" class="pill">\n\t\t\t\t{{item.title}}\n\t\t\t</span>\n\t\t\t<i class="fa fa-caret-down"></i></a>\n\t\t</a>\n\t\t<ul class="dropdown-menu pull-right">\n\t\t\t<li ng-repeat="option in $ctrl.options track by option.id">\n\t\t\t\t<a ng-click="$ctrl.toggle(option)">\n\t\t\t\t\t<i class="fa fa-fw" ng-class="option.selected ? \'fa-check-square-o\' : \'fa-square-o\'"></i>\n\t\t\t\t\t{{option.title}}\n\t\t\t\t</a>\n\t\t\t</li>\n\t\t</ul>\n\t'
});
// }}}

angular.module('angular-ui-query-builder')

// qbTableSettings (provider) {{{
.provider('qbTableSettings', function () {
	var qbTableSettings = this;

	qbTableSettings.icons = {
		sortNone: 'fa fa-fw fa-sort text-muted',
		sortAsc: 'fa fa-fw fa-sort-alpha-asc text-primary',
		sortDesc: 'fa fa-fw fa-sort-alpha-desc text-primary',
		checkMetaChecked: 'fa fa-lg fa-fw fa-check-square-o text-primary',
		checkMetaSome: 'fa fa-lg fa-fw fa-minus-square-o',
		checkMetaUnchecked: 'fa fa-lg fa-fw fa-square-o',
		checkMetaCaret: 'fa fa-caret-down',
		checkItemChecked: 'fa fa-lg fa-fw fa-check-square-o',
		checkItemUnchecked: 'fa fa-lg fa-fw fa-square-o',
		paginationPrev: 'fa fa-arrow-left',
		paginationNext: 'fa fa-arrow-right',
		modalClose: 'fa fa-times',
		modalCollapseClosed: 'fa fa-caret-right pull-right',
		search: 'fa fa-search'
	};

	qbTableSettings.pagination = {
		showXOfY: true,
		showPages: true,
		pageRangeBack: 5,
		pageRangeFore: 5
	};

	qbTableSettings.export = {
		defaults: {
			format: 'xlsx'
		},
		formats: [{ id: 'xlsx', title: 'Excel (XLSX)' }, { id: 'csv', title: 'CSV' }, { id: 'json', title: 'JSON' }, { id: 'html', title: 'HTML (display in browser)' }],
		questions: [
			/*
   {
   	id: String, // Unique ID for each question (will be sent in submitted query)
   	type: String, // How to render the question. ENUM: 'text'
   	title: String, // The question to ask
   	default: String, // Default value of field if any
   	help: String, // Optional help text,
   },
   */
		]
	};

	qbTableSettings.$get = function () {
		return qbTableSettings;
	};

	return qbTableSettings;
})
// }}}

// qbTableUtilities (service) {{{
.service('qbTableUtilities', function () {
	return {
		/**
  * Return a human readable synopsis of a query
  * @param {object} query The query to summerise
  * @return {string} A short string summerising the query
  */
		getSynopsis: function getSynopsis(query) {
			var filters = _.keys(query).filter(function (i) {
				return !['sort', 'skip', 'limit', 'select'].includes(i);
			});

			return [filters.length ? filters.length + ' filters' : 'All records', query.sort ? query.sort.startsWith('-') ? 'sorted by ' + query.sort.substr(1) + ' (reverse order)' : 'sorted by ' + query.sort : null, query.limit ? 'limited to ' + query.limit + ' rows' : null, query.offset ? 'starting at record ' + query.skip : null, query.select ? 'selecting only ' + query.select.length + ' columns' : null].filter(function (i) {
				return i;
			}).join(', ');
		},

		/**
  * Find the dotted path to a specific query element by a predicate
  * @param {object} query The query to search
  * @returns {string|false} Either the found path of the item or false
  */
		find: function find(query, predicate) {
			var searchExpr = _.isFunction(predicate) ? predicate : _.matches(predicate);
			var foundPath;
			var deepSearcher = function deepSearcher(node, path) {
				if (searchExpr(node, path.slice(path.length - 1))) {
					foundPath = path;
					return true;
				} else if (_.isArray(node)) {
					return node.some(function (v, k) {
						return deepSearcher(v, path.concat(k));
					});
				} else if (_.isObject(node)) {
					return _.some(node, function (v, k) {
						return deepSearcher(v, path.concat(k));
					});
				}
			};

			var res = deepSearcher(query, []);
			return res ? foundPath : false;
		},

		/**
  * Utlility function to return an escaped expression within a RegExp
  * @param {string} text The text to escape
  * @returns {string} The escaped expression
  */
		escapeRegExp: function escapeRegExp(text) {
			return String(text).replace(/(\W)/g, '\\$1');
		},

		/**
  * Utility to reverse quoting a RegExp
  * @param {string} text The escaped regular expression to reverse
  * @returns {string} The unescaped expression
  */
		unescapeRegExp: function unescapeRegExp(text) {
			return String(text).replace(/\\(\W)/g, '$1');
		}

	};
})
// }}}

// qbTable (directive) {{{
/**
* Directive applied to a table element to indicate that we should manage that table via angular-ui-query
* @param {Object} qbTable The query object to modify
* @param {number} count Optional maximum number of results currently matching this query (used by pagination to generate page offsets)
* @param {boolean} stickyThead Anything within the `thead` section of the table should remain on the screen while scrolling
* @param {boolean} stickyTfoot Anything within the `tfoot` section of the table should remain on the screen while scrolling
* @emits qbTableQueryChange Emitted to child elements as (e, query) when the query object changes
*/
.directive('qbTable', function () {
	return {
		scope: {
			qbTable: '=?',
			count: '<?',
			stickyThead: '<?',
			stickyTfoot: '<?'
		},
		restrict: 'AC',
		controller: ['$attrs', '$element', '$rootScope', '$scope', 'qbTableSettings', function controller($attrs, $element, $rootScope, $scope, qbTableSettings) {
			var $ctrl = this;

			// Copy into $ctrl so children can access it / $watch it
			$ctrl.query = $scope.qbTable;
			$ctrl.count = $scope.count;
			$scope.$watch('count', function () {
				return $ctrl.count = $scope.count;
			}); // If our binding changes, also update the qbTable.count reference - no idea why Angular doesn't do this anyway since its using a pointer

			$ctrl.$broadcast = function (msg) {
				for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
					args[_key - 1] = arguments[_key];
				}

				return $scope.$broadcast.apply($scope, [msg].concat(args));
			}; // Rebind broadcast so its accessible from children
			$ctrl.$on = function (event, cb) {
				return $scope.$on(event, cb);
			};
			$ctrl.setDirty = function () {
				return $rootScope.$broadcast('queryBuilder.change', $scope.qbTable);
			};

			/**
   * Set the value of a query element to another value
   * NOTE: This function does not call $ctrl.setDirty() by default but you can chain this
   * @param {string} field The field name to change
   * @param {*} value The value to change to, if omitted the field is removed entirely
   * @example set the sort criteria and then refresh
   * qbTable.setField('sort', 'email').setDirty()
   */
			$ctrl.setField = function (field, value) {
				if (value == undefined) {
					// Remove from query
					delete $ctrl.query[field];
					return;
				}

				switch (field) {
					case 'sort':
						if ($ctrl.query.sort === value) {
							// If already sorting by field switch the sort direction
							$ctrl.query.sort = '-' + value;
						} else if ($ctrl.query.sort === '-' + value) {
							// If reverse sorting switch the right way up again
							$ctrl.query.sort = value;
						} else {
							// Just set the sorting
							$ctrl.query.sort = value;
						}
						break;
					default:
						$scope.qbTable[field] = value;
				}

				return $ctrl;
			};

			$element.addClass('qb-table');
			$scope.$watch('stickyThead', function () {
				return $element.toggleClass('qb-sticky-thead', $scope.stickyThead || $attrs.stickyThead === '');
			});
			$scope.$watch('stickyTfoot', function () {
				return $element.toggleClass('qb-sticky-tfoot', $scope.stickyTfoot || $attrs.stickyTfoot === '');
			});
		}]
	};
})
// }}}

// qbCol (directive) {{{
/**
* Directive for header elements to add angular-ui-query functionality
* @param {Object} ^qbTable.qbTable The query Object to mutate
* @param {string} qbCol The field to operate on
* @param {string} [sortable=q] Indicates that the column should switch to being sorted if the user clicks on it, if a value is specified that is used instead of `q` as the sort field
*
* @example
* <thead>
*   <tr>
*     <td qb-col="name" sortable>Name</td>
*   </tr>
* </thead>
*/
.directive('qbCol', function () {
	return {
		scope: {
			qbCol: '@', // The field to operate on
			sortable: '@'
		},
		require: '^qbTable',
		restrict: 'A',
		transclude: true,
		controller: ['$attrs', '$element', '$scope', 'qbTableSettings', function controller($attrs, $element, $scope, qbTableSettings) {
			var $ctrl = this;

			$scope.qbTableSettings = qbTableSettings;

			// Sanity checks {{{
			var unSanityChecks = $scope.$watchGroup(['qbTable', 'sortable'], function () {
				if ($attrs.sortable === '' && !$scope.qbTable) console.warn('Added qb-col + sortable onto element', $element, 'but no qb-table query has been assigned on the table element!');
				unSanityChecks();
			});
			// }}}

			// Sort functionality {{{
			$scope.canSort = false; // True if either sortable has a specific value or is at least present
			$scope.isSorted = false; // False, 'asc', 'desc'

			$ctrl.$onInit = function () {
				$scope.canSort = $scope.sortable || $attrs.sortable === '';
				$element.toggleClass('sortable', $scope.canSort);
			};

			$scope.$watch('qbTable.query.sort', function (sorter) {
				var sortField = $scope.sortable || $scope.qbCol;

				if (!sorter) {
					$scope.isSorted = false;
				} else if (angular.isArray(sorter) && sorter.some(function (i) {
					return i == sortField;
				}) || sorter == sortField) {
					$scope.isSorted = 'asc';
				} else if (angular.isArray(sorter) && sorter.some(function (i) {
					return i == '-' + sortField;
				}) || sorter == '-' + sortField) {
					$scope.isSorted = 'desc';
				} else {
					$scope.isSorted = false;
				}
			});

			$scope.toggleSort = function () {
				if ($scope.sortable) {
					// Sort by a specific field
					$scope.qbTable.setField('sort', $scope.sortable);
				} else if ($scope.qbCol && $attrs.sortable === '') {
					// Has attribute but no value - assume main key if we have one
					$scope.qbTable.setField('sort', $scope.qbCol);
				}
			};
			// }}}

			$element.addClass('qb-col');
		}],
		link: function link(scope, element, attrs, parentScope) {
			scope.qbTable = parentScope;
		},
		template: '\n\t\t<div class="qb-col-wrapper">\n\t\t\t<ng-transclude></ng-transclude>\n\t\t\t<a ng-if="canSort" ng-click="toggleSort()" class="qb-col-right">\n\t\t\t\t<i class="{{\n\t\t\t\t\tisSorted == \'asc\' ? qbTableSettings.icons.sortAsc\n\t\t\t\t\t: isSorted == \'desc\' ? qbTableSettings.icons.sortDesc\n\t\t\t\t\t: qbTableSettings.icons.sortNone\n\t\t\t\t}}"></i>\n\t\t\t</a>\n\t\t</div>\n\t'
	};
})
// }}}

// qbCell (directive) {{{
/**
* Directive for cell elements within a table
* @param {Object} ^qbTable.qbTable The query Object to mutate
* @param {boolean} [selector] Whether the cell should act as a select / unselect prompt, if any value bind to this as the selection variable
* @param {function} [onSelect] Function to run when the selection value changes. Called as ({value})
*
* @emits qbTableCellSelectMeta Issued by the meta-selector element to peer selection elements that the selection criteria has changed. Called as (arg) where arg is 'all', 'none', 'invert'
* @emits qbTableCellSelect Issued by a regular selector element to broadcast its state has changed
* @emits qbTableCellSelectStatus Sent to one or more child elements as (array) to enquire their status, used to figure out if everything / partial / no items are selected. Each item is expected to add its status to `status` as a boolean
*
* @example
* <td qb-cell selector="row.selected"></td>
*/
.directive('qbCell', function () {
	return {
		scope: {
			selector: '=?',
			onSelect: '&?'
		},
		require: '^qbTable',
		restrict: 'A',
		transclude: true,
		controller: ['$attrs', '$element', '$scope', '$timeout', 'qbTableSettings', function controller($attrs, $element, $scope, $timeout, qbTableSettings) {
			var $ctrl = this;

			$scope.qbTableSettings = qbTableSettings;

			// Meta selection support {{{
			// A cell `isMeta` if it detects its located in the `thead` section of a table
			$scope.isMeta = $element.parents('thead').length > 0;

			if ($scope.isMeta) {
				$timeout(function () {
					return $scope.qbTable.$on('qbTableCellSelect', function () {
						// Ask all children what their status is
						var status = [];
						$scope.qbTable.$broadcast('qbTableCellSelectStatus', status);

						$scope.metaStatus = status.every(function (i) {
							return i;
						}) ? 'all' : status.some(function (i) {
							return i;
						}) ? 'some' : 'none';
					});
				});
			}
			// }}}

			// Selection support {{{
			$scope.isSelector = 'selector' in $attrs;
			$scope.$watch('selector', function () {
				if ($scope.isSelector) $element.toggleClass('selector', $scope.isSelector);

				if ($scope.isSelector && !$scope.isMeta) $element.parents('tr').toggleClass('selected', !!$scope.selector);
			});

			// Respond to clicking anywhere in the 'TD' tag
			if ($scope.isSelector && !$scope.isMeta) {
				$element.on('click', function (e) {
					return $scope.$apply(function () {
						$scope.selector = !$scope.selector;
						if ($scope.onSelect) $scope.onSelect({ value: $scope.selector });
						$scope.qbTable.$broadcast('qbTableCellSelect');
					});
				});
			}

			// Handle meta interaction
			$scope.metaSelect = function (type) {
				return $scope.qbTable.$broadcast('qbTableCellSelectMeta', type);
			};

			// Bind to event listener and respond to selection directives from meta element
			if ($scope.isSelector && !$scope.isMeta) {
				// If we're a standard per-row minion respond to certain events
				$timeout(function () {

					$scope.qbTable.$on('qbTableCellSelectMeta', function (e, type) {
						switch (type) {
							case 'all':
								$scope.selector = true;break;
							case 'invert':
								$scope.selector = !$scope.selector;break;
							case 'none':
								$scope.selector = false;break;
							default:
								throw new Error('Unknown selection type: ' + type);
						}
						$scope.qbTable.$broadcast('qbTableCellSelect'); // Trigger a recount of what is/isn't selected
					});

					$scope.qbTable.$on('qbTableCellSelectStatus', function (e, status) {
						return status.push($scope.selector);
					});
				});
			}
			// }}}

			// Style up the selector
			$element.addClass('qb-cell');
		}],
		link: function link(scope, element, attrs, parentScope) {
			scope.qbTable = parentScope;
		},
		template: '\n\t\t<ng-transclude></ng-transclude>\n\t\t<div ng-if="isSelector && isMeta" class="btn-group">\n\t\t\t<a class="btn btn-default dropdown-toggle" data-toggle="dropdown">\n\t\t\t\t<i ng-class="metaStatus == \'all\' ? qbTableSettings.icons.checkMetaChecked : metaStatus == \'some\' ? qbTableSettings.icons.checkMetaUnchecked : qbTableSettings.icons.checkMetaUnchecked"></i>\n\t\t\t\t<i ng-class="qbTableSettings.icons.checkMetaCaret"></i>\n\t\t\t</a>\n\t\t\t<ul class="dropdown-menu">\n\t\t\t\t<li><a ng-click="metaSelect(\'all\')">All</a></li>\n\t\t\t\t<li><a ng-click="metaSelect(\'invert\')">Invert</a></li>\n\t\t\t\t<li><a ng-click="metaSelect(\'none\')">None</a></li>\n\t\t\t</ul>\n\t\t</div>\n\t\t<div ng-if="isSelector && !isMeta">\n\t\t\t<i ng-class="selector ? qbTableSettings.icons.checkItemChecked : qbTableSettings.icons.checkItemUnchecked"></i>\n\t\t</div>\n\t'
	};
})
// }}}

// qbPagination {{{
/**
* Directive to add table pagination
* NOTE: Any transcluded content will be inserted in the center of the pagination area
* @param {Object} ^qbTable.qbTable The query Object to mutate
* @param {Number} ^qbTable.count The matching number of documents (used to show the page numbers, 'X of Y' displays etc.
*/
.directive('qbPagination', function () {
	return {
		scope: {},
		require: '^qbTable',
		restrict: 'EA',
		transclude: true,
		controller: ['$attrs', '$scope', 'qbTableSettings', function controller($attrs, $scope, qbTableSettings) {
			var $ctrl = this;

			$scope.qbTableSettings = qbTableSettings;

			$scope.canPrev = true;
			$scope.canNext = true;
			$scope.showRange = {};

			$scope.$watchGroup(['qbTable.query.limit', 'qbTable.query.skip', 'qbTable.count'], function (sorter) {
				$scope.canPrev = $scope.qbTable.query.skip > 0;
				$scope.canNext = !$scope.total || $scope.qbTable.query.skip + $scope.qbTable.query.limit < $scope.total;

				// Page X of Y display {{{
				if (qbTableSettings.pagination.showXOfY) {
					$scope.showRange = {
						start: ($scope.qbTable.query.skip || 0) + 1,
						end: ($scope.qbTable.query.skip || 0) + $scope.qbTable.query.limit,
						total: $scope.qbTable.count
					};
				}
				// }}}

				// Page view calculation {{{
				if (qbTableSettings.pagination.showPages) {
					$scope.pages = {
						current: $scope.qbTable.query.limit ? Math.floor(($scope.qbTable.query.skip || 0) / $scope.qbTable.query.limit) : false
					};
					$scope.pages.min = Math.max($scope.pages.current - qbTableSettings.pagination.pageRangeBack, 0);
					$scope.pages.total = $scope.qbTable.query.limit ? Math.ceil($scope.qbTable.count / $scope.qbTable.query.limit) : 1; // No limit specified therefore there is only one page
					$scope.pages.max = Math.min($scope.pages.total, $scope.pages.current + qbTableSettings.pagination.pageRangeFore + 1);
					$scope.pages.range = _.range($scope.pages.min, $scope.pages.max).map(function (i) {
						return {
							number: i,
							mode: i == $scope.pages.current ? 'current' : i == $scope.pages.current - 1 ? 'prev' : i == $scope.pages.current + 1 ? 'next' : 'normal'
						};
					});
				}
				// }}}
			});

			$scope.navPageRelative = function (pageRelative) {
				if (pageRelative == -1) {
					$scope.qbTable.setField('skip', Math.max(($scope.qbTable.query.skip || 0) - ($scope.qbTable.query.limit || 10), 0)).setDirty();
				} else if (pageRelative == 1) {
					$scope.qbTable.setField('skip', ($scope.qbTable.query.skip || 0) + ($scope.qbTable.query.limit || 10)).setDirty();
				} else {
					throw new Error('Unsupported page move: ' + pageRelative);
				}
			};

			$scope.navPageNumber = function (number) {
				return $scope.qbTable.setField('skip', (number || 0) * ($scope.qbTable.query.limit || 10)).setDirty();
			};
		}],
		link: function link(scope, element, attrs, parentScope) {
			scope.qbTable = parentScope;
		},
		template: '\n\t\t<nav>\n\t\t\t<ul class="pager">\n\t\t\t\t<li ng-class="canPrev ? \'\' : \'disabled\'" class="previous"><a ng-click="navPageRelative(-1)"><i ng-class="qbTableSettings.icons.paginationPrev"></i></a></li>\n\t\t\t\t<ng-transclude class="text-center">\n\t\t\t\t\t<span ng-if="qbTableSettings.pagination.showXOfY && showRange.end" class="display-xofy">\n\t\t\t\t\t\tShowing documents {{showRange.start | number}} - {{showRange.end | number}}\n\t\t\t\t\t\t<span ng-if="showRange.total">\n\t\t\t\t\t\t\tof {{showRange.total | number}}\n\t\t\t\t\t\t</span>\n\t\t\t\t\t</span>\n\t\t\t\t\t<ul ng-if="qbTableSettings.pagination.showPages && showRange.end" class="display-pages pagination">\n\t\t\t\t\t\t<li ng-repeat="page in pages.range track by page.number" ng-class="page.mode == \'current\' ? \'active\' : \'\'">\n\t\t\t\t\t\t\t<a ng-click="navPageNumber(page.number)">\n\t\t\t\t\t\t\t\t{{page.number + 1 | number}}\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t</ul>\n\t\t\t\t</ng-transclude>\n\t\t\t\t<li ng-class="canNext ? \'\' : \'disabled\'" class="next"><a ng-click="navPageRelative(1)"><i ng-class="qbTableSettings.icons.paginationNext"></i></a></li>\n\t\t\t</ul>\n\t\t</nav>\n\t'
	};
})
// }}}

// qbExport {{{
/**
* Directive to export a table via a query
* NOTE: This element draws a simple 'Export...' button by default but can be replaced by any valid transcluded HTML. Simply call `exportPrompt()` to action
* @param {Object} query The query Object to use when exporting
* @param {Object} spec The specification object of the collection
* @param {string} url The URL endpoint to redirect to for the query to be executed (typically something like `/api/widgets`)
*
* @example Simple export button
* <qb-export query="myQuery" spec="mySpec"></qb-export>
* @example Custom button
* <qb-export query="myQuery" spec="mySpec">
*   <a class="btn btn-primary" ng-click="exportPrompt()">Export this list</a>
* </qb-export>
*/
.directive('qbExport', function () {
	return {
		scope: {
			query: '<',
			spec: '<',
			url: '@'
		},
		transclude: true,
		restrict: 'EA',
		controller: ['$element', '$httpParamSerializer', '$scope', '$timeout', '$window', 'qbTableSettings', 'qbTableUtilities', function controller($element, $httpParamSerializer, $scope, $timeout, $window, qbTableSettings, qbTableUtilities) {
			var $ctrl = this;

			$scope.qbTableSettings = qbTableSettings;

			$scope.settings = {}; // Set in $scope.exportPrompt()

			$scope.isShowing = false;
			$scope.exportPrompt = function () {
				$scope.settings = angular.extend(angular.copy(qbTableSettings.export.defaults), {
					query: _($scope.query).omitBy(function (v, k) {
						return ['skip', 'limit'].includes(k);
					}).value(),
					columns: _.map($scope.spec, function (v, k) {
						v.id = k;
						v.title = _.startCase(k);
						v.selected = true;
						return v;
					}),
					questions: _(qbTableSettings.export.questions) // Populate questions with defaults
					.mapKeys(function (v) {
						return v.id;
					}).mapValues(function (v) {
						return v.default;
					}).value()
				});

				$element.find('.modal').on('show.bs.modal', function () {
					return $timeout(function () {
						return $scope.isShowing = true;
					});
				}).on('hidden.bs.modal', function () {
					return $timeout(function () {
						return $scope.isShowing = false;
					});
				}).modal('show');
			};

			$scope.exportExecute = function () {
				var query = angular.extend($scope.settings.query, {
					select: $scope.settings.columns.filter(function (c) {
						return c.selected;
					}).map(function (c) {
						return c.id;
					}),
					format: $scope.settings.format
				}, $scope.settings.questions);

				$window.open($scope.url + '?' + $httpParamSerializer(query));
			};

			// Generate a readable synopsis of the query {{{
			$scope.querySynopsis;
			$scope.$watchGroup(['isShowing', 'settings.query'], function () {
				if (!$scope.isShowing) return; // Don't bother if we're not showing anything anyway
				$scope.querySynopsis = qbTableUtilities.getSynopsis($scope.settings.query);
			});
			// }}}

			// Generate a readable synopsis of the columns collapse {{{
			$scope.columnSynopsis;
			$scope.$watchGroup(['isShowing', function () {
				return _.get($scope.settings, 'columns', []).map(function (c) {
					return c.id + '=' + c.selected;
				}).join('&');
			}], function () {
				if (!$scope.isShowing) return; // Don't bother if we're not showing anything anyway
				$scope.columnSynopsis = $scope.settings.columns.filter(function (c) {
					return c.selected;
				}).length + ' columns';
			});
			// }}}
		}],
		template: '\n\t\t<div class="modal fade">\n\t\t\t<div class="modal-dialog modal-lg">\n\t\t\t\t<div ng-if="isShowing" class="modal-content">\n\t\t\t\t\t<div class="modal-header">\n\t\t\t\t\t\t<a class="close" data-dismiss="modal"><i ng-class="qbTableSettings.icons.modalClose"></i></a>\n\t\t\t\t\t\t<h4 class="modal-title">Export</h4>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="modal-body form-horizontal">\n\t\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t\t<label class="col-sm-3 control-label">Output format</label>\n\t\t\t\t\t\t\t<div class="col-sm-9">\n\t\t\t\t\t\t\t\t<select ng-model="settings.format" class="form-control">\n\t\t\t\t\t\t\t\t\t<option ng-repeat="format in qbTableSettings.export.formats track by format.id" value="{{format.id}}">{{format.title}}</option>\n\t\t\t\t\t\t\t\t</select>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t\t<label class="col-sm-3 control-label">Criteria</label>\n\t\t\t\t\t\t\t<div class="col-sm-9">\n\t\t\t\t\t\t\t\t<div class="panel-group" id="qb-export-criteria-{{$id}}">\n\t\t\t\t\t\t\t\t\t<div class="panel panel-default">\n\t\t\t\t\t\t\t\t\t\t<div class="panel-heading">\n\t\t\t\t\t\t\t\t\t\t\t<h4 class="panel-title">\n\t\t\t\t\t\t\t\t\t\t\t\t<a data-toggle="collapse" data-target="#qb-export-criteria-{{$id}}-query" data-parent="#qb-export-criteria-{{$id}}" class="btn-block collapsed">\n\t\t\t\t\t\t\t\t\t\t\t\t\t{{querySynopsis}}\n\t\t\t\t\t\t\t\t\t\t\t\t\t<i ng-class="qbTableSettings.icons.modalCollapseClosed"></i>\n\t\t\t\t\t\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t\t\t\t\t\t</h4>\n\t\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t\t\t<div id="qb-export-criteria-{{$id}}-query" class="panel-collapse collapse container">\n\t\t\t\t\t\t\t\t\t\t\t<ui-query-builder\n\t\t\t\t\t\t\t\t\t\t\t\tquery="settings.query"\n\t\t\t\t\t\t\t\t\t\t\t\tspec="spec"\n\t\t\t\t\t\t\t\t\t\t\t></ui-query-builder>\n\t\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class="form-group">\n\t\t\t\t\t\t\t<label class="col-sm-3 control-label">Columns</label>\n\t\t\t\t\t\t\t<div class="col-sm-9">\n\t\t\t\t\t\t\t\t<div class="panel-group" id="qb-export-columns-{{$id}}">\n\t\t\t\t\t\t\t\t\t<div class="panel panel-default">\n\t\t\t\t\t\t\t\t\t\t<div class="panel-heading">\n\t\t\t\t\t\t\t\t\t\t\t<h4 class="panel-title">\n\t\t\t\t\t\t\t\t\t\t\t\t<a data-toggle="collapse" data-target="#qb-export-columns-{{$id}}-columns" data-parent="#qb-export-columns-{{$id}}" class="btn-block collapsed">\n\t\t\t\t\t\t\t\t\t\t\t\t\t{{columnSynopsis}}\n\t\t\t\t\t\t\t\t\t\t\t\t\t<i ng-class="qbTableSettings.icons.modalCollapseClosed"></i>\n\t\t\t\t\t\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t\t\t\t\t\t</h4>\n\t\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t\t\t<div id="qb-export-columns-{{$id}}-columns" class="panel-collapse collapse row">\n\t\t\t\t\t\t\t\t\t\t\t<div class="col-xs-12">\n\t\t\t\t\t\t\t\t\t\t\t\t<table qb-table class="table table-hover">\n\t\t\t\t\t\t\t\t\t\t\t\t\t<thead>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t<tr>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<th qb-cell selector></th>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<th>Column</th>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t</tr>\n\t\t\t\t\t\t\t\t\t\t\t\t\t</thead>\n\t\t\t\t\t\t\t\t\t\t\t\t\t<tbody>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t<tr ng-repeat="col in settings.columns track by col.id">\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<td qb-cell selector="col.selected"></td>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<td>{{col.title}}</td>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t</tr>\n\t\t\t\t\t\t\t\t\t\t\t\t\t</tbody>\n\t\t\t\t\t\t\t\t\t\t\t\t</table>\n\t\t\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div ng-repeat="question in qbTableSettings.export.questions track by question.id" class="form-group">\n\t\t\t\t\t\t\t<label class="col-sm-3 control-label">{{question.title}}</label>\n\t\t\t\t\t\t\t<div ng-switch="question.type" class="col-sm-9">\n\t\t\t\t\t\t\t\t<div ng-switch-when="text">\n\t\t\t\t\t\t\t\t\t<input type="text" ng-model="settings.questions[question.id]" class="form-control"/>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t<div ng-switch-default>\n\t\t\t\t\t\t\t\t\t<div class="alert alert-danger">\n\t\t\t\t\t\t\t\t\t\tUnknown question type: "{{question.type}}"\n\t\t\t\t\t\t\t\t\t\t<pre>{{question | json}}</pre>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t<div ng-if="question.help" class="help-block">{{question.help}}</div>\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="modal-footer">\n\t\t\t\t\t\t<div class="pull-left">\n\t\t\t\t\t\t\t<a class="btn btn-danger" data-dismiss="modal">Cancel</a>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class="pull-right">\n\t\t\t\t\t\t\t<a ng-click="exportExecute()" class="btn btn-primary" data-dismiss="modal">Export</a>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t</div>\n\t\t<ng-transclude>\n\t\t\t<a ng-click="exportPrompt()" class="btn btn-default">Export...</a>\n\t\t</ng-transclude>\n\t'
	};
})
// }}}

// qbModal {{{
/**
* Button binding that shows a modal allowing the user to edit a query
* @param {Object} query The query Object to use when exporting
* @param {Object} spec The specification object of the collection
* @param {function} [onRefresh] Function to call when the user confirms the query editing. Called as `({query, spec})`
* @param {string} [binding='complete'] How to bind the given query to the one in progress. ENUM: 'none' - do nothing (only call onRefresh), 'live' - update the query as the user edits, 'complete' - only update when the user finishes
* @param {string} [title="Edit Filter"] The title of the modal
*
* @example
* <a qb-modal query="myQuery" spec="mySpec" class="btn btn-success">Edit query</a>
*/
.directive('qbModal', function () {
	return {
		scope: {
			query: '=',
			spec: '<',
			title: '@?',
			onRefresh: '&?',
			binding: '@?'
		},
		transclude: true,
		restrict: 'A',
		controller: ['$element', '$scope', 'qbTableSettings', function controller($element, $scope, qbTableSettings) {
			var $ctrl = this;

			$scope.qbTableSettings = qbTableSettings;

			$ctrl.isShown = false;
			$ctrl.rebind = function () {
				$element.one('click', function () {
					$element.find('.qb-modal').one('hide.bs.modal', function () {
						$ctrl.isShown = false;
					}).one('hidden.bs.modal', function () {
						$ctrl.rebind();
					}).modal('show');
				});
			};

			$scope.submit = function () {
				if (angular.isFunction($ctrl.onRefresh)) $ctrl.onRefresh({ query: $scope.queryCopy, spec: $scope.spec });
				if (!$scope.binding || $scope.binding == 'complete') $scope.query = $scope.queryCopy;

				$element.find('.qb-modal').modal('hide');
			};

			$ctrl.$onInit = function () {
				$scope.queryCopy = $scope.binding == 'live' ? $scope.query : angular.copy($scope.query);
			};

			$ctrl.rebind();
		}],
		template: '\n\t\t<ng-transclude></ng-transclude>\n\t\t<div class="qb-modal modal fade">\n\t\t\t<div class="modal-dialog modal-lg">\n\t\t\t\t<div class="modal-content">\n\t\t\t\t\t<div class="modal-header">\n\t\t\t\t\t\t<a class="close" data-dismiss="modal"><i ng-class="qbTableSettings.icons.modalClose"></i></a>\n\t\t\t\t\t\t<h4 class="modal-title">{{title || \'Edit Filter\'}}</h4>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="modal-body">\n\t\t\t\t\t\t<ui-query-builder\n\t\t\t\t\t\t\tquery="queryCopy"\n\t\t\t\t\t\t\tspec="spec"\n\t\t\t\t\t\t></ui-query-builder>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="modal-footer">\n\t\t\t\t\t\t<div class="pull-left">\n\t\t\t\t\t\t\t<a class="btn btn-danger" data-dismiss="modal">Cancel</a>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<div class="pull-right">\n\t\t\t\t\t\t\t<a ng-click="submit()" class="btn btn-success">Refresh</a>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t</div>\n\t'
	};
})
// }}}

// qbSearch {{{
/**
* Directive to automatically populate a generic search into a query via a single textbox
* NOTE: Any transcluded content will replace the basic `<input/>` template. Bind to `search` to set the search criteria and fire `submit()` to submit the change, 'clear()' to clear the search
* NOTE: The logic on what fields to search is that the field is a string AND if at least one field has 'index:true' to check for that. If no fields claim an index all string fields are searched (this may cause issues with your backend database). See the useIndexes property for further details
* @param {Object} query The query object to populate
* @param {Object} spec The specification object of the collection
* @param {function} [onRefresh] Function to call as ({query}) when the user changes the search string and a new query is generated
* @param {string} [binding='complete'] How to bind the given query to the one in progress. ENUM: 'none' - do nothing (only call onRefresh), 'complete' - only update when the user finishes and presses enter or blurs the input
* @param {string} [useIndexes='auto'] How to determine what fields to search. ENUM: 'all' - All fields', 'string' - Only string fields', 'stringIndexed' - only indexed string fields, 'auto' - 'stringIndexed' if at least one field has {index:true} else 'string'
*/
.directive('qbSearch', function () {
	return {
		scope: {
			query: '=',
			spec: '<',
			onRefresh: '&?',
			useIndexes: '@?'
		},
		restrict: 'AE',
		transclude: true,
		controller: ['$scope', '$rootScope', '$timeout', 'qbTableSettings', 'qbTableUtilities', function controller($scope, $rootScope, $timeout, qbTableSettings, qbTableUtilities) {
			var $ctrl = this;

			$scope.qbTableSettings = qbTableSettings;

			$scope.search = '';

			$scope.submit = function () {
				if (!$scope.search) return $scope.clear();

				var searchQuery = {
					$comment: 'search',
					$or: _($scope.spec).pickBy(function (v) {
						return v.type == 'string';
					}).mapValues(function (v, k) {
						return [{ $regex: qbTableUtilities.escapeRegExp($scope.search), $options: 'i' }];
					}).value()
				};

				var existingQuery = qbTableUtilities.find($scope.query, { $comment: 'search' });
				var newQuery = angular.copy($scope.query);
				if (existingQuery && _.isEqual(existingQuery, ['$comment'])) {
					// Existing - found at root level
					newQuery = searchQuery;
				} else if (existingQuery && existingQuery[0] == '$and') {
					// Existing - Found within $and wrapper
					_.set(newQuery, existingQuery, searchQuery);
				} else if (_.isEqual(_.keys(newQuery), ['$and'])) {
					// Non-existing - Query is of form {$and: QUERY} --
					newQuery.$and.push(searchQuery);
				} else if (_.isObject(newQuery)) {
					// Non-existing - Append as a single key $or
					var indexMethod = $ctrl.useIndexes || 'auto';
					if (indexMethod == 'auto') {
						// Determine what indexing method to use before we begin
						indexMethod = _.keys($scope.spec).some(function (k) {
							return k != '_id' && $scope.spec[k].index;
						}) ? 'stringIndexed' : 'string';
					}
					newQuery.$or = _($scope.spec).pickBy(function (v, k) {
						if (k == '_id') return false; // Never search by ID
						switch (indexMethod) {
							case 'all':
								return true;
							case 'string':
								return v.type == 'string';
							case 'stringIndexed':
								return v.type == 'string' && v.index;
							default:
								throw new Error('Unknown field selection method: "' + indexMethod + '"');
						}
					}).map(function (v, k) {
						return _defineProperty({}, k, { $regex: qbTableUtilities.escapeRegExp($scope.search), $options: 'i' });
					}).value();
				} else {
					// Give up
					console.warn('Unable to place search query', searchQuery, 'within complex query', newQuery);
				}

				// Inform the main query builder that we've changed something
				$rootScope.$broadcast('queryBuilder.change', newQuery);
				if (angular.isFunction($ctrl.onRefresh)) $ctrl.onRefresh({ query: newQuery });
				if ($ctrl.binding == 'complete' || angular.isUndefined($ctrl.binding)) {
					$scope.query = newQuery;
				}
			};

			$scope.clear = function () {
				var existingQuery = qbTableUtilities.find($scope.query, { $comment: 'search' });
				if (existingQuery && _.isEqual(existingQuery, ['$comment'])) {
					// Existing - found at root level
					$scope.query = {};
				} else if (existingQuery && existingQuery[0] == '$and') {
					// Existing - Found within $and wrapper, unwrap and return to simple key/val format
					$scope.query = $scope.query.$and.find(function (v, k) {
						return v.$comment != 'search';
					});
				} else if (existingQuery) {
					// Existing - Delete by path
					_.unset($scope.query, existingQuery);
				} else {
					// Give up
					console.warn('Unable to clear search query within complex query', $scope.query);
				}
			};

			/**
   * Try and populate initial query
   * NOTE: This is currently only compatible with query.$or.0.*.$regex level queries
   */
			$scope.check = function () {
				try {
					$scope.search = _.chain($scope.query).get('$or').first().values().first().get('$regex').thru(function (v) {
						return qbTableUtilities.unescapeRegExp(v || '');
					}).value();
				} catch (e) {
					$scope.search = '';
				}
			};

			$ctrl.$onInit = function () {
				return $scope.check();
			};
		}],
		template: '\n\t\t<ng-transclude>\n\t\t\t<form ng-submit="submit()" class="form-inline">\n\t\t\t\t<div class="form-group">\n\t\t\t\t\t<div class="input-group">\n\t\t\t\t\t\t<input ng-blur="submit()" type="text" ng-model="search" class="form-control"/>\n\t\t\t\t\t\t<a ng-click="submit()" class="btn btn-default input-group-addon">\n\t\t\t\t\t\t\t<i ng-class="qbTableSettings.icons.search"/>\n\t\t\t\t\t\t</a>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t</ng-transclude>\n\t'
	};
});
// }}}