angular.module('angular-ui-query-builder',[])

// Main widget {{{
.component('uiQueryBuilder', {
	bindings: {
		query: '=',
		spec: '<',
	},
	template: `
		<div class="ui-query-builder">
			<ui-query-builder-branch
				branch="$ctrl.query"
				spec="$ctrl.spec"
			></ui-query-builder-branch>
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
		<div ng-repeat="leaf in $ctrl.properties track by leaf.id" ng-switch="leaf.spec.type" class="query-container">
			<!-- Root branch display {{{ -->
			<div class="query-stem"><div></div></div>
			<!-- }}} -->
			<!-- Path component {{{ -->
			<div class="query-block">
				<div class="btn-group btn-block">
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
			<div ng-show="leaf.valueOperand" class="query-stem"><div></div></div>
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
						<li ng-if="leaf.spec.type == 'date'"><a ng-click="$ctrl.setWrapper(leaf, '$gt')">After</a></li>
						<li ng-if="leaf.spec.type == 'date'"><a ng-click="$ctrl.setWrapper(leaf, '$lt')">Before</a></li>
						<li><a ng-click="$ctrl.setWrapper(leaf, '$exists')">Has a value</a></li>
					</ul>
				</div>
			</div>
			<!-- }}} -->
			<div ng-show="leaf.valueOperand" class="query-stem"><div></div></div>
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
					<i class="fa" ng-class="leaf.valueEdit ? 'fa-check-square-o' : 'fa-square-o'"></i>
					{{leaf.valueEdit ? operandConfig.textTrue : operandConfig.textFalse}}
				</div>
				<div ng-switch-default class="btn btn-block btn-3">
					Unknown operand: <code>{{leaf.valueOperand}}</code>
				</div>
			</div>
			<!-- }}} -->
		</div>
		<!-- Add button {{{ -->
		<div class="query-container">
			<div class="query-stem"><div></div></div>
			<div class="query-block btn-group">
				<a ng-click="$ctrl.add()" class="btn btn-lg btn-add btn-default">
					<i class="fa fa-fw fa-plus fa-lg"></i>
				</a>
			</div>
		</div>
		<!-- }}} -->
	`,
	controller: function($scope) {
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
			},
			{
				id: '$ne',
				setter: v => ({$ne: v}),
				export: leaf => leaf.valueEdit,
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
			},
			{
				id: '$gte',
				setter: v => ({$gte: v}),
				export: leaf => ({$gte: leaf.value.$gte}),
				base: {
					title: 'Above or equals',
					type: 'number',
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
			},
			{
				id: '$lte',
				setter: v => ({$lt: v}),
				export: leaf => ({$lte: leaf.value.$lte}),
				base: {
					title: 'Below or equals',
					type: 'number',
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
					textFalse: 'Has no value',
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
				.map((v, k) => {
					var wrappingKey = _.isObject(v) ? _(v).keys().first() : '$eq';
					var firstKeyVal = _.isObject(v) && _.size(v) > 0 ? _(v).map().first() : undefined;

					var newBranch = {
						id: k,
						value: v,
						valueEdit: firstKeyVal || v,
						valueOperand: wrappingKey,
						isMeta: k.startsWith('$'),
						spec: $ctrl.getSpec(k, v, k),
						path: pathSegments.concat([k]),
					};

					return newBranch;
				})
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
			var newValue = {};
			if (_.isObject(leaf.value) && _.size(leaf.value) == 1) { // Unwrap object value
				newValue[type] = _(leaf.value).values().first();
			} else { // Preseve value
				newValue[type] = leaf.valueEdit;
			}

			leaf.valueOperand = type;
			leaf.value = newValue;
			leaf.valueEdit = _.isObject(newValue[type]) && _.size(newValue[type]) ? newValue[type] : newValue;
			$ctrl.setValue(leaf);
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
			leaf.valueEdit = _.isObject(leaf.value) && _.size(leaf.value) ? _(leaf.value).map().first() : leaf.value;

			// Set the upstream model value
			$ctrl.exportBranch();
		};
		// }}}

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

		// New branches {{{
		$ctrl.add = ()=> {
			if ($ctrl.properties.every(p => p.id)) // Check there are no new items currently in the process of being added
				$ctrl.properties.push({});
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
// }}}
