'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

angular.module('angular-ui-query-builder', [])

// Main widget {{{
.component('uiQueryBuilder', {
	bindings: {
		query: '=',
		spec: '<'
	},
	template: '\n\t\t<div class="ui-query-builder">\n\t\t\t<ui-query-builder-branch\n\t\t\t\tbranch="$ctrl.query"\n\t\t\t\tspec="$ctrl.spec"\n\t\t\t></ui-query-builder-branch>\n\t\t</div>\n\t',
	controller: ["$scope", function controller($scope) {
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
	template: '\n\t\t<div class="query-container-leadin"></div>\n\t\t<div ng-repeat="leaf in $ctrl.properties track by leaf.id" ng-switch="leaf.spec.type" class="query-container">\n\t\t\t<!-- Root branch display {{{ -->\n\t\t\t<div class="query-stem"><div></div></div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Path component {{{ -->\n\t\t\t<div class="query-block">\n\t\t\t\t<div class="btn-group btn-block">\n\t\t\t\t\t<a class="btn btn-1 btn-block dropdown-toggle" data-toggle="dropdown">\n\t\t\t\t\t\t{{$ctrl.spec[leaf.id].title || \'Select...\'}}\n\t\t\t\t\t\t<i class="fa fa-caret-down"></i>\n\t\t\t\t\t</a>\n\t\t\t\t\t<ul class="dropdown-menu">\n\t\t\t\t\t\t<li ng-repeat="(key, val) in $ctrl.spec track by key" ng-class="key == leaf.id && \'active\'">\n\t\t\t\t\t\t\t<a ng-click="$ctrl.setField(leaf, key)">\n\t\t\t\t\t\t\t\t{{$ctrl.spec[key].title}}\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t</ul>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<div ng-show="leaf.valueOperand" class="query-stem"><div></div></div>\n\t\t\t<!-- Query type component {{{ -->\n\t\t\t<div ng-show="leaf.valueOperand" class="query-block">\n\t\t\t\t<div class="btn-group btn-block">\n\t\t\t\t\t<a class="btn btn-2 btn-block dropdown-toggle" data-toggle="dropdown">\n\t\t\t\t\t\t{{($ctrl.operandsByID[leaf.valueOperand][leaf.spec.type] || $ctrl.operandsByID[leaf.valueOperand].base).title}}\n\t\t\t\t\t\t<i class="fa fa-caret-down"></i>\n\t\t\t\t\t</a>\n\t\t\t\t\t<ul class="dropdown-menu">\n\t\t\t\t\t\t<li><a ng-click="$ctrl.setWrapper(leaf, \'$eq\')">Is</a></li>\n\t\t\t\t\t\t<li><a ng-click="$ctrl.setWrapper(leaf, \'$ne\')">Is not</a></li>\n\t\t\t\t\t\t<li><a ng-click="$ctrl.setWrapper(leaf, \'$in\')">One of</a></li>\n\t\t\t\t\t\t<li><a ng-click="$ctrl.setWrapper(leaf, \'$nin\')">Not one of</a></li>\n\t\t\t\t\t\t<li ng-if="leaf.spec.type == \'number\'"><a ng-click="$ctrl.setWrapper(leaf, \'$gt\')">Above</a></li>\n\t\t\t\t\t\t<li ng-if="leaf.spec.type == \'number\'"><a ng-click="$ctrl.setWrapper(leaf, \'$lt\')">Below</a></li>\n\t\t\t\t\t\t<li ng-if="leaf.spec.type == \'date\'"><a ng-click="$ctrl.setWrapper(leaf, \'$gt\')">After</a></li>\n\t\t\t\t\t\t<li ng-if="leaf.spec.type == \'date\'"><a ng-click="$ctrl.setWrapper(leaf, \'$lt\')">Before</a></li>\n\t\t\t\t\t\t<li><a ng-click="$ctrl.setWrapper(leaf, \'$exists\')">Has a value</a></li>\n\t\t\t\t\t</ul>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<div ng-show="leaf.valueOperand" class="query-stem"><div></div></div>\n\t\t\t<!-- Query operand component {{{ -->\n\t\t\t<div ng-show="leaf.valueOperand" class="query-block btn-group" ng-switch="(operandConfig = $ctrl.operandsByID[leaf.valueOperand][leaf.spec.type] || $ctrl.operandsByID[leaf.valueOperand].base).type">\n\t\t\t\t<div ng-switch-when="string" class="btn btn-block btn-3">\n\t\t\t\t\t<input ng-model="leaf.valueEdit" ng-change="$ctrl.setValue(leaf)" type="text" class="form-control"/>\n\t\t\t\t</div>\n\t\t\t\t<div ng-switch-when="array" class="btn btn-block btn-3 btn-group">\n\t\t\t\t\t<div class="btn-fill text-left dropdown-toggle" data-toggle="dropdown">\n\t\t\t\t\t\t<span class="pill" ng-repeat="item in $ctrl.spec[leaf.id].enum | uiQueryBuilderFilterSelected:leaf track by item.id">\n\t\t\t\t\t\t\t{{item.title}}\n\t\t\t\t\t\t</span>\n\t\t\t\t\t\t<span ng-if="!leaf.valueEdit.length">...</span>\n\t\t\t\t\t\t<i class="fa fa-caret-down"></i>\n\t\t\t\t\t</div>\n\t\t\t\t\t<ul class="dropdown-menu">\n\t\t\t\t\t\t<li ng-repeat="item in $ctrl.spec[leaf.id].enum | uiQueryBuilderFilterSelected:leaf:false track by item.id">\n\t\t\t\t\t\t\t<a ng-click="$ctrl.setValueIncluded(leaf, item.id, false)">\n\t\t\t\t\t\t\t\t<i class="fa fa-fw fa-check-square text-primary"></i>\n\t\t\t\t\t\t\t\t{{item.title}}\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t\t<li ng-repeat="item in $ctrl.spec[leaf.id].enum | uiQueryBuilderFilterSelected:leaf:true track by item.id">\n\t\t\t\t\t\t\t<a ng-click="$ctrl.setValueIncluded(leaf, item.id, true)">\n\t\t\t\t\t\t\t\t<i class="fa fa-fw fa-square-o text-primary"></i>\n\t\t\t\t\t\t\t\t{{item.title}}\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</li>\n\t\t\t\t\t</ul>\n\t\t\t\t</div>\n\t\t\t\t<div ng-switch-when="boolean" class="btn btn-block btn-3" ng-click="$ctrl.setValue(leaf, !leaf.valueEdit)">\n\t\t\t\t\t<i class="fa" ng-class="leaf.valueEdit ? \'fa-check-square-o\' : \'fa-square-o\'"></i>\n\t\t\t\t\t{{leaf.valueEdit ? operandConfig.textTrue : operandConfig.textFalse}}\n\t\t\t\t</div>\n\t\t\t\t<div ng-switch-default class="btn btn-block btn-3">\n\t\t\t\t\tUnknown operand: <code>{{leaf.valueOperand}}</code>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t</div>\n\t\t<!-- Add button {{{ -->\n\t\t<div class="query-container">\n\t\t\t<div class="query-stem"><div></div></div>\n\t\t\t<div class="query-block btn-group">\n\t\t\t\t<a ng-click="$ctrl.add()" class="btn btn-lg btn-add btn-default">\n\t\t\t\t\t<i class="fa fa-fw fa-plus fa-lg"></i>\n\t\t\t\t</a>\n\t\t\t</div>\n\t\t</div>\n\t\t<div class="query-container-leadout"></div>\n\t\t<!-- }}} -->\n\t',
	controller: ["$scope", function controller($scope) {
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
			}
		}, {
			id: '$ne',
			setter: function setter(v) {
				return { $ne: v };
			},
			export: function _export(leaf) {
				return leaf.valueEdit;
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
				textFalse: 'Has no value'
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
				var wrappingKey = _.isObject(v) ? _(v).keys().first() : '$eq';
				var firstKeyVal = _.isObject(v) && _.size(v) > 0 ? _(v).map().first() : undefined;

				var newBranch = {
					id: k,
					value: v,
					valueEdit: firstKeyVal || v,
					valueOperand: wrappingKey,
					isMeta: k.startsWith('$'),
					spec: $ctrl.getSpec(k, v, k),
					path: pathSegments.concat([k])
				};

				return newBranch;
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
			var newValue = {};
			if (_.isObject(leaf.value) && _.size(leaf.value) == 1) {
				// Unwrap object value
				newValue[type] = _(leaf.value).values().first();
			} else {
				// Preseve value
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
		$ctrl.setValue = function (leaf, value) {
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

		// New branches {{{
		$ctrl.add = function () {
			if ($ctrl.properties.every(function (p) {
				return p.id;
			})) // Check there are no new items currently in the process of being added
				$ctrl.properties.push({});
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
});
// }}}