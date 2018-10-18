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
	* Actions that can apply to all fields by default
	* The contents of this array are mutated by QueryBuilder.queryPathPrototype to select the items that are actually applicable
	* @var {array}
	*/
	QueryBuilder.queryPathPrototypeActions = [
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


	/**
	* Utility function for QueryBuilder.queryToArray which returns a prototype of a query element based on its meta properties
	* For example if 'foo' has a spec which defines it as a string, the string options are populated (['$eq', '$ne'...]) accordingly
	* @param {string} path The Mongo path of the item to prototype
	* @param {Object} [operand={}] An existing query infrastructure
	* @return {Object} A prototype qbTable collection item representing the spec of the path
	*/
	QueryBuilder.queryPathPrototype = (path, operand = {}, spec) => {
		var pathSpec = spec[path];
		var firstKey = _.isObject(operand) && _(operand).keys().first();
		var firstValue = _.isObject(operand) ? _(operand).values().first() : operand;

		if ( // Looks like a meta 'search' entry?
			path == '$or'
			&& operand.every(i => _.isObject(i) && _.keys(i).length == 1)
			&& operand.map(i => _.chain(i).first().values().first().keys().find(i => i == '$regexp').value()).length == operand.length // Every key has a $regexp search
		) {
			return {
				path,
				type: 'search',
				title: 'Search',
				value: // Horrible expression to find the first regexp value
					_.chain(operand)
						.first()
						.values()
						.first()
						.get('$regexp')
						.value(),
				fields:
					_(operand)
						.map(i => _.keys(i))
						.flatten()
						.value(),
				actions: QueryBuilder.queryPathPrototypeActions,
			};
		} else if (path == '$and' || path == '$or') { // Meta combinational types
			if (!_.isArray(operand)) {
				console.warn('query-builder', 'Query path', path, 'is a meta key', operand, 'but is not an array!', 'Given', typeof operand);
				operand = [];
			}

			return {
				path: path,
				type: 'binaryGroup',
				title:
					path == '$and' ? 'AND'
					: path == '$or' ? 'OR'
					: 'UNKNOWN',
				condition: path.replace(/\$/, ''),
				children: operand.map(i => QueryBuilder.queryToArray(i, spec)),
				actions: QueryBuilder.queryPathPrototypeActions,
			};
		} else if (QueryBuilder.metaProperties[path]) { // Is a meta property
			return Object.assign({
				path,
				title: _.startCase(path),
				value: operand,
				type: 'hidden',
				action: '$hidden',
				actions: QueryBuilder.queryPathPrototypeActions,
			}, QueryBuilder.metaProperties[path]);
		} else if (firstKey == '$exists') {
			return {
				path,
				title: operand.title || _.startCase(path), // Create a title from the key if its omitted
				value: !!operand,
				type: 'exists',
				action: '$exists',
				actions: QueryBuilder.queryPathPrototypeActions,
			};
		} else if (pathSpec.type == 'string' && _.isArray(pathSpec.enum) && pathSpec.enum.length) {
			return {
				path,
				title: operand.title || _.startCase(path),
				type: 'enum',
				action:
					operand.$in ? '$in'
					: operand.$nin ? '$nin'
					: pathSpec.enum.length ? '$in'
					: '$eq',
				enum: pathSpec.enum,
				value:
					operand.$in ? operand.$in
					: operand.$nin ? operand.$nin
					: pathSpec.enum.length && !_.isArray(operand) ? [operand]
					: operand,
				actions: QueryBuilder.queryPathPrototypeActions,
			};
		} else { // General fields
			return {
				path,
				title: operand.title || _.startCase(path), // Create a title from the key if its omitted
				type:
					pathSpec.type == 'string' ? 'string'
					: pathSpec.type == 'number' ? 'number'
					: pathSpec.type == 'date' ? 'date'
					: 'string',
				action: '$eq',
				value:
					pathSpec.type == 'date' ? moment(firstValue).toDate() // Convert date string weirdness into real dates
					: firstValue,
				actions: QueryBuilder.queryPathPrototypeActions,
			}
		}
	};


	/**
	* Returns a queryList collection from a query object
	* @param {Object} query The raw MongoDB / Sift object to transform from an object into a collection
	* @returns {array} An array where each parameter is represented as a object for easier handling
	*/
	QueryBuilder.queryToArray = (query, spec) =>
		_(query)
			.pickBy((v, k) => {
				var maps =
					spec[k] // Maps onto a spec path
					|| k == '$and'
					|| k == '$or'
					|| QueryBuilder.metaProperties[k] // is a meta directive

				if (!maps) console.warn('query-builder', 'Incomming query path', k, 'Does not map to anything in spec', spec);
				return !!maps;
			})
			.map((v, k) => QueryBuilder.queryPathPrototype(k, v, spec))
			.value();


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
			<div ng-if="$ctrl.isEmpty">
				<ui-query-builder-group
					qb-group="$ctrl.emptyQueryLayout"
					qb-spec="$ctrl.qbSpec"
				></ui-query-builder-group>
			</div>
			<div ng-if="!$ctrl.isEmpty" class="query-container">
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
			} else {
				$ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);
			}
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
		$scope.$on('queryBuilder.pathAction.swapPath', (e, path, newPath) => {
			var existingItemIndex = $ctrl.qbQuery.findIndex(q => q.path == path);
			if (!existingItemIndex) throw new Error(`Cannot find path "${path}" to swap with new path "${newPath}"`);

			$ctrl.qbQuery[existingItemIndex] = QueryBuilder.queryPathPrototype(newPath, undefined, $ctrl.qbSpec);
			$timeout(()=> $scope.$broadcast('queryBuilder.focusOperand', newPath)); // Tell the widget to try and focus itself
		});


		$scope.$on('queryBuilder.pathAction.swapAction', (e, path, newAction) => {
			console.log('SWAPACTION', path, newAction);
		});


		/**
		* Add a new item by path
		* @param {Object} event
		* @param {string} [path] The new path to add, if omitted the new path is added at the root element
		*/
		$scope.$on('queryBuilder.pathAction.add', (e, path) => {
			// Append new path and set to blank
			$ctrl.qbQuery.push({
				path: '',
				type: 'blank',
				value: null,
				fields: [],
			});

			$timeout(()=> $scope.$broadcast('queryBuilder.focusPath', '')); // Tell the widget to try and focus itself
		});

		// Manage empty queries {{{
		$ctrl.emptyQueryLayout = [{
			type: 'alert',
			title: 'No query specified',
		}];

		$ctrl.isEmpty;
		$scope.$watchCollection('$ctrl.qbQuery', ()=> $ctrl.isEmpty = _.isEmpty($ctrl.qbQuery));
		// }}}
	},
})
// }}}

// Component: uiQueryBuilderGroup {{{
/**
* Query builder element that holds a collection of queries - an array
* @param {array} qbGroup Collection of fields to render
* @param {Object} qbSpec Processed queryBuilder spec to pass to sub-controls
* @emits queryBuilder.pathAction.add
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
		<button ng-click="$ctrl.add()" type="button" class="btn-add"></button>
	`,
	controller: function($scope, QueryBuilder) {
		var $ctrl = this;

		$ctrl.add = ()=> $scope.$emit('queryBuilder.pathAction.add');

		$ctrl.qbGroupFilter = item => item.type != 'hidden';
	},
})
// }}}

// Component: uiQueryBuilderRow {{{
/**
* Individual line-item for a query row
* @param {Object} qbItem Individual line item to render
* @emits queryBuilder.pathAction.drop
* @emits queryBuilder.change
* @emits queryBuilder.pathAction.swapAction
*/
.component('uiQueryBuilderRow', {
	bindings: {
		qbItem: '=',
		qbSpec: '<',
	},
	controller: function($element, $scope, QueryBuilder) {
		var $ctrl = this;

		$ctrl.delete = path => $scope.$emit('queryBuilder.pathAction.drop', path);
		$ctrl.setChanged = ()=> $scope.$emit('queryBuilder.change');
		$ctrl.setAction = action => $scope.$emit('queryBuilder.pathAction.swapAction', $ctrl.qbItem, action);

		$scope.$on('queryBuilder.focusPath', (e, path) => {
			if ($ctrl.qbItem.path != path) return; // We don't control this path - ignore

			$element.find('ui-query-builder-path .dropdown-toggle').dropdown('toggle');
		});

		$scope.$on('queryBuilder.focusOperand', (e, path) => {
			if ($ctrl.qbItem.path != path) return; // We don't control this path - ignore

			// Try finding a single input box {{{
			var focusElem = $element.find('input.form-control');
			if (focusElem.length == 1) return focusElem.focus();
			// }}}
			console.warn('Unable to focus any element within DOM', $element[0], 'for type', $ctrl.type, 'on line item',$ctrl.qbItem);
		});
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
					on-change="$ctrl.setAction(selected)"
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
					on-change="$ctrl.setAction(selected)"
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
					on-change="$ctrl.setAction(selected)"
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
					on-change="$ctrl.setAction(selected)"
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
					on-change="$ctrl.setAction(selected)"
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
					on-change="$ctrl.setAction(selected)"
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
			<!-- Blank (i.e. field not set yet) {{{ -->
			<div ng-switch-when="blank" class="query-row">
				<a ng-click="$ctrl.delete($ctrl.qbItem.path)" class="btn-trash"></a>
				<ui-query-builder-path
					class="query-block"
					level="1"
					selected="$ctrl.qbItem.path"
					qb-spec="$ctrl.qbSpec"
				></ui-query-builder-path>
			</div>
			<!-- }}} -->
			<!-- Alert {{{ -->
			<div ng-switch-when="alert" class="query-row">
				<div class="query-block query-block-2">
					<div class="btn btn-block btn-noclick" ng-bind="$ctrl.qbItem.title"></div>
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
* @emits queryBuilder.pathAction.swapPath
*/
.component('uiQueryBuilderPath', {
	bindings: {
		level: '<',
		selected: '<',
		qbSpec: '<',
	},
	controller: function($scope) {
		var $ctrl = this;

		$ctrl.setSelected = option => $scope.$emit('queryBuilder.pathAction.swapPath', $ctrl.selected, option);

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
* @param {function} onChange Funciton to call as ({selected}) when the selection changes
* @param {*} selected The currently selected ID
*/
.component('uiQueryBuilderBlockMenu', {
	bindings: {
		level: '<',
		options: '<',
		selected: '=',
		onChange: '&?',
	},
	controller: function($scope) {
		var $ctrl = this;

		$ctrl.setSelected = option => {
			$ctrl.selected = option.id;
			if (angular.isFunction($ctrl.onChange)) $ctrl.onChange({selected: $ctrl.selected});
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
* @emits queryBuilder.change
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
