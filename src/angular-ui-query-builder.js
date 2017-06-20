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
	controller: function() {
		var $ctrl = this;
	},
})
// }}}

// Post comment widget {{{
/**
* FIXME
*/
.component('uiQueryBuilderBranch', {
	bindings: {
		branch: '=',
		spec: '<',
	},
	template: `
		<div ng-repeat="leaf in $ctrl.properties track by leaf.id" ng-switch="leaf.spec.type" class="row">
			<div class="col-md-1 col-join-root" ng-class="$first && 'col-join-root-first'"></div>
			<div class="col-md-2 col-join-both">
				<div class="btn btn-primary btn-block">
					{{leaf.id}}
				</div>
			</div>
			<div ng-switch-when="string">
				<div class="col-md-2 col-join-both">
					<div class="btn-group btn-block">
						<a class="btn btn-default btn-block dropdown-toggle" data-toggle="dropdown">
							{{leaf.valueWrapper}}
							<i class="fa fa-caret-down"></i>
						</a>
						<ul class="dropdown-menu">
							<li><a ng-click="$ctrl.setWrapper(leaf, '$in')">One of</a></li>
							<li><a ng-click="$ctrl.setWrapper(leaf, '$contains')">Contains</a></li>
							<li><a ng-click="$ctrl.setWrapper(leaf, '$equals')">Is exactly</a></li>
						</ul>
					</div>
				</div>
				<div class="col-md-2 col-join-left">
					<div class="btn btn-primary">
						<input ng-model="leaf.valueEdit" ng-change="$ctrl.setValue(leaf)" type="text" class="form-control"/>
					</div>
				</div>
				<div ng-switch-default class="alert alert-warning">
					Unknown type: {{leaf.spec.type}}
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-1 col-join-root col-join-root-last"></div>
			<div class="col-md-2 col-join-left-add">
				<div class="btn btn-add btn-default">
					<i class="fa fa-fw fa-plus"></i>
				</div>
			</div>
		</div>
	`,
	controller: function($scope) {
		var $ctrl = this;

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

		$ctrl.translateBranch = (branch, pathSegments = []) =>
			_($ctrl.branch)
				.map((v, k) => {
					var wrappingKey = _.isObject(v) ? _(v).keys().first() : '$equals';
					var firstKeyVal = _.isObject(v) && _.size(v) > 0 ? _(v).map().first() : undefined;

					var newBranch = {
						id: k,
						value: v,
						valueEdit:
							firstKeyVal && _.isArray(firstKeyVal) ? firstKeyVal.join(', ')
							: v
						,
						valueWrapper: wrappingKey,
						isMeta: k.startsWith('$'),
						spec: $ctrl.getSpec(k, v, ''),
						path: pathSegments.concat([k]),
					};

					return newBranch;
				})
				.sortBy(p => p.isMeta ? `Z${p.id}` : `A${p.id}`) // Force meta items to the end
				.value();

		// Convert branch -> properties {{{
		// We have to do this to sort appropriately and allow iteration over dollar prefixed keys
		$ctrl.properties;
		$scope.$watch('$ctrl.branch', ()=> {
			$ctrl.properties = $ctrl.translateBranch($ctrl.branch);
			console.log('BECOMES', $ctrl.properties);
		});
		// }}}

		// Branch interaction {{{
		$ctrl.setWrapper = (leaf, type) => {
			var newValue = {};
			if (_.isObject(leaf.value) && _.size(leaf.value) == 1) { // Unwrap object value
				newValue[type] = _(leaf.value).values().first();
			} else { // Preseve value
				newValue[type] = leaf.valueEdit;
			}

			leaf.valueWrapper = type;
			leaf.value = newValue;
			leaf.valueEdit = _.isObject(newValue[type]) && _.size(newValue[type]) ? newValue[type] : newValue;
			$ctrl.setValue(leaf);
		};

		$ctrl.setValue = leaf => {
			switch (leaf.valueWrapper) {
				case '$in':
					leaf.value = {$in: leaf.valueEdit.split(/\s*,\s*/)};
					break;
				default:
					leaf.value = leaf.valueEdit;
			}
			_.set($ctrl.branch, leaf.path, leaf.value);
		};
		// }}}
	},
})
// }}}
