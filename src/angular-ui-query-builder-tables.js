angular.module('angular-ui-query-builder')

// qbTableSettings (service) {{{
.service('qbTableSettings', function() {
	return {
		icons: {
			sortNone: 'fa fa-fw fa-sort text-muted',
			sortAsc: 'fa fa-fw fa-sort-alpha-asc text-primary',
			sortDesc: 'fa fa-fw fa-sort-alpha-desc text-primary',
		},
	};
})
// }}}

// qbTable (directive) {{{
/**
* Directive applied to a table element to indicate that we should manage that table via angular-ui-query
* @param {Object} qbTable The query object to modify
* @param {boolean} stickyThead Anything within the `thead` section of the table should remain on the screen while scrolling
* @param {boolean} stickyTfoot Anything within the `tfoot` section of the table should remain on the screen while scrolling
* @emits qbTableQueryChange Emitted to child elements as (e, query) when the query object changes
*/
.directive('qbTable', function() { return {
	scope: {
		qbTable: '=?',
		stickyThead: '<?',
		stickyTfoot: '<?',
	},
	restrict: 'AC',
	controller: function($attrs, $element, $scope, qbTableSettings) {
		var $ctrl = this;
		$ctrl.query = $scope.qbTable; // Copy into $ctrl so children can access it / $watch it

		$ctrl.$broadcast = (msg, ...args) => {
			console.log('BROADCAST DOWN', msg, ...args);
			$scope.$broadcast(msg, ...args); // Rebind broadcast so its accessible from children
		};
		$ctrl.$on = (event, cb) => $scope.$on(event, cb);

		$ctrl.setField = (field, value) => {
			if (value == undefined) { // Remove from query
				delete $ctrl.query[field];
				return;
			}

			switch (field) {
				case 'sort':
					if ($ctrl.query.sort === value) { // If already sorting by field switch the sort direction
						$ctrl.query.sort = `-${value}`;
					} else if ($ctrl.query.sort === `-${value}`) { // If reverse sorting switch the right way up again
						$ctrl.query.sort = value;
					} else { // Just set the sorting
						$ctrl.query.sort = value;
					}
					break;
				default:
					$scope.qbTable[field] = value;
			}
		};

		$element.addClass('qb-table');
		$scope.$watch('stickyThead', ()=> $element.toggleClass('qb-sticky-thead', $scope.stickyThead || $attrs.stickyThead === ''));
		$scope.$watch('stickyTfoot', ()=> $element.toggleClass('qb-sticky-tfoot', $scope.stickyTfoot || $attrs.stickyTfoot === ''));
	},
}})
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
.directive('qbCol', function() { return {
	scope: {
		qbCol: '@', // The field to operate on
		sortable: '@',
	},
	require: '^qbTable',
	restrict: 'A',
	transclude: true,
	controller: function($attrs, $element, $scope, qbTableSettings) {
		var $ctrl = this;

		$scope.qbTableSettings = qbTableSettings;

		// Sanity checks {{{
		var unSanityChecks = $scope.$watchGroup(['qbTable', 'sortable'], ()=> {
			if ($attrs.sortable === '' && !$scope.qbTable) console.warn('Added qb-col + sortable onto element', $element, 'but no qb-table query has been assigned on the table element!');
			unSanityChecks();
		});
		// }}}

		// Sort functionality {{{
		$scope.canSort = false; // True if either sortable has a specific value or is at least present
		$scope.isSorted = false; // False, 'asc', 'desc'

		$ctrl.$onInit = ()=> $scope.canSort = $scope.sortable || $attrs.sortable === '';

		$scope.$watch('qbTable.query.sort', sorter => {
			var sortField = $scope.sortable || $scope.qbCol;

			if (!sorter) {
				$scope.isSorted = false;
			} else if (
				(angular.isArray(sorter) && sorter.some(i => i == sortField))
				|| (sorter == sortField)
			) {
				$scope.isSorted = 'asc';
			} else if (
				(angular.isArray(sorter) && sorter.some(i => i == '-' + sortField))
				|| (sorter == '-' + sortField)
			) {
				$scope.isSorted = 'desc';
			} else {
				$scope.isSorted = false;
			}
		});

		$scope.toggleSort = ()=> {
			if ($scope.sortable) { // Sort by a specific field
				$scope.qbTable.setField('sort', $scope.sortable);
			} else if ($scope.qbCol && $attrs.sortable === '') { // Has attribute but no value - assume main key if we have one
				$scope.qbTable.setField('sort', $scope.qbCol);
			}
		};
		// }}}
	},
	link: function(scope, element, attrs, parentScope) {
		scope.qbTable = parentScope;
	},
	template: `
		<ng-transclude></ng-transclude>
		<a ng-if="canSort" ng-click="toggleSort()" class="pull-right">
			<i class="{{
				isSorted == 'asc' ? qbTableSettings.icons.sortAsc
				: isSorted == 'desc' ? qbTableSettings.icons.sortDesc
				: qbTableSettings.icons.sortNone
			}}"></i>
		</a>
	`,
}})
// }}}

// qbCell (directive) {{{
/**
* Directive for cell elements within a table
* @param {boolean} selector Whether the cell should act as a select / unselect prompt, if any value bind to this as the selection variable
* @param {Object} ^qbTable.qbTable The query Object to mutate
* @example
* <td qb-cell selector="row.selected"></td>
*/
.directive('qbCell', function() { return {
	scope: {
		selector: '=?',
	},
	require: '^qbTable',
	restrict: 'A',
	transclude: true,
	controller: function($attrs, $element, $scope, $timeout, qbTableSettings) {
		var $ctrl = this;

		$scope.qbTableSettings = qbTableSettings;

		// Meta selection support {{{
		// A cell `isMeta` if it detects its located in the `thead` section of a table
		$scope.isMeta = $element.parents('thead').length > 0;
		// }}}

		// Selection support {{{
		$scope.isSelector = 'selector' in $attrs;
		$scope.$watch('selector', ()=> {
			if ($scope.isSelector) {
				$element.toggleClass('selector', $scope.isSelector);
			}

			if ($scope.isSelector && !$scope.isMeta) {
				$element.parents('tr').toggleClass('selected', !! $scope.selector);
				$element.find('input[type=checkbox]').prop('checked', !! $scope.selector);
			}
		});

		// Also respond to clicking anywhere in the 'TD' tag
		$element.on('click', e => {
			if (e.target.tagName != 'INPUT') e.preventDefault(); // Clicking on the background should also disable bubbling
			$scope.$apply(()=> $scope.selector = !$scope.selector);
		});

		// Handle meta interaction
		$scope.metaSelect = type => $scope.qbTable.$broadcast('qbTableCellSelect', type);

		// Bind to event listener and respond to selection directives from meta element
		if ($scope.isSelector) {
			$timeout(()=> $scope.qbTable.$on('qbTableCellSelect', (e, type) => {
				switch (type) {
					case 'all': $scope.selector = true; break;
					case 'invert': $scope.selector = !$scope.selector; break;
					case 'none': $scope.selector = false; break;
					default: throw new Error (`Unknown selection type: ${type}`);
				}
			}));
		}
		// }}}

		// Style up the selector
		$element.addClass('qb-cell')
	},
	link: function(scope, element, attrs, parentScope) {
		scope.qbTable = parentScope;
	},
	template: `
		<ng-transclude></ng-transclude>
		<div ng-if="isSelector && isMeta" class="btn-group">
			<a class="btn btn-default dropdown-toggle" data-toggle="dropdown">
				<input type="checkbox"/>
				<i class="fa fa-caret-down"></i>
			</a>
			<ul class="dropdown-menu">
				<li><a ng-click="metaSelect('all')">All</a></li>
				<li><a ng-click="metaSelect('invert')">Invert</a></li>
				<li><a ng-click="metaSelect('none')">None</a></li>
			</ul>
		</div>
		<div ng-if="isSelector && !isMeta" class="checkbox">
			<label>
				<input type="checkbox"/>
			</label>
		</div>
	`,
}})
// }}}

// qbPagination {{{
/**
* Directive to add table pagination
* @param {Object} ^qbTable.qbTable The query Object to mutate
*/
.directive('qbPagination', function() { return {
	scope: {},
	require: '^qbTable',
	restrict: 'EA',
	controller: function($attrs, $scope, qbTableSettings) {
		var $ctrl = this;

		$scope.qbTableSettings = qbTableSettings;

		$scope.canPrev = true;
		$scope.canNext = true;

		$scope.$watchGroup(['qbTable.query.limit', 'qbTable.query.skip'], sorter => {
			$scope.canPrev = $scope.qbTable.query.skip > 0;
			$scope.canNext = !$scope.total || $scope.qbTable.query.skip + $scope.qbTable.query.limit < $scope.total;
		});

		$scope.navPageRelative = pageRelative => {
			if (pageRelative == -1) {
				$scope.qbTable.setField('skip', Math.min(($scope.qbTable.query.skip || 0) - ($scope.qbTable.query.limit || 10), 0));
			} else if (pageRelative == 1) {
				$scope.qbTable.setField('skip', ($scope.qbTable.query.skip || 0) + ($scope.qbTable.query.limit || 10), 0);
			} else {
				throw new Error('Unsupported page move: ' + pageRelative);
			}
		};
	},
	link: function(scope, element, attrs, parentScope) {
		scope.qbTable = parentScope;
	},
	template: `
		<nav>
			<ul class="pager">
				<li ng-class="canPrev ? '' : 'disabled'" class="previous"><a ng-click="navPageRelative(-1)"><i class="fa fa-arrow-left"></i></a></li>
				<li ng-class="canNext ? '' : 'disabled'" class="next"><a ng-click="navPageRelative(1)"><i class="fa fa-arrow-right"></i></a></li>
			</ul>
		</nav>
	`,
}})
// }}}
