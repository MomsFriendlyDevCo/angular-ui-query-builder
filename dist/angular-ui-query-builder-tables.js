'use strict';

angular.module('angular-ui-query-builder')

// Table decorator {{{
.service('qbTableSettings', function () {
	return {
		icons: {
			sortNone: 'fa fa-fw fa-sort text-muted',
			sortAsc: 'fa fa-fw fa-sort-alpha-asc text-primary',
			sortDesc: 'fa fa-fw fa-sort-alpha-desc text-primary'
		}
	};
})

/**
* Directive applied to a table element to indicate that we should manage that table via angular-ui-query
* @param {Object} qbTable The query object to modify
* @param {boolean} stickyThead Anything within the `thead` section of the table should remain on the screen while scrolling
* @param {boolean} stickyTfoot Anything within the `tfoot` section of the table should remain on the screen while scrolling
* @emits qbTableQueryChange Emitted to child elements as (e, query) when the query object changes
*/
.directive('qbTable', function () {
	return {
		scope: {
			qbTable: '=',
			stickyThead: '<',
			stickyTfoot: '<'
		},
		restrict: 'AC',
		controller: ['$attrs', '$element', '$scope', 'qbTableSettings', function controller($attrs, $element, $scope, qbTableSettings) {
			var $ctrl = this;
			$ctrl.query = $scope.qbTable; // Copy into $ctrl so children can access it / $watch it

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
			};

			$element.addClass('qb-table');
			$scope.$watch('stickyThead', function () {
				return $element.toggleClass('qb-sticky-thead', 'stickyThead' in $attrs);
			});
			$scope.$watch('stickyTfoot', function () {
				return $element.toggleClass('qb-sticky-tfoot', 'stickyTfoot' in $attrs);
			});
		}]
	};
})

/**
* Directive for header elements to add angular-ui-query functionality
* @param {Object} ^qbTable.qbTable The query Object to mutate
* @param {string} qbCol The field to operate on
* @param {string} [sortable=q] Indicates that the column should switch to being sorted if the user clicks on it, if a value is specified that is used instead of `q` as the sort field
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
		controller: ['$attrs', '$scope', 'qbTableSettings', function controller($attrs, $scope, qbTableSettings) {
			var $ctrl = this;

			$scope.qbTableSettings = qbTableSettings;

			// Sort functionality {{{
			$scope.canSort = false; // True if either sortable has a specific value or is at least present
			$scope.isSorted = false; // False, 'asc', 'desc'

			$ctrl.$onInit = function () {
				return $scope.canSort = 'sortable' in $attrs;
			};

			$scope.$watch('qbTable.query.sort', function (sorter) {
				var sortField = $scope.sortable || $scope.q;
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
					$scope.qbTable.setField('sort', $scope.sortable);
				} else if ($scope.q && $attrs.sortable === '') {
					// Has attribute but no value - assume main key if we have one
					$scope.qbTable.setField('sort', $scope.q);
				}
			};
			// }}}
		}],
		link: function link(scope, element, attrs, parentScope) {
			scope.qbTable = parentScope;
		},
		template: '\n\t\t<ng-transclude></ng-transclude>\n\t\t<a ng-if="canSort" ng-click="toggleSort()" class="pull-right">\n\t\t\t<i class="{{\n\t\t\t\tisSorted == \'asc\' ? qbTableSettings.icons.sortAsc\n\t\t\t\t: isSorted == \'desc\' ? qbTableSettings.icons.sortDesc\n\t\t\t\t: qbTableSettings.icons.sortNone\n\t\t\t}}"></i>\n\t\t</a>\n\t'
	};
})

/**
* Directive to add table pagination
* @param {Object} ^qbTable.qbTable The query Object to mutate
*/
.directive('qbPagination', function () {
	return {
		scope: {},
		require: '^qbTable',
		restrict: 'EA',
		controller: ['$attrs', '$scope', 'qbTableSettings', function controller($attrs, $scope, qbTableSettings) {
			var $ctrl = this;

			$scope.qbTableSettings = qbTableSettings;

			$scope.canPrev = true;
			$scope.canNext = true;

			$scope.$watchGroup(['qbTable.query.limit', 'qbTable.query.skip'], function (sorter) {
				$scope.canPrev = $scope.qbTable.query.skip > 0;
				$scope.canNext = !$scope.total || $scope.qbTable.query.skip + $scope.qbTable.query.limit < $scope.total;
			});

			$scope.navPageRelative = function (pageRelative) {
				if (pageRelative == -1) {
					$scope.qbTable.setField('skip', Math.min(($scope.qbTable.query.skip || 0) - ($scope.qbTable.query.limit || 10), 0));
				} else if (pageRelative == 1) {
					$scope.qbTable.setField('skip', ($scope.qbTable.query.skip || 0) + ($scope.qbTable.query.limit || 10), 0);
				} else {
					throw new Error('Unsupported page move: ' + pageRelative);
				}
			};
		}],
		link: function link(scope, element, attrs, parentScope) {
			scope.qbTable = parentScope;
		},
		template: '\n\t\t<nav>\n\t\t\t<ul class="pager">\n\t\t\t\t<li ng-class="canPrev ? \'\' : \'disabled\'" class="previous"><a ng-click="navPageRelative(-1)"><i class="fa fa-arrow-left"></i></a></li>\n\t\t\t\t<li ng-class="canNext ? \'\' : \'disabled\'" class="next"><a ng-click="navPageRelative(1)"><i class="fa fa-arrow-right"></i></a></li>\n\t\t\t</ul>\n\t\t</nav>\n\t'
	};
});

// }}}