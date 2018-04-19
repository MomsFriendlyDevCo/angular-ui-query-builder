'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

angular.module('angular-ui-query-builder', []).service('QueryBuilder', function () {
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
			|| k == '$and' || k == '$or';
			if (!maps) console.warn('query-builder', 'Incomming query path', k, 'Does not map to anyhting in spec', spec);
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
			} else if (firstKey == '$exists') {
				return {
					path: k,
					title: v.title || _.startCase(k), // Create a title from the key if its omitted
					value: !!v,
					type: 'exists',
					action: '$exists',
					actions: actions
				};
			} else if (s.type == 'string' && _.isArray(s.enum)) {
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
					action: firstKey,
					value: s.type == 'date' ? moment(firstValue).format('YYYY-MM-DD') // Convert date objects back to strings
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
					default:
						console.warn('Unknown type to convert:', ql.type);
				}
			}).value();
		};

		return composer(queryList);
	};
})

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

		$ctrl.qbSpec;
		$ctrl.qbQuery;
		$ctrl.$onInit = function () {
			$ctrl.qbSpec = QueryBuilder.cleanSpec($ctrl.spec);
			$ctrl.qbQuery = QueryBuilder.queryToArray($ctrl.query, $ctrl.qbSpec);
		};

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
				}

				$ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);
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
	template: '\n\t\t<div ng-repeat="row in $ctrl.qbGroup">\n\t\t\t<ui-query-builder-row\n\t\t\t\tqb-item="row"\n\t\t\t\tqb-spec="$ctrl.qbSpec"\n\t\t\t></ui-query-builder-row>\n\t\t</div>\n\t',
	controller: ['$scope', 'QueryBuilder', function controller($scope, QueryBuilder) {
		var $ctrl = this;
	}]
})

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
	}],
	template: '\n\t\t<div ng-switch="$ctrl.qbItem.type">\n\t\t\t<!-- $and / $or condition {{{ -->\n\t\t\t<div ng-switch-when="binaryGroup" class="query-row">\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-1 btn-block">\n\t\t\t\t\t\t{{$ctrl.qbItem.title}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div ng-repeat="conditional in $ctrl.qbItem.children" class="query-container clearfix">\n\t\t\t\t\t<ui-query-builder-group\n\t\t\t\t\t\tqb-group="conditional"\n\t\t\t\t\t\tqb-spec="$ctrl.spec"\n\t\t\t\t\t></ui-query-builder-group>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- String {{{ -->\n\t\t\t<div ng-switch-when="string" class="query-row">\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-1 btn-block">\n\t\t\t\t\t\t{{$ctrl.qbItem.title}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="2"\n\t\t\t\t\tselected="$ctrl.qbItem.action"\n\t\t\t\t\toptions="$ctrl.qbItem.actions"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-3 btn-block">\n\t\t\t\t\t\t<input ng-value="$ctrl.qbItem.value" type="text" class="form-control"/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Enum {{{ -->\n\t\t\t<div ng-switch-when="enum" class="query-row">\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-1 btn-block">\n\t\t\t\t\t\t{{$ctrl.qbItem.title}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="2"\n\t\t\t\t\tselected="$ctrl.qbItem.action"\n\t\t\t\t\toptions="$ctrl.qbItem.actions"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<ui-query-builder-block-menu-multiple\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="3"\n\t\t\t\t\tselected="$ctrl.qbItem.value"\n\t\t\t\t\toptions="$ctrl.qbItem.enum"\n\t\t\t\t></ui-query-builder-block-menu-multiple>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Date {{{ -->\n\t\t\t<div ng-switch-when="date" class="query-row">\n\t\t\t\t<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="1"\n\t\t\t\t\tselected="$ctrl.qbItem.path"\n\t\t\t\t\tqb-spec="$ctrl.qbSpec"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="2"\n\t\t\t\t\tselected="$ctrl.qbItem.action"\n\t\t\t\t\toptions="$ctrl.qbItem.actions"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-3 btn-block">\n\t\t\t\t\t\t<input ng-value="$ctrl.qbItem.value" type="date" class="form-control"/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Number {{{ -->\n\t\t\t<div ng-switch-when="number" class="query-row">\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-1 btn-block">\n\t\t\t\t\t\t{{$ctrl.qbItem.title}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="2"\n\t\t\t\t\tselected="$ctrl.qbItem.action"\n\t\t\t\t\toptions="$ctrl.qbItem.actions"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-3 btn-block">\n\t\t\t\t\t\t<input ng-value="$ctrl.qbItem.value" type="number" class="form-control"/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Exists {{{ -->\n\t\t\t<div ng-switch-when="exists" class="query-row">\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-1 btn-block">\n\t\t\t\t\t\t{{$ctrl.qbItem.title}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass="query-block"\n\t\t\t\t\tlevel="2"\n\t\t\t\t\tselected="$ctrl.qbItem.action"\n\t\t\t\t\toptions="$ctrl.qbItem.actions"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Search {{{ -->\n\t\t\t<div ng-switch-when="search" class="query-row">\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-1 btn-block">\n\t\t\t\t\t\t{{$ctrl.qbItem.title}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-2 btn-block">\n\t\t\t\t\t\t<input ng-value="$ctrl.qbItem.value" ng-keyup="$ctrl.setChanged()" type="text" class="form-control"/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Unknown {{{ -->\n\t\t\t<div ng-switch-default class="query-row">\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-warning btn-block">\n\t\t\t\t\t\t{{$ctrl.qbItem.title}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class="query-block">\n\t\t\t\t\t<div class="btn btn-warning btn-block">\n\t\t\t\t\t\tUnknown handler: {{$ctrl.qbItem.type}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Add button {{{\n\t\t\t<div class="query-row">\n\t\t\t\t<div class="query-block btn-group">\n\t\t\t\t\t<a ng-click="$ctrl.add()" class="btn btn-add"></a>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t}}} -->\n\t\t</div>\n\t'
})

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

/**
* Component for drawing a Block as a dropdown list of options
* @param {number} level The level of button we are drawing
* @param {array} options A collection of options to display. Each should be of the form {id, title}
* @param {*} selected The currently selected ID
*/
.component('uiQueryBuilderBlockMenu', {
	bindings: {
		level: '<',
		options: '<',
		selected: '='
	},
	controller: ['$scope', function controller($scope) {
		var $ctrl = this;

		$ctrl.setSelected = function (option) {
			$ctrl.selected = option.id;
			$scope.$emit('queryBuilder.change');
		};

		$ctrl.selectedOption;
		$scope.$watchGroup(['$ctrl.options', '$ctrl.selected'], function () {
			$ctrl.selectedOption = $ctrl.options.find(function (i) {
				return i.id == $ctrl.selected;
			});
		});
	}],
	template: '\n\t\t<a class="btn btn-block btn-{{$ctrl.level}} dropdown-toggle" data-toggle="dropdown"> {{$ctrl.selectedOption.title}} <i class="fa fa-caret-down"></i></a>\n\t\t<ul class="dropdown-menu pull-right">\n\t\t\t<li ng-repeat="option in $ctrl.options track by option.id"><a ng-click="$ctrl.setSelected(option)">{{option.title}}</a></li>\n\t\t</ul>\n\t'
})

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
})

// Main widget {{{
.component('uiQueryBuilderOLD', {
	bindings: {
		query: '=',
		spec: '<'
	},
	template: '\n\t\t<div class="ui-query-builder clearfix">\n\t\t\t<div class="query-container">\n\t\t\t\t<!-- Meta field: sort {{{ -->\n\t\t\t\t<div class="query-row">\n\t\t\t\t\t<!-- Path component {{{ -->\n\t\t\t\t\t<div class="query-block">\n\t\t\t\t\t\t<div class="btn-group btn-block">\n\t\t\t\t\t\t\t<a class="btn btn-1 btn-block">\n\t\t\t\t\t\t\t\tSort by\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t\t<!-- }}} -->\n\t\t\t\t\t<!-- Query operand component {{{ -->\n\t\t\t\t\t<div class="query-block btn-group">\n\t\t\t\t\t\t<div class="btn btn-block btn-2">\n\t\t\t\t\t\t\t<input ng-model="$ctrl.query.sort" type="text" class="form-control"/>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t\t<!-- }}} -->\n\t\t\t\t</div>\n\t\t\t\t<!-- }}} -->\n\t\t\t\t<!-- Meta field: limit {{{ -->\n\t\t\t\t<div class="query-row">\n\t\t\t\t\t<!-- Path component {{{ -->\n\t\t\t\t\t<div class="query-block">\n\t\t\t\t\t\t<div class="btn-group btn-block">\n\t\t\t\t\t\t\t<a class="btn btn-1 btn-block">\n\t\t\t\t\t\t\t\tLimited to\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t\t<!-- }}} -->\n\t\t\t\t\t<!-- Query operand component {{{ -->\n\t\t\t\t\t<div class="query-block btn-group">\n\t\t\t\t\t\t<div class="btn btn-block btn-2">\n\t\t\t\t\t\t\t<input ng-model="$ctrl.query.limit" type="number" class="form-control"/>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="query-block btn-group">\n\t\t\t\t\t\t<div class="btn btn-block btn-1">\n\t\t\t\t\t\t\tSkipping\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class="query-block btn-group">\n\t\t\t\t\t\t<div class="btn btn-block btn-2">\n\t\t\t\t\t\t\t<input ng-model="$ctrl.query.skip" type="number" class="form-control"/>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</div>\n\t\t\t\t\t<!-- }}} -->\n\t\t\t\t</div>\n\t\t\t\t<!-- }}} -->\n\t\t\t\t<div class="query-row">\n\t\t\t\t\t<div class="query-block">\n\t\t\t\t\t\t<!-- FIXME: Need branch title -->\n\t\t\t\t\t</div>\n\t\t\t\t\t<ui-query-builder-branch\n\t\t\t\t\t\tclass="query-container"\n\t\t\t\t\t\tbranch="$ctrl.query"\n\t\t\t\t\t\tspec="$ctrl.spec"\n\t\t\t\t\t></ui-query-builder-branch>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t</div>\n\t',
	controller: ['$scope', function controller($scope) {
		var $ctrl = this;

		// Clean up incomming spec {{{
		$scope.$watch('$ctrl.spec', function () {
			_.forEach($ctrl.spec, function (v, k) {
				if (!v.title) v.title = _.startCase(k); // Create a title from the key if its omitted
				if (v.enum && _.isArray(v.enum)) {
					// Ensure enums are aways collections
					v.enum = _(v.enum).map(function (e) {
						return _.isString(e) ? { id: e, title: _.startCase(e) } : e;
					}).sortBy('title').value();
				}
			});
		});
		// }}}
	}]
})
// }}}

// Branch widget {{{
/**
* Display a branch
* This is a seperate component in order to allow recursion
* @param {Object} branch The branch to display (passed from the main widget or recursively from this one)
* @param {Object} spec The specification passed from the parent
*/
.component('uiQueryBuilderBranch', {
	bindings: {
		branch: '=',
		spec: '<'
	},
	template: '\n\t\t<!-- AND blocks {{{ -->\n\t\t<div ng-repeat="leaf in $ctrl.properties | filter:{isMeta:true,id:\'$and\'} track by leaf.id" ng-switch="leaf.spec.type" ng-repeat-emit="uiQueryQueryRepaint" class="query-row">\n\t\t\t<div ng-repeat="choiceLeaf in leaf.value">\n\t\t\t\t<ui-query-builder-branch\n\t\t\t\t\tbranch="choiceLeaf"\n\t\t\t\t\tspec="$ctrl.spec"\n\t\t\t\t></ui-query-builder-branch>\n\t\t\t</div>\n\t\t</div>\n\t\t<!-- }}} -->\n\t\t<!-- OR blocks {{{ -->\n\t\t<div ng-repeat="leaf in $ctrl.properties | filter:{isMeta:true,id:\'$or\'} track by leaf.id" ng-switch="leaf.spec.type" ng-repeat-emit="uiQueryQueryRepaint" class="query-row">\n\t\t\t<div ng-repeat="choiceLeaf in leaf.value">\n\t\t\t\t<ui-query-builder-branch\n\t\t\t\t\tbranch="choiceLeaf"\n\t\t\t\t\tspec="$ctrl.spec"\n\t\t\t\t></ui-query-builder-branch>\n\t\t\t</div>\n\t\t</div>\n\t\t<!-- }}} -->\n\t\t<!-- Main fields {{{ -->\n\t\t<div ng-repeat="leaf in $ctrl.properties | filter:{isMeta:false} track by leaf.id" ng-switch="leaf.spec.type" ng-repeat-emit="uiQueryQueryRepaint" class="query-row">\n\t\t\t<!-- Path component {{{ -->\n\t\t\t<button ng-click="$ctrl.remove(leaf.id); $event.stopPropagation()" class="btn btn-trash btn-danger" type="button"></button>\n\t\t\t<div class="query-block">\n\t\t\t\t<div class="btn-group btn-block" ng-class="{new: !leaf.id}">\n\t\t\t\t\t<a class="btn btn-1 btn-block dropdown-toggle" data-toggle="dropdown">\n\t\t\t\t\t\t{{$ctrl.spec[leaf.id].title || \'Select...\'}}\n\t\t\t\t\t\t<i class="fa fa-caret-down"></i>\n\t\t\t\t\t</a>\n\t\t\t\t\t<ul class="dropdown-menu pull-right">\n\t\t\t\t\t\t<li ng-repeat="(key, val) in $ctrl.spec track by key" ng-class="key == leaf.id && \'active\'">\n\t\t\t\t\t\t\t<a ng-click="$ctrl.setField(leaf, key)">\n\t\t\t\t\t\t\t\t{{$ctrl.spec[key].title}}\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t</ul>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Query type component {{{ -->\n\t\t\t<div ng-show="leaf.valueOperand" class="query-block">\n\t\t\t\t<div class="btn-group btn-block">\n\t\t\t\t\t<a class="btn btn-2 btn-block dropdown-toggle" data-toggle="dropdown">\n\t\t\t\t\t\t{{($ctrl.operandsByID[leaf.valueOperand][leaf.spec.type] || $ctrl.operandsByID[leaf.valueOperand].base).title}}\n\t\t\t\t\t\t<i class="fa fa-caret-down"></i>\n\t\t\t\t\t</a>\n\t\t\t\t\t<ul class="dropdown-menu pull-right">\n\t\t\t\t\t\t<li><a ng-click="$ctrl.setWrapper(leaf, \'$eq\')">Is</a></li>\n\t\t\t\t\t\t<li><a ng-click="$ctrl.setWrapper(leaf, \'$ne\')">Is not</a></li>\n\t\t\t\t\t\t<li><a ng-click="$ctrl.setWrapper(leaf, \'$in\')">One of</a></li>\n\t\t\t\t\t\t<li><a ng-click="$ctrl.setWrapper(leaf, \'$nin\')">Not one of</a></li>\n\t\t\t\t\t\t<li ng-if="leaf.spec.type == \'number\'"><a ng-click="$ctrl.setWrapper(leaf, \'$gt\')">Above</a></li>\n\t\t\t\t\t\t<li ng-if="leaf.spec.type == \'number\'"><a ng-click="$ctrl.setWrapper(leaf, \'$lt\')">Below</a></li>\n\t\t\t\t\t\t<li ng-if="leaf.spec.type == \'date\'"><a ng-click="$ctrl.setWrapper(leaf, \'$gt\')">Is after</a></li>\n\t\t\t\t\t\t<li ng-if="leaf.spec.type == \'date\'"><a ng-click="$ctrl.setWrapper(leaf, \'$gte\')">Is at least</a></li>\n\t\t\t\t\t\t<li ng-if="leaf.spec.type == \'date\'"><a ng-click="$ctrl.setWrapper(leaf, \'$lt\')">Is before</a></li>\n\t\t\t\t\t\t<li ng-if="leaf.spec.type == \'date\'"><a ng-click="$ctrl.setWrapper(leaf, \'$lte\')">Is at most</a></li>\n\t\t\t\t\t\t<li><a ng-click="$ctrl.setWrapper(leaf, \'$exists\')">Has a value</a></li>\n\t\t\t\t\t</ul>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Query operand component {{{ -->\n\t\t\t<div ng-show="leaf.valueOperand" class="query-block btn-group" ng-switch="(operandConfig = $ctrl.operandsByID[leaf.valueOperand][leaf.spec.type] || $ctrl.operandsByID[leaf.valueOperand].base).type">\n\t\t\t\t<div ng-switch-when="string" class="btn btn-block btn-3">\n\t\t\t\t\t<input ng-model="leaf.valueEdit" ng-change="$ctrl.setValue(leaf)" type="text" class="form-control"/>\n\t\t\t\t</div>\n\t\t\t\t<div ng-switch-when="array" class="btn btn-block btn-3 btn-group">\n\t\t\t\t\t<div class="btn-fill text-left dropdown-toggle" data-toggle="dropdown">\n\t\t\t\t\t\t<span class="pill" ng-repeat="item in $ctrl.spec[leaf.id].enum | uiQueryBuilderFilterSelected:leaf track by item.id">\n\t\t\t\t\t\t\t{{item.title}}\n\t\t\t\t\t\t</span>\n\t\t\t\t\t\t<span ng-if="!leaf.valueEdit.length">...</span>\n\t\t\t\t\t\t<i class="fa fa-caret-down"></i>\n\t\t\t\t\t</div>\n\t\t\t\t\t<ul class="dropdown-menu pull-right">\n\t\t\t\t\t\t<li ng-repeat="item in $ctrl.spec[leaf.id].enum | uiQueryBuilderFilterSelected:leaf:false track by item.id">\n\t\t\t\t\t\t\t<a ng-click="$ctrl.setValueIncluded(leaf, item.id, false)">\n\t\t\t\t\t\t\t\t<i class="fa fa-fw fa-check-square text-primary"></i>\n\t\t\t\t\t\t\t\t{{item.title}}\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t\t<li ng-repeat="item in $ctrl.spec[leaf.id].enum | uiQueryBuilderFilterSelected:leaf:true track by item.id">\n\t\t\t\t\t\t\t<a ng-click="$ctrl.setValueIncluded(leaf, item.id, true)">\n\t\t\t\t\t\t\t\t<i class="fa fa-fw fa-square-o text-primary"></i>\n\t\t\t\t\t\t\t\t{{item.title}}\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t</ul>\n\t\t\t\t</div>\n\t\t\t\t<div ng-switch-when="boolean" class="btn btn-block btn-3" ng-click="$ctrl.setValue(leaf, !leaf.valueEdit)">\n\t\t\t\t\t<i class="fa fa-fw" ng-class="leaf.valueEdit ? \'fa-check-square-o\' : \'fa-square-o\'"></i>\n\t\t\t\t\t{{leaf.valueEdit ? operandConfig.textTrue : operandConfig.textFalse}}\n\t\t\t\t</div>\n\t\t\t\t<div ng-switch-when="date" class="btn btn-block btn-3">\n\t\t\t\t\t<input ng-model="leaf.valueEdit" ng-change="$ctrl.setValue(leaf)" type="date" class="form-control"/>\n\t\t\t\t</div>\n\t\t\t\t<div ng-switch-default class="btn btn-block btn-3">\n\t\t\t\t\tUnknown operand: <code>{{leaf.valueOperand}}</code>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t</div>\n\t\t<!-- Add button {{{ -->\n\t\t<button ng-click="$ctrl.add()" class="btn btn-add btn-success" type="button"></button>\n\t\t<!-- }}} -->\n\t',
	controller: ['$element', '$scope', function controller($element, $scope) {
		var $ctrl = this;

		// Operands {{{
		/**
  * An array of all supported wrapping operands
  * These usually correspond to the 'dollar function' wrapper in Mongo. e.g. $eq =~ equals
  * Each item has an `id` and a `base` setup with an optional override for specific types
  * @var array
  */
		$ctrl.operands = [
		/*
  {
  	id: String, // The operand matching leaf.valueOperand
  	setter: Function(v), // Function used to convert the value into something compatible with the operand
  	base: {
  		title: String, // The human title of the operand
  		type: String, // How to display the operand value to the user (generally matches to standard scalar values)
  	},
  	string: { // Specific override for the string type (optional)
  		...
  	},
  	number: { // Specific override for the number type (optional)
  	...
  },
  */
		{
			id: '$eq',
			setter: function setter(v) {
				return { $eq: v };
			},
			export: function _export(leaf) {
				return leaf.valueEdit;
			},
			base: {
				title: 'Is',
				type: 'string'
			},
			boolean: {
				title: 'Is',
				type: 'boolean',
				textTrue: 'Enabled',
				textFalse: 'Disabled'
			},
			date: {
				title: 'Is exactly',
				type: 'date'
			}
		}, {
			id: '$ne',
			setter: function setter(v) {
				return { $ne: v };
			},
			export: function _export(leaf) {
				return { $ne: leaf.valueEdit };
			},
			base: {
				title: 'Is not',
				type: 'string'
			},
			boolean: {
				title: 'Is not',
				type: 'boolean',
				textTrue: 'Enabled',
				textFalse: 'Disabled'
			},
			date: {
				title: 'Is not exactly',
				type: 'date'
			}
		}, {
			id: '$in',
			setter: function setter(v) {
				return { $in: _.isArray(v) ? v.split(/\s*,\s*/) : [v] };
			},
			export: function _export(leaf) {
				return { $in: leaf.value.$in };
			},
			base: {
				title: 'One of',
				type: 'array'
			}
		}, {
			id: '$nin',
			setter: function setter(v) {
				return { $nin: _.isArray(v) ? v.split(/\s*,\s*/) : [v] };
			},
			export: function _export(leaf) {
				return { $nin: leaf.value.$nin };
			},
			base: {
				title: 'Not one of',
				type: 'array'
			}
		}, {
			id: '$gt',
			setter: function setter(v) {
				return { $gt: v };
			},
			export: function _export(leaf) {
				return { $gt: leaf.value.$gt };
			},
			base: {
				title: 'Above',
				type: 'number'
			},
			date: {
				title: 'Is after',
				type: 'date'
			}
		}, {
			id: '$gte',
			setter: function setter(v) {
				return { $gte: v };
			},
			export: function _export(leaf) {
				return { $gte: leaf.value.$gte };
			},
			base: {
				title: 'Above or equals',
				type: 'number'
			},
			date: {
				title: 'Is at least',
				type: 'date'
			}
		}, {
			id: '$lt',
			setter: function setter(v) {
				return { $lt: v };
			},
			export: function _export(leaf) {
				return { $lt: leaf.value.$lt };
			},
			base: {
				title: 'Below',
				type: 'number'
			},
			date: {
				title: 'Is before',
				type: 'date'
			}
		}, {
			id: '$lte',
			setter: function setter(v) {
				return { $lt: v };
			},
			export: function _export(leaf) {
				return { $lte: leaf.value.$lte };
			},
			base: {
				title: 'Below or equals',
				type: 'number'
			},
			date: {
				title: 'Is at most',
				type: 'date'
			}
		}, {
			id: '$exists',
			setter: function setter(v) {
				return { $exists: !!v };
			},
			export: function _export(leaf) {
				return { $exists: leaf.value.$exists };
			},
			base: {
				title: 'Has a value',
				type: 'boolean',
				textTrue: 'Has a value',
				textFalse: 'Has a value' // This isn't technically right but its right next to a disabled checkbox so it makes sense in context
			}
		}, {
			id: '$regexp',
			setter: function setter(v) {
				return { $regexp: v };
			},
			export: function _export(leaf) {
				return { $regexp: leaf.value.$regexp };
			},
			base: {
				title: 'Matches',
				type: 'string'
			}
		}];
		$ctrl.operandsByID = _.mapKeys($ctrl.operands, 'id');
		// }}}

		// $ctrl.getSpec() {{{
		$ctrl.getSpec = function (key, val, path) {
			// Spec present {{{
			if ($ctrl.spec[path]) {
				return $ctrl.spec[path];
				// }}}
				// Meta parent types {{{
			} else if (key == '$and' || key == '$or') {
				return _defineProperty({ type: 'group' }, 'type', key);
				// }}}
				// Guessing {{{
			} else if (_.isString(val)) {
				return { type: 'string' };
			} else if (_.isNumber(val)) {
				return { type: 'number' };
				// }}}
				// Fallback {{{
			} else {
				return { type: 'string' };
			}
			// }}}
		};
		// }}}

		// $ctrl.translateBranch() {{{
		$ctrl.translateBranch = function (branch) {
			var pathSegments = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
			return _($ctrl.branch).map(function (v, k) {
				return {
					id: k,
					value: v,
					valueEdit: $ctrl.getFlatValue(v),
					valueOperand: _.isObject(v) ? _(v).keys().first() : '$eq',
					isMeta: ('' + k).startsWith('$') || ['sort', 'skip', 'limit'].includes(k),
					spec: $ctrl.getSpec(k, v, k),
					path: pathSegments.concat([k])
				};
			}).sortBy(function (p) {
				return p.isMeta ? 'Z' + p.id : 'A' + p.id;
			}) // Force meta items to the end
			.value();
		};
		// }}}

		// $ctrl.exportBranch() {{{
		/**
  * Export the local $ctrl.properties branch back into the upstream branch
  */
		$ctrl.exportBranch = function () {
			$ctrl.branch = _($ctrl.properties).mapKeys(function (b) {
				return b.id;
			}).mapValues(function (b) {
				return $ctrl.operandsByID[b.valueOperand].export(b);
			}).value();
		};
		// }}}

		// Convert branch -> properties {{{
		// We have to do this to sort appropriately and allow iteration over dollar prefixed keys
		$ctrl.properties;
		$scope.$watchGroup(['$ctrl.branch', '$ctrl.spec'], function () {
			if (!$ctrl.branch || !$ctrl.spec) return; // Not yet ready
			$ctrl.properties = $ctrl.translateBranch($ctrl.branch);
		});
		// }}}

		// Branch interaction {{{
		$ctrl.setField = function (leaf, field) {
			leaf.id = field;
			leaf.path = [field];
			leaf.value = undefined;
			leaf.valueEdit = undefined;
			leaf.valueOperand = '$eq';
			leaf.spec = $ctrl.spec[field];
			$ctrl.setValue(leaf);
		};

		$ctrl.setWrapper = function (leaf, type) {
			if (leaf.valueOperand == '$eq' && type == '$ne') {
				// Negate
				leaf.valueOperand = '$ne';
				leaf.valueEdit = $ctrl.getFlatValue(leaf.value);
				leaf.value = { $ne: leaf.valueEdit };
			} else if (leaf.valueOperand == '$ne' && type == '$eq') {
				leaf.valueOperand = '$eq';
				leaf.valueEdit = $ctrl.getFlatValue(leaf.value);
				leaf.value = { $eq: leaf.valueEdit };
			} else if (leaf.valueOperand == '$in' && type == '$eq') {
				// Flatten array into scalar
				leaf.valueOperand = '$eq';
				leaf.value = leaf.valueEdit = $ctrl.getFlatValue(leaf.value);
			} else if ((leaf.valueOperand == '$eq' || leaf.valueOperand === undefined) && type == '$in') {
				// Roll scalar into array
				leaf.valueOperand = '$in';
				leaf.valueEdit = $ctrl.getFlatValue(leaf.value);
				leaf.value = { $in: [leaf.valueEdit] };
			} else if (type == '$exists') {
				// Convert anything to exists - force it to be a boolean
				leaf.valueOperand = '$exists';
				leaf.valueEdit = true;
				leaf.value = { $exists: leaf.valueEdit };
			} else {
				// Unknown swapping - convert to an object with one key
				console.log('UNHANDLED TYPE CONVERT:', leaf.type, '=>', type);
				var newValue = $ctrl.getFlatValue(leaf.value);

				leaf.valueOperand = type;
				leaf.valueEdit = newValue;
				leaf.value = _defineProperty({}, leaf.valueOperand, leaf.valueEdit);
			}

			// Set the upstream model value
			$ctrl.exportBranch();
		};

		/**
  * Set the value of a leaf
  * @param {Object} leaf The leaf to change the value of
  * @param {*} [value] Optional value to set, if omitted the bound leaf.valueEdit will be used
  */
		$ctrl.setValue = function (leaf, value) {
			var newValue = _.isUndefined(value) ? leaf.valueEdit : value;

			// Run via operand setter
			leaf.value = $ctrl.operandsByID[leaf.valueOperand].setter(newValue);
			leaf.valueEdit = $ctrl.getFlatValue(leaf.value);

			// Set the upstream model value
			$ctrl.exportBranch();
		};
		// }}}

		// Utility functions {{{
		/**
  * Set whether the specified value is included in the leaf array of values
  * @param {Object} leaf The leaf to change the value of
  * @param {string} value The value to toggle to inclusion of
  * @param {boolean} included Whether the value is included
  */
		$ctrl.setValueIncluded = function (leaf, value, included) {
			var wrapperKey = _(leaf.value).keys().first();
			if (!wrapperKey) throw new Error('Tried to set array inclusion on non wrapped key: ' + leaf.value);

			var isIncluded = leaf.value[wrapperKey].includes(value);
			if (included && !isIncluded) {
				leaf.value[wrapperKey].push(value);
			} else if (!included && isIncluded) {
				leaf.value[wrapperKey] = leaf.value[wrapperKey].filter(function (i) {
					return i != value;
				});
			}

			leaf.value[wrapperKey].sort();

			leaf.valueEdit = _.isObject(leaf.value) && _.size(leaf.value) ? _(leaf.value).map().first() : leaf.value;
		};

		/**
  * Return the 'flat' value of a Mongo expression
  * This will always return the closest thing we have to a scalar primative
  * @param {Object|string} input The input expression to flatten
  * @returns {string|number} The nearest thing we can evaluate to a primative (or an empty string)
  *
  * @example
  * $ctrl.getFlatValue('foo') //= 'foo'
  * @example
  * $ctrl.getFlatValue({$eq: 'bar'}) //= 'bar'
  * @example
  * $ctrl.getFlatValue({$in: ['quz', 'qux']}) //= 'quz'
  */
		$ctrl.getFlatValue = function (input) {
			if (_.isString(input) || _.isNumber(input) || _.isBoolean(input) || _.isDate(input)) {
				// Already a primative
				return input;
			} else if (_.isObject(input) && _.size(input) == 1) {
				// Unwrap object value from object
				return _(input).values().first();
			} else if (_.isObject(input) && input.$regexp) {
				// RegExps - we can savely ignore the options object and guess at the expression
				return '/' + _.trim(input.$regexp, '/') + '/' + input.options;
			} else {
				// No idea how to convert - just return an empty string
				console.warn('Given up trying to flatten input value', input);
				return input;
			}
		};
		// }}}

		// Branch CRUD {{{
		$ctrl.add = function () {
			if ($ctrl.properties.some(function (p) {
				return !p.id;
			})) return; // Check there are no new items currently in the process of being added
			$ctrl.properties.push({ isMeta: false });

			// Wait for the page to redraw then force the dropdown to open
			// Yes I know this is a weird work around but we have to wait for the DOM to settle for some reason before we can add the `open` class - MC 2017-10-03
			var eventUnbind = $scope.$on('uiQueryQueryRepaint', function () {
				$element.find('.query-block > .new').addClass('open');
			});
		};

		$ctrl.remove = function (id) {
			$ctrl.properties = $ctrl.properties.filter(function (p) {
				return p.id != id;
			});
			$ctrl.exportBranch();
		};
		// }}}
	}]
})

/**
* Simple query which takes an array of possible selections and returns only those that are present within the leaf.valueEdit array
* This is used to display selected items in an array
* @param {array} items The array to filter
* @param {Object} leaf The leaf node to filter against
* @param {boolean} [invert=false] Whether to invert the result
* @returns {array} The filtered items array
*/
.filter('uiQueryBuilderFilterSelected', function () {
	return function (items, leaf, invert) {
		if (!items) return;

		return items.filter(function (i) {
			var doesInclude = leaf.valueEdit.includes(i.id);
			return invert ? !doesInclude : doesInclude;
		});
	};
})

/**
* Fire a $scope.$emit() with the given message when an ng-repeat render finishes
* @param {string} message The message to emit to this element scope upwards
* @example
* <div ng-repeat="widget in widgets" ng-repeat-emit="finished"></div>
*/
.directive('ngRepeatEmit', ['$rootScope', '$timeout', function ($rootScope, $timeout) {
	return {
		restrict: 'A',
		link: function link(scope, elem, attr) {
			if (scope.$last === true) $timeout(function () {
				return scope.$emit(attr.ngRepeatEmit);
			});
		}
	};
}]);
// }}}