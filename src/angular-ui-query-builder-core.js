angular.module('angular-ui-query-builder',[])

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
				var maps = spec[k] // Maps onto a spec path
					|| k == '$and'
					|| k == '$or';
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
				} else if (firstKey == '$exists') {
					return {
						path: k,
						title: v.title || _.startCase(k), // Create a title from the key if its omitted
						value: !!v,
						type: 'exists',
						action: '$exists',
						actions,
					};
				} else if (s.type == 'string' && _.isArray(s.enum)) {
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
						action: firstKey,
						value:
							s.type == 'date' ? moment(firstValue).format('YYYY-MM-DD') // Convert date objects back to strings
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
						default:
							console.warn('Unknown type to convert:', ql.type);
					}
				})
				.value()

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
		<div ng-repeat="row in $ctrl.qbGroup">
			<ui-query-builder-row
				qb-item="row"
				qb-spec="$ctrl.qbSpec"
			></ui-query-builder-row>
		</div>
	`,
	controller: function($scope, QueryBuilder) {
		var $ctrl = this;
	},
})


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
				<div class="query-block">
					<div class="btn btn-1 btn-block">
						{{$ctrl.qbItem.title}}
					</div>
				</div>
				<ui-query-builder-block-menu
					class="query-block"
					level="2"
					selected="$ctrl.qbItem.action"
					options="$ctrl.qbItem.actions"
				></ui-query-builder-block-menu>
				<div class="query-block">
					<div class="btn btn-3 btn-block">
						<input ng-value="$ctrl.qbItem.value" type="text" class="form-control"/>
					</div>
				</div>
			</div>
			<!-- }}} -->
			<!-- Enum {{{ -->
			<div ng-switch-when="enum" class="query-row">
				<div class="query-block">
					<div class="btn btn-1 btn-block">
						{{$ctrl.qbItem.title}}
					</div>
				</div>
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
						<input ng-value="$ctrl.qbItem.value" type="date" class="form-control"/>
					</div>
				</div>
			</div>
			<!-- }}} -->
			<!-- Number {{{ -->
			<div ng-switch-when="number" class="query-row">
				<div class="query-block">
					<div class="btn btn-1 btn-block">
						{{$ctrl.qbItem.title}}
					</div>
				</div>
				<ui-query-builder-block-menu
					class="query-block"
					level="2"
					selected="$ctrl.qbItem.action"
					options="$ctrl.qbItem.actions"
				></ui-query-builder-block-menu>
				<div class="query-block">
					<div class="btn btn-3 btn-block">
						<input ng-value="$ctrl.qbItem.value" type="number" class="form-control"/>
					</div>
				</div>
			</div>
			<!-- }}} -->
			<!-- Exists {{{ -->
			<div ng-switch-when="exists" class="query-row">
				<div class="query-block">
					<div class="btn btn-1 btn-block">
						{{$ctrl.qbItem.title}}
					</div>
				</div>
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
				<div class="query-block">
					<div class="btn btn-1 btn-block">
						{{$ctrl.qbItem.title}}
					</div>
				</div>
				<div class="query-block">
					<div class="btn btn-2 btn-block">
						<input ng-value="$ctrl.qbItem.value" ng-keyup="$ctrl.setChanged()" type="text" class="form-control"/>
					</div>
				</div>
			</div>
			<!-- }}} -->
			<!-- Unknown {{{ -->
			<div ng-switch-default class="query-row">
				<div class="query-block">
					<div class="btn btn-warning btn-block">
						{{$ctrl.qbItem.title}}
					</div>
				</div>
				<div class="query-block">
					<div class="btn btn-warning btn-block">
						Unknown handler: {{$ctrl.qbItem.type}}
					</div>
				</div>
			</div>
			<!-- }}} -->
			<!-- Add button {{{
			<div class="query-row">
				<div class="query-block btn-group">
					<a ng-click="$ctrl.add()" class="btn btn-add"></a>
				</div>
			</div>
			}}} -->
		</div>
	`,
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
		<a class="btn btn-block btn-{{$ctrl.level}} dropdown-toggle" data-toggle="dropdown"> {{$ctrl.selectedOption.title}} <i class="fa fa-caret-down"></i></a>
		<ul class="dropdown-menu pull-right">
			<li ng-repeat="option in $ctrl.options track by option.id"><a ng-click="$ctrl.setSelected(option)">{{option.title}}</a></li>
		</ul>
	`,
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



// Main widget {{{
.component('uiQueryBuilderOLD', {
	bindings: {
		query: '=',
		spec: '<',
	},
	template: `
		<div class="ui-query-builder clearfix">
			<div class="query-container">
				<!-- Meta field: sort {{{ -->
				<div class="query-row">
					<!-- Path component {{{ -->
					<div class="query-block">
						<div class="btn-group btn-block">
							<a class="btn btn-1 btn-block">
								Sort by
							</a>
						</div>
					</div>
					<!-- }}} -->
					<!-- Query operand component {{{ -->
					<div class="query-block btn-group">
						<div class="btn btn-block btn-2">
							<input ng-model="$ctrl.query.sort" type="text" class="form-control"/>
						</div>
					</div>
					<!-- }}} -->
				</div>
				<!-- }}} -->
				<!-- Meta field: limit {{{ -->
				<div class="query-row">
					<!-- Path component {{{ -->
					<div class="query-block">
						<div class="btn-group btn-block">
							<a class="btn btn-1 btn-block">
								Limited to
							</a>
						</div>
					</div>
					<!-- }}} -->
					<!-- Query operand component {{{ -->
					<div class="query-block btn-group">
						<div class="btn btn-block btn-2">
							<input ng-model="$ctrl.query.limit" type="number" class="form-control"/>
						</div>
					</div>
					<div class="query-block btn-group">
						<div class="btn btn-block btn-1">
							Skipping
						</div>
					</div>
					<div class="query-block btn-group">
						<div class="btn btn-block btn-2">
							<input ng-model="$ctrl.query.skip" type="number" class="form-control"/>
						</div>
					</div>
					<!-- }}} -->
				</div>
				<!-- }}} -->
				<div class="query-row">
					<div class="query-block">
						<!-- FIXME: Need branch title -->
					</div>
					<ui-query-builder-branch
						class="query-container"
						branch="$ctrl.query"
						spec="$ctrl.spec"
					></ui-query-builder-branch>
				</div>
			</div>
		</div>
	`,
	controller: function($scope) {
		var $ctrl = this;

		// Clean up incomming spec {{{
		$scope.$watch('$ctrl.spec', ()=> {
			_.forEach($ctrl.spec, (v, k) => {
				if (!v.title) v.title = _.startCase(k); // Create a title from the key if its omitted
				if (v.enum && _.isArray(v.enum)) { // Ensure enums are aways collections
					v.enum = _(v.enum)
						.map(e => _.isString(e) ? {id: e, title: _.startCase(e)} :e)
						.sortBy('title')
						.value();
				}
			})
		});
		// }}}
	},
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
		spec: '<',
	},
	template: `
		<!-- AND blocks {{{ -->
		<div ng-repeat="leaf in $ctrl.properties | filter:{isMeta:true,id:'$and'} track by leaf.id" ng-switch="leaf.spec.type" ng-repeat-emit="uiQueryQueryRepaint" class="query-row">
			<div ng-repeat="choiceLeaf in leaf.value">
				<ui-query-builder-branch
					branch="choiceLeaf"
					spec="$ctrl.spec"
				></ui-query-builder-branch>
			</div>
		</div>
		<!-- }}} -->
		<!-- OR blocks {{{ -->
		<div ng-repeat="leaf in $ctrl.properties | filter:{isMeta:true,id:'$or'} track by leaf.id" ng-switch="leaf.spec.type" ng-repeat-emit="uiQueryQueryRepaint" class="query-row">
			<div ng-repeat="choiceLeaf in leaf.value">
				<ui-query-builder-branch
					branch="choiceLeaf"
					spec="$ctrl.spec"
				></ui-query-builder-branch>
			</div>
		</div>
		<!-- }}} -->
		<!-- Main fields {{{ -->
		<div ng-repeat="leaf in $ctrl.properties | filter:{isMeta:false} track by leaf.id" ng-switch="leaf.spec.type" ng-repeat-emit="uiQueryQueryRepaint" class="query-row">
			<!-- Path component {{{ -->
			<button ng-click="$ctrl.remove(leaf.id); $event.stopPropagation()" class="btn btn-trash btn-danger" type="button"></button>
			<div class="query-block">
				<div class="btn-group btn-block" ng-class="{new: !leaf.id}">
					<a class="btn btn-1 btn-block dropdown-toggle" data-toggle="dropdown">
						{{$ctrl.spec[leaf.id].title || 'Select...'}}
						<i class="fa fa-caret-down"></i>
					</a>
					<ul class="dropdown-menu pull-right">
						<li ng-repeat="(key, val) in $ctrl.spec track by key" ng-class="key == leaf.id && 'active'">
							<a ng-click="$ctrl.setField(leaf, key)">
								{{$ctrl.spec[key].title}}
							</a>
						</li>
					</ul>
				</div>
			</div>
			<!-- }}} -->
			<!-- Query type component {{{ -->
			<div ng-show="leaf.valueOperand" class="query-block">
				<div class="btn-group btn-block">
					<a class="btn btn-2 btn-block dropdown-toggle" data-toggle="dropdown">
						{{($ctrl.operandsByID[leaf.valueOperand][leaf.spec.type] || $ctrl.operandsByID[leaf.valueOperand].base).title}}
						<i class="fa fa-caret-down"></i>
					</a>
					<ul class="dropdown-menu pull-right">
						<li><a ng-click="$ctrl.setWrapper(leaf, '$eq')">Is</a></li>
						<li><a ng-click="$ctrl.setWrapper(leaf, '$ne')">Is not</a></li>
						<li><a ng-click="$ctrl.setWrapper(leaf, '$in')">One of</a></li>
						<li><a ng-click="$ctrl.setWrapper(leaf, '$nin')">Not one of</a></li>
						<li ng-if="leaf.spec.type == 'number'"><a ng-click="$ctrl.setWrapper(leaf, '$gt')">Above</a></li>
						<li ng-if="leaf.spec.type == 'number'"><a ng-click="$ctrl.setWrapper(leaf, '$lt')">Below</a></li>
						<li ng-if="leaf.spec.type == 'date'"><a ng-click="$ctrl.setWrapper(leaf, '$gt')">Is after</a></li>
						<li ng-if="leaf.spec.type == 'date'"><a ng-click="$ctrl.setWrapper(leaf, '$gte')">Is at least</a></li>
						<li ng-if="leaf.spec.type == 'date'"><a ng-click="$ctrl.setWrapper(leaf, '$lt')">Is before</a></li>
						<li ng-if="leaf.spec.type == 'date'"><a ng-click="$ctrl.setWrapper(leaf, '$lte')">Is at most</a></li>
						<li><a ng-click="$ctrl.setWrapper(leaf, '$exists')">Has a value</a></li>
					</ul>
				</div>
			</div>
			<!-- }}} -->
			<!-- Query operand component {{{ -->
			<div ng-show="leaf.valueOperand" class="query-block btn-group" ng-switch="(operandConfig = $ctrl.operandsByID[leaf.valueOperand][leaf.spec.type] || $ctrl.operandsByID[leaf.valueOperand].base).type">
				<div ng-switch-when="string" class="btn btn-block btn-3">
					<input ng-model="leaf.valueEdit" ng-change="$ctrl.setValue(leaf)" type="text" class="form-control"/>
				</div>
				<div ng-switch-when="array" class="btn btn-block btn-3 btn-group">
					<div class="btn-fill text-left dropdown-toggle" data-toggle="dropdown">
						<span class="pill" ng-repeat="item in $ctrl.spec[leaf.id].enum | uiQueryBuilderFilterSelected:leaf track by item.id">
							{{item.title}}
						</span>
						<span ng-if="!leaf.valueEdit.length">...</span>
						<i class="fa fa-caret-down"></i>
					</div>
					<ul class="dropdown-menu pull-right">
						<li ng-repeat="item in $ctrl.spec[leaf.id].enum | uiQueryBuilderFilterSelected:leaf:false track by item.id">
							<a ng-click="$ctrl.setValueIncluded(leaf, item.id, false)">
								<i class="fa fa-fw fa-check-square text-primary"></i>
								{{item.title}}
							</a>
						</li>
						<li ng-repeat="item in $ctrl.spec[leaf.id].enum | uiQueryBuilderFilterSelected:leaf:true track by item.id">
							<a ng-click="$ctrl.setValueIncluded(leaf, item.id, true)">
								<i class="fa fa-fw fa-square-o text-primary"></i>
								{{item.title}}
							</a>
						</li>
					</ul>
				</div>
				<div ng-switch-when="boolean" class="btn btn-block btn-3" ng-click="$ctrl.setValue(leaf, !leaf.valueEdit)">
					<i class="fa fa-fw" ng-class="leaf.valueEdit ? 'fa-check-square-o' : 'fa-square-o'"></i>
					{{leaf.valueEdit ? operandConfig.textTrue : operandConfig.textFalse}}
				</div>
				<div ng-switch-when="date" class="btn btn-block btn-3">
					<input ng-model="leaf.valueEdit" ng-change="$ctrl.setValue(leaf)" type="date" class="form-control"/>
				</div>
				<div ng-switch-default class="btn btn-block btn-3">
					Unknown operand: <code>{{leaf.valueOperand}}</code>
				</div>
			</div>
			<!-- }}} -->
		</div>
		<!-- Add button {{{ -->
		<button ng-click="$ctrl.add()" class="btn btn-add btn-success" type="button"></button>
		<!-- }}} -->
	`,
	controller: function($element, $scope) {
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
				setter: v => ({$eq: v}),
				export: leaf => leaf.valueEdit,
				base: {
					title: 'Is',
					type: 'string',
				},
				boolean: {
					title: 'Is',
					type: 'boolean',
					textTrue: 'Enabled',
					textFalse: 'Disabled',
				},
				date: {
					title: 'Is exactly',
					type: 'date',
				},
			},
			{
				id: '$ne',
				setter: v => ({$ne: v}),
				export: leaf => ({$ne: leaf.valueEdit}),
				base: {
					title: 'Is not',
					type: 'string',
				},
				boolean: {
					title: 'Is not',
					type: 'boolean',
					textTrue: 'Enabled',
					textFalse: 'Disabled',
				},
				date: {
					title: 'Is not exactly',
					type: 'date',
				},
			},
			{
				id: '$in',
				setter: v => ({$in: _.isArray(v) ? v.split(/\s*,\s*/) : [v]}),
				export: leaf => ({$in: leaf.value.$in}),
				base: {
					title: 'One of',
					type: 'array',
				},
			},
			{
				id: '$nin',
				setter: v => ({$nin: _.isArray(v) ? v.split(/\s*,\s*/) : [v]}),
				export: leaf => ({$nin: leaf.value.$nin}),
				base: {
					title: 'Not one of',
					type: 'array',
				},
			},
			{
				id: '$gt',
				setter: v => ({$gt: v}),
				export: leaf => ({$gt: leaf.value.$gt}),
				base: {
					title: 'Above',
					type: 'number',
				},
				date: {
					title: 'Is after',
					type: 'date',
				},
			},
			{
				id: '$gte',
				setter: v => ({$gte: v}),
				export: leaf => ({$gte: leaf.value.$gte}),
				base: {
					title: 'Above or equals',
					type: 'number',
				},
				date: {
					title: 'Is at least',
					type: 'date',
				},
			},
			{
				id: '$lt',
				setter: v => ({$lt: v}),
				export: leaf => ({$lt: leaf.value.$lt}),
				base: {
					title: 'Below',
					type: 'number',
				},
				date: {
					title: 'Is before',
					type: 'date',
				},
			},
			{
				id: '$lte',
				setter: v => ({$lt: v}),
				export: leaf => ({$lte: leaf.value.$lte}),
				base: {
					title: 'Below or equals',
					type: 'number',
				},
				date: {
					title: 'Is at most',
					type: 'date',
				},
			},
			{
				id: '$exists',
				setter: v => ({$exists: !!v}),
				export: leaf => ({$exists: leaf.value.$exists}),
				base: {
					title: 'Has a value',
					type: 'boolean',
					textTrue: 'Has a value',
					textFalse: 'Has a value', // This isn't technically right but its right next to a disabled checkbox so it makes sense in context
				},
			},
			{
				id: '$regexp',
				setter: v => ({$regexp: v}),
				export: leaf => ({$regexp: leaf.value.$regexp}),
				base: {
					title: 'Matches',
					type: 'string',
				},
			},
		];
		$ctrl.operandsByID = _.mapKeys($ctrl.operands, 'id');
		// }}}

		// $ctrl.getSpec() {{{
		$ctrl.getSpec = (key, val, path) => {
			// Spec present {{{
			if ($ctrl.spec[path]) {
				return $ctrl.spec[path];
			// }}}
			// Meta parent types {{{
			} else if (key == '$and' || key == '$or') {
				return {type: 'group', type: key};
			// }}}
			// Guessing {{{
			} else if (_.isString(val)) {
				return {type: 'string'};
			} else if (_.isNumber(val)) {
				return {type: 'number'};
			// }}}
			// Fallback {{{
			} else {
				return {type: 'string'};
			}
			// }}}
		};
		// }}}

		// $ctrl.translateBranch() {{{
		$ctrl.translateBranch = (branch, pathSegments = []) =>
			_($ctrl.branch)
				.map((v, k) => ({
					id: k,
					value: v,
					valueEdit: $ctrl.getFlatValue(v),
					valueOperand: _.isObject(v) ? _(v).keys().first() : '$eq',
					isMeta: (''+k).startsWith('$') || ['sort', 'skip', 'limit'].includes(k),
					spec: $ctrl.getSpec(k, v, k),
					path: pathSegments.concat([k]),
				}))
				.sortBy(p => p.isMeta ? `Z${p.id}` : `A${p.id}`) // Force meta items to the end
				.value();
		// }}}

		// $ctrl.exportBranch() {{{
		/**
		* Export the local $ctrl.properties branch back into the upstream branch
		*/
		$ctrl.exportBranch = ()=> {
			$ctrl.branch = _($ctrl.properties)
				.mapKeys(b => b.id)
				.mapValues(b => $ctrl.operandsByID[b.valueOperand].export(b))
				.value()
		};
		// }}}

		// Convert branch -> properties {{{
		// We have to do this to sort appropriately and allow iteration over dollar prefixed keys
		$ctrl.properties;
		$scope.$watchGroup(['$ctrl.branch', '$ctrl.spec'], ()=> {
			if (!$ctrl.branch || !$ctrl.spec) return; // Not yet ready
			$ctrl.properties = $ctrl.translateBranch($ctrl.branch);
		});
		// }}}

		// Branch interaction {{{
		$ctrl.setField = (leaf, field) => {
			leaf.id = field;
			leaf.path = [field];
			leaf.value = undefined;
			leaf.valueEdit = undefined;
			leaf.valueOperand = '$eq';
			leaf.spec = $ctrl.spec[field];
			$ctrl.setValue(leaf);
		};

		$ctrl.setWrapper = (leaf, type) => {
			if (leaf.valueOperand == '$eq' && type == '$ne') { // Negate
				leaf.valueOperand = '$ne';
				leaf.valueEdit = $ctrl.getFlatValue(leaf.value);
				leaf.value = {$ne: leaf.valueEdit};
			} else if (leaf.valueOperand == '$ne' && type == '$eq') {
				leaf.valueOperand = '$eq';
				leaf.valueEdit = $ctrl.getFlatValue(leaf.value);
				leaf.value = {$eq: leaf.valueEdit};
			} else if (leaf.valueOperand == '$in' && type == '$eq') { // Flatten array into scalar
				leaf.valueOperand = '$eq';
				leaf.value = leaf.valueEdit = $ctrl.getFlatValue(leaf.value);
			} else if ((leaf.valueOperand == '$eq' || leaf.valueOperand === undefined) && type == '$in') { // Roll scalar into array
				leaf.valueOperand = '$in';
				leaf.valueEdit = $ctrl.getFlatValue(leaf.value);
				leaf.value = {$in: [leaf.valueEdit]};
			} else if (type == '$exists') { // Convert anything to exists - force it to be a boolean
				leaf.valueOperand = '$exists';
				leaf.valueEdit = true;
				leaf.value = {$exists: leaf.valueEdit};
			} else { // Unknown swapping - convert to an object with one key
				console.log('UNHANDLED TYPE CONVERT:', leaf.type, '=>', type);
				var newValue = $ctrl.getFlatValue(leaf.value);

				leaf.valueOperand = type;
				leaf.valueEdit = newValue;
				leaf.value = {[leaf.valueOperand]: leaf.valueEdit};
			}

			// Set the upstream model value
			$ctrl.exportBranch();
		};


		/**
		* Set the value of a leaf
		* @param {Object} leaf The leaf to change the value of
		* @param {*} [value] Optional value to set, if omitted the bound leaf.valueEdit will be used
		*/
		$ctrl.setValue = (leaf, value) => {
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
		$ctrl.setValueIncluded = (leaf, value, included) => {
			var wrapperKey = _(leaf.value).keys().first();
			if (!wrapperKey) throw new Error('Tried to set array inclusion on non wrapped key: ' + leaf.value);

			var isIncluded = leaf.value[wrapperKey].includes(value);
			if (included && !isIncluded) {
				leaf.value[wrapperKey].push(value);
			} else if (!included && isIncluded) {
				leaf.value[wrapperKey] = leaf.value[wrapperKey].filter(i => i != value);
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
		$ctrl.getFlatValue = input => {
			if (_.isString(input) || _.isNumber(input) || _.isBoolean(input) || _.isDate(input)) { // Already a primative
				return input;
			} else if (_.isObject(input) && _.size(input) == 1) { // Unwrap object value from object
				return _(input).values().first();
			} else if (_.isObject(input) && input.$regexp) { // RegExps - we can savely ignore the options object and guess at the expression
				return '/' + _.trim(input.$regexp, '/') + '/' + input.options;
			} else { // No idea how to convert - just return an empty string
				console.warn('Given up trying to flatten input value', input);
				return input;
			}
		};
		// }}}

		// Branch CRUD {{{
		$ctrl.add = ()=> {
			if ($ctrl.properties.some(p => !p.id)) return; // Check there are no new items currently in the process of being added
			$ctrl.properties.push({isMeta: false});

			// Wait for the page to redraw then force the dropdown to open
			// Yes I know this is a weird work around but we have to wait for the DOM to settle for some reason before we can add the `open` class - MC 2017-10-03
			var eventUnbind = $scope.$on('uiQueryQueryRepaint', ()=> {
				$element.find('.query-block > .new').addClass('open');
			});
		};

		$ctrl.remove = id => {
			$ctrl.properties = $ctrl.properties.filter(p => p.id != id);
			$ctrl.exportBranch();
		};
		// }}}
	},
})

/**
* Simple query which takes an array of possible selections and returns only those that are present within the leaf.valueEdit array
* This is used to display selected items in an array
* @param {array} items The array to filter
* @param {Object} leaf The leaf node to filter against
* @param {boolean} [invert=false] Whether to invert the result
* @returns {array} The filtered items array
*/
.filter('uiQueryBuilderFilterSelected', function() {
	return function(items, leaf, invert) {
		if (!items) return;

		return items.filter(i => {
			var doesInclude = leaf.valueEdit.includes(i.id);
			return (invert ? !doesInclude : doesInclude);
		});
	};
})

/**
* Fire a $scope.$emit() with the given message when an ng-repeat render finishes
* @param {string} message The message to emit to this element scope upwards
* @example
* <div ng-repeat="widget in widgets" ng-repeat-emit="finished"></div>
*/
.directive('ngRepeatEmit', function($rootScope, $timeout) {
	return {
		restrict: 'A',
		link: function (scope, elem, attr) {
			if (scope.$last === true) $timeout(()=> scope.$emit(attr.ngRepeatEmit));
		},
	};
})
// }}}
