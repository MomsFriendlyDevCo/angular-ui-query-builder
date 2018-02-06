angular.module('angular-ui-query-builder')

// qbTableSettings (service) {{{
.service('qbTableSettings', function() {
	return {
		icons: {
			sortNone: 'fa fa-fw fa-sort text-muted',
			sortAsc: 'fa fa-fw fa-sort-alpha-asc text-primary',
			sortDesc: 'fa fa-fw fa-sort-alpha-desc text-primary',
		},
		export: {
			defaults: {
				format: 'xlsx',
			},
			formats: [
				{id: 'xlsx', title: 'Excel (XLSX)'},
				{id: 'csv', title: 'CSV'},
				{id: 'json', title: 'JSON'},
				{id: 'html', title: 'HTML (display in browser)'},
			],
		},
	};
})
// }}}

// qbTableUtilities (service) {{{
.service('qbTableUtilities', function() { return {
	getSynopsis: query => {
		var filters = _.keys(query).filter(i => !['sort', 'skip', 'limit', 'select'].includes(i));

		return [
			filters.length ? `${filters.length} filters` : 'All records',
			query.sort
				? (
					query.sort.startsWith('-')
						? `sorted by ${query.sort.substr(1)} (reverse order)`
						: `sorted by ${query.sort}`
				)
				: null,
			query.limit
				? `limited to ${query.limit} rows`
				: null,
			query.offset
				? `starting at record ${query.skip}`
				: null,
			query.select
				? `selecting only ${query.select.length} columns`
				: null,
		].filter(i => i).join(', ');
	},
}})
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

		$ctrl.$onInit = ()=> {
			$scope.canSort = $scope.sortable || $attrs.sortable === '';
			$element.toggleClass('sortable', $scope.canSort);
		};

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

		$element.addClass('qb-col');
	},
	link: function(scope, element, attrs, parentScope) {
		scope.qbTable = parentScope;
	},
	template: `
		<div class="qb-col-wrapper">
			<ng-transclude></ng-transclude>
			<a ng-if="canSort" ng-click="toggleSort()" class="qb-col-right">
				<i class="{{
					isSorted == 'asc' ? qbTableSettings.icons.sortAsc
					: isSorted == 'desc' ? qbTableSettings.icons.sortDesc
					: qbTableSettings.icons.sortNone
				}}"></i>
			</a>
		</div>
	`,
}})
// }}}

// qbCell (directive) {{{
/**
* Directive for cell elements within a table
* @param {boolean} selector Whether the cell should act as a select / unselect prompt, if any value bind to this as the selection variable
* @param {Object} ^qbTable.qbTable The query Object to mutate
*
* @emits qbTableCellSelectMeta Issued by the meta-selector element to peer selection elements that the selection criteria has changed. Called as (arg) where arg is 'all', 'none', 'invert'
* @emits qbTableCellSelect Issued by a regular selector element to broadcast its state has changed
* @emits qbTableCellSelectStatus Sent to one or more child elements as (array) to enquire their status, used to figure out if everything / partial / no items are selected. Each item is expected to add its status to `status` as a boolean
*
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

		if ($scope.isMeta) {
			$timeout(()=> $scope.qbTable.$on('qbTableCellSelect', ()=> {
				// Ask all children what their status is
				var status = [];
				$scope.qbTable.$broadcast('qbTableCellSelectStatus', status);

				$scope.metaStatus =
					status.every(i => i) ? 'all'
					: status.some(i => i) ? 'some'
					: 'none';
			}));
		}
		// }}}

		// Selection support {{{
		$scope.isSelector = 'selector' in $attrs;
		$scope.$watch('selector', ()=> {
			if ($scope.isSelector) $element.toggleClass('selector', $scope.isSelector);

			if ($scope.isSelector && !$scope.isMeta) $element.parents('tr').toggleClass('selected', !! $scope.selector);
		});

		// Respond to clicking anywhere in the 'TD' tag
		if ($scope.isSelector && !$scope.isMeta) {
			$element.on('click', e => $scope.$apply(()=> {
				$scope.selector = !$scope.selector;
				$scope.qbTable.$broadcast('qbTableCellSelect');
			}));
		}

		// Handle meta interaction
		$scope.metaSelect = type => $scope.qbTable.$broadcast('qbTableCellSelectMeta', type);

		// Bind to event listener and respond to selection directives from meta element
		if ($scope.isSelector && !$scope.isMeta) {
			// If we're a standard per-row minion respond to certain events
			$timeout(()=> {

				$scope.qbTable.$on('qbTableCellSelectMeta', (e, type) => {
					switch (type) {
						case 'all': $scope.selector = true; break;
						case 'invert': $scope.selector = !$scope.selector; break;
						case 'none': $scope.selector = false; break;
						default: throw new Error (`Unknown selection type: ${type}`);
					}
					$scope.qbTable.$broadcast('qbTableCellSelect'); // Trigger a recount of what is/isn't selected
				});

				$scope.qbTable.$on('qbTableCellSelectStatus', (e, status) => status.push($scope.selector));

			});
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
				<i class="fa fa-lg fa-fw" ng-class="metaStatus == 'all' ? 'fa-check-square-o text-primary' : metaStatus == 'some' ? 'fa-minus-square-o' : 'fa-square-o'"></i>
				<i class="fa fa-caret-down"></i>
			</a>
			<ul class="dropdown-menu">
				<li><a ng-click="metaSelect('all')">All</a></li>
				<li><a ng-click="metaSelect('invert')">Invert</a></li>
				<li><a ng-click="metaSelect('none')">None</a></li>
			</ul>
		</div>
		<div ng-if="isSelector && !isMeta">
			<i class="fa fa-lg fa-fw" ng-class="selector ? 'fa-check-square-o' : 'fa-square-o'"></i>
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
.directive('qbExport', function() { return {
	scope: {
		query: '<',
		spec: '<',
		url: '@',
	},
	transclude: true,
	restrict: 'EA',
	controller: function($element, $httpParamSerializer, $scope, $timeout, $window, qbTableSettings, qbTableUtilities) {
		var $ctrl = this;

		$scope.qbTableSettings = qbTableSettings;

		$scope.settings = {};

		$scope.isShowing = false;
		$scope.exportPrompt = ()=> {
			$scope.settings = angular.extend(
				angular.copy(qbTableSettings.export.defaults),
				{
					query: _($scope.query)
						.omitBy((v, k) => ['skip', 'limit'].includes(k))
						.value(),
					columns: _.map($scope.spec, (v, k) => {
						v.id = k;
						v.title = _.startCase(k);
						v.selected = true;
						return v;
					}),
				}
			);

			$element.find('.modal')
				.on('show.bs.modal', ()=> $timeout(()=> $scope.isShowing = true))
				.on('hidden.bs.modal', ()=> $timeout(()=> $scope.isShowing = false))
				.modal('show');
		};

		$scope.exportExecute = ()=> {
			var query = angular.extend($scope.settings.query, {
				select: $scope.settings.columns
					.filter(c => c.selected)
					.map(c => c.id),
				format: $scope.settings.format,
			});

			$window.open(`${$scope.url}?${$httpParamSerializer(query)}`);
		};

		// Generate a readable synopsis of the query {{{
		$scope.querySynopsis;
		$scope.$watchGroup(['isShowing', 'settings.query'], ()=> {
			if (!$scope.isShowing) return; // Don't bother if we're not showing anything anyway
			$scope.querySynopsis = qbTableUtilities.getSynopsis($scope.settings.query);
		});
		// }}}

		// Generate a readable synopsis of the columns collapse {{{
		$scope.columnSynopsis;
		$scope.$watchGroup([
			'isShowing',
			()=> _.get($scope.settings, 'columns', []).map(c => c.id + '=' + c.selected).join('&'), // Create a digest of what columns are selected
		], ()=> {
			if (!$scope.isShowing) return; // Don't bother if we're not showing anything anyway
			$scope.columnSynopsis = $scope.settings.columns.filter(c => c.selected).length + ' columns';
		});
		// }}}
	},
	template: `
		<div class="modal fade">
			<div class="modal-dialog modal-lg">
				<div ng-if="isShowing" class="modal-content">
					<div class="modal-header">
						<a class="close" data-dismiss="modal"><i class="fa fa-times"></i></a>
						<h4 class="modal-title">Export</h4>
					</div>
					<div class="modal-body form-horizontal">
						<div class="form-group">
							<label class="col-sm-3 control-label">Output format</label>
							<div class="col-sm-9">
								<select ng-model="settings.format" class="form-control">
									<option ng-repeat="format in qbTableSettings.export.formats track by format.id" value="{{format.id}}">{{format.title}}</option>
								</select>
							</div>
						</div>
						<div class="form-group">
							<label class="col-sm-3 control-label">Criteria</label>
							<div class="col-sm-9">
								<div class="panel-group" id="qb-export-criteria-{{$id}}">
									<div class="panel panel-default">
										<div class="panel-heading">
											<h4 class="panel-title">
												<a data-toggle="collapse" data-target="#qb-export-criteria-{{$id}}-query" data-parent="#qb-export-criteria-{{$id}}" class="btn-block collapsed">
													{{querySynopsis}}
													<i class="fa fa-caret-right pull-right"></i>
												</a>
											</h4>
										</div>
										<div id="qb-export-criteria-{{$id}}-query" class="panel-collapse collapse container">
											<ui-query-builder
												query="settings.query"
												spec="spec"
											></ui-query-builder>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="form-group">
							<label class="col-sm-3 control-label">Columns</label>
							<div class="col-sm-9">
								<div class="panel-group" id="qb-export-columns-{{$id}}">
									<div class="panel panel-default">
										<div class="panel-heading">
											<h4 class="panel-title">
												<a data-toggle="collapse" data-target="#qb-export-columns-{{$id}}-columns" data-parent="#qb-export-columns-{{$id}}" class="btn-block collapsed">
													{{columnSynopsis}}
													<i class="fa fa-caret-right pull-right"></i>
												</a>
											</h4>
										</div>
										<div id="qb-export-columns-{{$id}}-columns" class="panel-collapse collapse row">
											<div class="col-xs-12">
												<table qb-table class="table table-hover">
													<thead>
														<tr>
															<th qb-cell selector></th>
															<th>Column</th>
														</tr>
													</thead>
													<tbody>
														<tr ng-repeat="col in settings.columns track by col.id">
															<td qb-cell selector="col.selected"></td>
															<td>{{col.title}}</td>
														</tr>
													</tbody>
												</table>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="modal-footer">
						<div class="pull-left">
							<a class="btn btn-danger" data-dismiss="modal">Cancel</a>
						</div>
						<div class="pull-right">
							<a ng-click="exportExecute()" class="btn btn-primary" data-dismiss="modal">Export</a>
						</div>
					</div>
				</div>
			</div>
		</div>
		<ng-transclude>
			<a ng-click="exportPrompt()" class="btn btn-default">Export...</a>
		</ng-transclude>
	`,
}})
// }}}
