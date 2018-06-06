angular.module('angular-ui-query-builder',[])

// Service: QueryBuilder {{{
.service('QueryBuilder', function() {
	var QueryBuilder = this;

	/**
	* Apply various tidy functions to a raw spec before we process it
	* @param {Object} spec The raw spec to clean
	* @returns {Object} The output spec post cleaning
	*/
	QueryBuilder.cleanSpec = spec => {
		return _(spec)
			.mapValues((v, k) => ({
				type: v.type,
				enum: _(v.enum)
					.map(e => _.isString(e) ? {id: e, title: _.startCase(e)} :e)
					.sortBy('title')
					.value(),
			}))
			.value();
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
			actions: [{id: '$eq', title: 'Equals'}],
			action: '$eq',
			canDelete: true,
		},
		populate: {type: 'hidden'},
		skip: {
			type: 'keyVal',
			actions: [{id: '$eq', title: 'Equals'}],
			action: '$eq',
			canDelete: true,
		},
		sort: {
			type: 'keyVal',
			actions: [{id: '$eq', title: 'Equals'}],
			action: '$eq',
			canDelete: false,
		},
	};

	/**
	* Returns a queryList collection from a query object
	* @param {Object} query The raw MongoDB / Sift object to transform from an object into a collection
	* @returns {array} An array where each parameter is represented as a object for easier handling
	*/
	QueryBuilder.queryToArray = (query, spec) => {
		// Actions applicable to all fields {{{
		var actions = [
			{id: '$eq', title: 'Equals'},
			{id: '$neq', title: 'Doesnt equal'},
			{id: '$lt', title: 'Is less than'},
			{id: '$lte', title: 'Is equal to or less than'},
			{id: '$gt', title: 'Is greater than'},
			{id: '$gte', title: 'Is equal or greater than'},
			{id: '$in', title: 'Is one of'},
			{id: '$nin', title: 'Is not one of'},
			{id: '$exists', title: 'Has a value'},
			{id: '$nexists', title: 'Does not have a value'},
		];
		// }}}

		return _(query)
			.pickBy((v, k) => {
				var maps =
					spec[k] // Maps onto a spec path
					|| k == '$and'
					|| k == '$or'
					|| QueryBuilder.metaProperties[k] // is a meta directive

				if (!maps) console.warn('query-builder', 'Incomming query path', k, 'Does not map to anything in spec', spec);
				return !!maps;
			})
			.map((v, k) => {
				var s = spec[k];
				var firstKey = _.isObject(v) && _(v).keys().first();
				var firstValue = _.isObject(v) ? _(v).values().first() : v;

				if ( // Looks like a meta 'search' entry?
					k == '$or'
					&& v.every(i => _.isObject(i) && _.keys(i).length == 1)
					&& v.map(i => _.chain(i).first().values().first().keys().find(i => i == '$regexp').value()).length == v.length // Every key has a $regexp search
				) {
					return {
						path: k,
						type: 'search',
						title: 'Search',
						value: // Horrible expression to find the first regexp value
							_.chain(v)
								.first()
								.values()
								.first()
								.get('$regexp')
								.value(),
						fields:
							_(v)
								.map(i => _.keys(i))
								.flatten()
								.value(),
						actions,
					};
				} else if (k == '$and' || k == '$or') { // Meta combinational types
					if (!_.isArray(v)) {
						console.warn('query-builder', 'Query path', k, 'is a meta key', v, 'but is not an array!', 'Given', typeof v);
						v = [];
					}

					return {
						path: k,
						type: 'binaryGroup',
						title:
							k == '$and' ? 'AND'
							: k == '$or' ? 'OR'
							: 'UNKNOWN',
						condition: k.replace(/\$/, ''),
						children: v.map(i => QueryBuilder.queryToArray(i, spec)),
						actions,
					};
				} else if (QueryBuilder.metaProperties[k]) { // Is a meta property
					return Object.assign({
						path: k,
						title: _.startCase(k),
						value: v,
						type: 'hidden',
						action: '$hidden',
						actions,
					}, QueryBuilder.metaProperties[k]);
				} else if (firstKey == '$exists') {
					return {
						path: k,
						title: v.title || _.startCase(k), // Create a title from the key if its omitted
						value: !!v,
						type: 'exists',
						action: '$exists',
						actions,
					};
				} else if (s.type == 'string' && _.isArray(s.enum) && s.enum.length) {
					return {
						path: k,
						title: v.title || _.startCase(k),
						type: 'enum',
						action:
							v.$in ? '$in'
							: v.$nin ? '$nin'
							: s.enum.length ? '$in'
							: '$eq',
						enum: s.enum,
						value:
							v.$in ? v.$in
							: v.$nin ? v.$nin
							: s.enum.length && !_.isArray(v) ? [v]
							: v,
						actions,
					};
				} else { // General fields
					return {
						path: k,
						title: v.title || _.startCase(k), // Create a title from the key if its omitted
						type:
							s.type == 'string' ? 'string'
							: s.type == 'number' ? 'number'
							: s.type == 'date' ? 'date'
							: 'string',
						action: '$eq',
						value:
							s.type == 'date' ? moment(firstValue).toDate() // Convert date string weirdness into real dates
							: firstValue,
						actions,
					}
				}
			})
			.value();
	};


	/**
	* Reverse of `queryToArray()`
	* @param {array} queryList the internal array composed by queryToArray
	* @returns {Object} A Mongo / Sift compatible object
	*/
	QueryBuilder.arrayToQuery = queryList => {
		var composer = ql =>
			_(ql)
				.mapKeys(ql => ql.path)
				.mapValues(ql => {
					switch (ql.type) {
						case 'string':
						case 'number':
						case 'date':
							if (ql.action == '$eq') {
								return ql.value;
							} else {
								return {[ql.action]: ql.value};
							}
						case 'enum':
							return {[ql.action]: ql.value};
						case 'exists':
							return {$exists: ql.action == '$exists'};
						case 'search':
							return ql.fields.map(f => ({
								[f]: {
									$regexp: ql.value,
									options: 'i',
								},
							}));
						case 'keyVal':
						case 'hidden':
							return ql.value;
						default:
							console.warn('Unknown type to convert:', ql.type);
					}
				})
				.value()

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
		spec: '<',
	},
	template: `
		<div class="ui-query-builder">
			<div class="query-container">
				<ui-query-builder-group
					qb-group="$ctrl.qbQuery"
					qb-spec="$ctrl.qbSpec"
				></ui-query-builder-group>
			</div>
		</div>
	`,
	controller: function($scope, $timeout, QueryBuilder) {
		var $ctrl = this;

		// Main loader {{{
		$ctrl.qbSpec;
		$ctrl.qbQuery;

		var initUnwatch = $scope.$watchGroup(['$ctrl.query', '$ctrl.spec'], ()=> {
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
		$scope.$on('queryBuilder.change', (e, replaceQuery) => $timeout(()=> { // Timeout to wait for Angular to catch up with its low level populates
			if (replaceQuery) { // If we're given an entire query to overwrite - recompute it
				$ctrl.query = replaceQuery;
				$ctrl.qbQuery = QueryBuilder.queryToArray($ctrl.query, $ctrl.qbSpec);
			}

			$ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);
		}));


		/**
		* Remove an item from the query by path
		* @param {Object} event
		* @param {string} path The path to remove
		*/
		$scope.$on('queryBuilder.pathAction.drop', (e, path) => {
			$ctrl.qbQuery = $ctrl.qbQuery.filter(p => p.path != path);
			$ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);
		});


		/**
		* Swap an item from within query by path
		* @param {Object} event
		* @param {string} path The path to swap
		* @param {string} newPath The new path to use
		*/
		$scope.$on('queryBuilder.pathAction.swap', (e, path, newPath) => {
			// Drop existing path
			$ctrl.qbQuery = $ctrl.qbQuery.filter(p => p.path != path);
			$ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);

			// Add new path query (also performs a recompute)
			$scope.$emit('queryBuilder.pathAction.add', newPath);
		});


		/**
		* Add a new item by path
		* @param {Object} event
		* @param {string} path The new path to add
		*/
		$scope.$on('queryBuilder.pathAction.add', (e, path) => {
			// Append new path and set to blank
			$ctrl.query[path] = '';
			$ctrl.qbQuery = QueryBuilder.queryToArray($ctrl.query, $ctrl.qbSpec);

			// Recompute
			$ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);
		});
	},
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
		qbSpec: '<',
	},
	template: `
		<div ng-repeat="row in $ctrl.qbGroup | filter:$ctrl.qbGroupFilter" meta-key="{{row.path}}">
			<ui-query-builder-row
				qb-item="row"
				qb-spec="$ctrl.qbSpec"
			></ui-query-builder-row>
		</div>
		<div class="query-row">
			<div class="query-container">
				<div class="query-block">
					<button ng-click="$ctrl.add()" type="button" class="btn-add"></button>
				</div>
			</div>
		</div>
	`,
	controller: function($scope, QueryBuilder) {
		var $ctrl = this;

		$ctrl.qbGroupFilter = item => item.type != 'hidden';
	},
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
		qbSpec: '<',
	},
	controller: function($scope, QueryBuilder) {
		var $ctrl = this;

		$ctrl.delete = path => $scope.$emit('queryBuilder.pathAction.drop', path);
		$ctrl.setChanged = ()=> $scope.$emit('queryBuilder.change');
	},
	template: `
		<div ng-switch="$ctrl.qbItem.type">
			<!-- $and / $or condition {{{ -->
			<div ng-switch-when="binaryGroup" class="query-row">
				<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>
				<div class="query-block">
					<div class="btn btn-1 btn-block">
						{{$ctrl.qbItem.title}}
					</div>
				</div>
				<div ng-repeat="conditional in $ctrl.qbItem.children" class="query-container clearfix">
					<ui-query-builder-group
						qb-group="conditional"
						qb-spec="$ctrl.spec"
					></ui-query-builder-group>
				</div>
			</div>
			<!-- }}} -->
			<!-- String {{{ -->
			<div ng-switch-when="string" class="query-row">
				<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>
				<ui-query-builder-path
					class="query-block"
					level="1"
					selected="$ctrl.qbItem.path"
					qb-spec="$ctrl.qbSpec"
				></ui-query-builder-path>
				<ui-query-builder-block-menu
					class="query-block"
					level="2"
					selected="$ctrl.qbItem.action"
					options="$ctrl.qbItem.actions"
				></ui-query-builder-block-menu>
				<div class="query-block">
					<div class="btn btn-3 btn-block">
						<input
							ng-model="$ctrl.qbItem.value"
							ng-change="$ctrl.setChanged()"
							type="text"
							class="form-control"
						/>
					</div>
				</div>
			</div>
			<!-- }}} -->
			<!-- Enum {{{ -->
			<div ng-switch-when="enum" class="query-row">
				<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>
				<ui-query-builder-path
					class="query-block"
					level="1"
					selected="$ctrl.qbItem.path"
					qb-spec="$ctrl.qbSpec"
				></ui-query-builder-path>
				<ui-query-builder-block-menu
					class="query-block"
					level="2"
					selected="$ctrl.qbItem.action"
					options="$ctrl.qbItem.actions"
				></ui-query-builder-block-menu>
				<ui-query-builder-block-menu-multiple
					class="query-block"
					level="3"
					selected="$ctrl.qbItem.value"
					options="$ctrl.qbItem.enum"
				></ui-query-builder-block-menu-multiple>
			</div>
			<!-- }}} -->
			<!-- Date {{{ -->
			<div ng-switch-when="date" class="query-row">
				<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>
				<ui-query-builder-path
					class="query-block"
					level="1"
					selected="$ctrl.qbItem.path"
					qb-spec="$ctrl.qbSpec"
				></ui-query-builder-path>
				<ui-query-builder-block-menu
					class="query-block"
					level="2"
					selected="$ctrl.qbItem.action"
					options="$ctrl.qbItem.actions"
				></ui-query-builder-block-menu>
				<div class="query-block">
					<div class="btn btn-3 btn-block">
						<input
							ng-model="$ctrl.qbItem.value"
							ng-change="$ctrl.setChanged()"
							type="date"
							class="form-control"
						/>
					</div>
				</div>
			</div>
			<!-- }}} -->
			<!-- Number {{{ -->
			<div ng-switch-when="number" class="query-row">
				<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>
				<ui-query-builder-path
					class="query-block"
					level="1"
					selected="$ctrl.qbItem.path"
					qb-spec="$ctrl.qbSpec"
				></ui-query-builder-path>
				<ui-query-builder-block-menu
					class="query-block"
					level="2"
					selected="$ctrl.qbItem.action"
					options="$ctrl.qbItem.actions"
				></ui-query-builder-block-menu>
				<div class="query-block">
					<div class="btn btn-3 btn-block">
						<input
							ng-value="$ctrl.qbItem.value"
							ng-changed="$ctrl.setChanged()"
							type="number"
							class="form-control"
						/>
					</div>
				</div>
			</div>
			<!-- }}} -->
			<!-- Exists {{{ -->
			<div ng-switch-when="exists" class="query-row">
				<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>
				<ui-query-builder-path
					class="query-block"
					level="1"
					selected="$ctrl.qbItem.path"
					qb-spec="$ctrl.qbSpec"
				></ui-query-builder-path>
				<ui-query-builder-block-menu
					class="query-block"
					level="2"
					selected="$ctrl.qbItem.action"
					options="$ctrl.qbItem.actions"
				></ui-query-builder-block-menu>
			</div>
			<!-- }}} -->
			<!-- Search {{{ -->
			<div ng-switch-when="search" class="query-row">
				<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>
				<ui-query-builder-path
					class="query-block"
					level="1"
					selected="$ctrl.qbItem.path"
					qb-spec="$ctrl.qbSpec"
				></ui-query-builder-path>
				<div class="query-block">
					<div class="btn btn-2 btn-block">
						<input
							ng-model="$ctrl.qbItem.value"
							ng-change="$ctrl.setChanged()"
							type="text"
							class="form-control"
						/>
					</div>
				</div>
			</div>
			<!-- }}} -->
			<!-- keyVal (Only title + value) {{{ -->
			<div ng-switch-when="keyVal" class="query-row">
				<a ng-if="$ctrl.qbItem.canDelete === undefined || $ctrl.qbItem.canDelete" ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>
				<ui-query-builder-block
					class="query-block"
					level="1"
					title="$ctrl.qbItem.title"
				></ui-query-builder-block>
				<div class="query-block">
					<div class="btn btn-2 btn-block">
						<input
							ng-model="$ctrl.qbItem.value"
							ng-change="$ctrl.setChanged()"
							type="text"
							class="form-control"
						/>
					</div>
				</div>
			</div>
			<!-- }}} -->
			<!-- Unknown {{{ -->
			<div ng-switch-default class="query-row">
				<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>
				<ui-query-builder-path
					class="query-block"
					level="1"
					selected="$ctrl.qbItem.path"
					qb-spec="$ctrl.qbSpec"
				></ui-query-builder-path>
				<div class="query-block">
					<div class="btn btn-warning btn-block">
						Unknown handler: {{$ctrl.qbItem.type}}
					</div>
				</div>
			</div>
			<!-- }}} -->
		</div>
	`,
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
		qbSpec: '<',
	},
	controller: function($scope) {
		var $ctrl = this;

		$ctrl.setSelected = option => $scope.$emit('queryBuilder.pathAction.swap', $ctrl.selected, option);

		$ctrl.options;
		$ctrl.$onInit = ()=> {
			$ctrl.options = _.map($ctrl.qbSpec, (info, path) => Object.assign({}, {
				path,
				title: _.startCase(path),
			}, info));

			$ctrl.selectedOption = $ctrl.options.find(p => p.path == $ctrl.selected);
		};
	},
	template: `
		<a class="btn btn-block btn-{{$ctrl.level}} dropdown-toggle" data-toggle="dropdown">
			{{$ctrl.selectedOption.title}}
			<i class="fa fa-caret-down"></i>
		</a>
		<ul class="dropdown-menu pull-right">
			<li ng-repeat="path in $ctrl.options track by path.path"><a ng-click="$ctrl.setSelected(path.path)">{{path.title}}</a></li>
		</ul>
	`,
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
		title: '<',
	},
	controller: function($scope) {
		var $ctrl = this;
	},
	template: `
		<a class="btn btn-block btn-{{$ctrl.level}}">
			{{$ctrl.title}}
		</a>
	`,
})
// }}}

// Component: uiQueryBuilderBlockMenu {{{
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
		selected: '=',
	},
	controller: function($scope) {
		var $ctrl = this;

		$ctrl.setSelected = option => {
			$ctrl.selected = option.id;
			$scope.$emit('queryBuilder.change');
		};

		$ctrl.selectedOption;
		$scope.$watchGroup(['$ctrl.options', '$ctrl.selected'], ()=> {
			$ctrl.selectedOption = $ctrl.options.find(i => i.id == $ctrl.selected);
		});
	},
	template: `
		<a class="btn btn-block btn-{{$ctrl.level}} dropdown-toggle" data-toggle="dropdown">
			{{$ctrl.selectedOption.title}}
			<i class="fa fa-caret-down"></i>
		</a>
		<ul class="dropdown-menu pull-right">
			<li ng-repeat="option in $ctrl.options track by option.id"><a ng-click="$ctrl.setSelected(option)">{{option.title}}</a></li>
		</ul>
	`,
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
		selected: '=',
	},
	controller: function($scope) {
		var $ctrl = this;

		$ctrl.toggle = option => {
			if (!$ctrl.selected) $ctrl.selected = [];

			if ($ctrl.selected.includes(option.id)) {
				$ctrl.selected = $ctrl.selected.filter(i => i != option.id);
			} else {
				$ctrl.selected.push(option.id);
			}
			$scope.$emit('queryBuilder.change');
		};

		$ctrl.selectedOptions;
		$scope.$watch('$ctrl.selected', ()=> {
			$ctrl.selectedOptions = $ctrl.options
				.filter(i => ($ctrl.selected || []).includes(i.id))

			$ctrl.options.forEach(o => o.selected = $ctrl.selectedOptions.some(s => s.id == o.id));
		}, true);
	},
	template: `
		<a class="btn btn-block btn-{{$ctrl.level}} dropdown-toggle" data-toggle="dropdown">
			<span ng-repeat="item in $ctrl.selectedOptions track by item.id" class="pill">
				{{item.title}}
			</span>
			<i class="fa fa-caret-down"></i></a>
		</a>
		<ul class="dropdown-menu pull-right">
			<li ng-repeat="option in $ctrl.options track by option.id">
				<a ng-click="$ctrl.toggle(option)">
					<i class="fa fa-fw" ng-class="option.selected ? 'fa-check-square-o' : 'fa-square-o'"></i>
					{{option.title}}
				</a>
			</li>
		</ul>
	`,
})
// }}}
