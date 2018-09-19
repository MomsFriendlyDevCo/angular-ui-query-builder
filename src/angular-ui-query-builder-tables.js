angular.module('angular-ui-query-builder')

// qbTableSettings (provider) {{{
.provider('qbTableSettings', function() {
	var qbTableSettings = this;

	qbTableSettings.debug = false;
	qbTableSettings.debugPrefix = '[angular-ui-query-builder]';

	qbTableSettings.icons = {
		sortNone: 'fa fa-fw fa-sort text-muted',
		sortAsc: 'fa fa-fw fa-sort-alpha-asc text-primary',
		sortDesc: 'fa fa-fw fa-sort-alpha-desc text-primary',
		checkMetaChecked: 'fa fa-lg fa-fw fa-check-square-o text-primary',
		checkMetaSome: 'fa fa-lg fa-fw fa-minus-square-o',
		checkMetaUnchecked: 'fa fa-lg fa-fw fa-square-o',
		checkMetaCaret: 'fa fa-caret-down',
		checkItemChecked: 'fa fa-lg fa-fw fa-check-square-o',
		checkItemUnchecked: 'fa fa-lg fa-fw fa-square-o',
		paginationPrev: 'fa fa-arrow-left',
		paginationNext: 'fa fa-arrow-right',
		modalClose: 'fa fa-times',
		modalCollapseClosed: 'fa fa-caret-right pull-right',
		search: 'fa fa-search',
		searchClear: 'fa fa-times',
	};

	qbTableSettings.pagination = {
		showXOfY: true,
		showPages: true,
		pageRangeBack: 5,
		pageRangeFore: 5,
	};

	qbTableSettings.export = {
		defaults: {
			format: 'xlsx',
		},
		formats: [
			{id: 'xlsx', title: 'Excel (XLSX)'},
			{id: 'csv', title: 'CSV'},
			{id: 'json', title: 'JSON'},
			{id: 'html', title: 'HTML (display in browser)'},
		],
		questions: [
			/*
			{
				id: String, // Unique ID for each question (will be sent in submitted query)
				type: String, // How to render the question. ENUM: 'text'
				title: String, // The question to ask
				default: String, // Default value of field if any
				help: String, // Optional help text,
			},
			*/
		],
	};

	qbTableSettings.$get = function() { return qbTableSettings };

	return qbTableSettings;
})
// }}}

// qbTableUtilities (service) {{{
.service('qbTableUtilities', function() { return {
	// @include ./utilities.js
}})
// }}}

// qbTable (directive) {{{
/**
* Directive applied to a table element to indicate that we should manage that table via angular-ui-query
* @param {Object} qbTable The query object to modify
* @param {number} count Optional maximum number of results currently matching this query (used by pagination to generate page offsets)
* @param {boolean} stickyThead Anything within the `thead` section of the table should remain on the screen while scrolling
* @param {boolean} stickyTfoot Anything within the `tfoot` section of the table should remain on the screen while scrolling
* @emits qbTableQueryChange Emitted to child elements as (e, query) when the query object changes
*/
.directive('qbTable', function() { return {
	scope: {
		qbTable: '=?',
		count: '<?',
		stickyThead: '<?',
		stickyTfoot: '<?',
	},
	restrict: 'AC',
	controller: function($attrs, $element, $rootScope, $scope, $timeout, qbTableSettings) {
		var $ctrl = this;

		// Copy into $ctrl so children can access it / $watch it
		$ctrl.query = $scope.qbTable;
		$ctrl.count = $scope.count;
		$scope.$watch('count', ()=> $ctrl.count = $scope.count); // If our binding changes, also update the qbTable.count reference - no idea why Angular doesn't do this anyway since its using a pointer

		$ctrl.$broadcast = (msg, ...args) => $scope.$broadcast(msg, ...args); // Rebind broadcast so its accessible from children
		$ctrl.$on = (event, cb) => $scope.$on(event, cb);
		$ctrl.setDirty = ()=> {
			if (qbTableSettings.debug) console.log(qbTableSettings.debugPrefix, 'Declare query dirty', $scope.qbTable);
			$rootScope.$broadcast('queryBuilder.change', $scope.qbTable);
		};

		/**
		* Set the value of a query element to another value
		* NOTE: This function does not call $ctrl.setDirty() by default but you can chain this
		* @param {string} field The field name to change
		* @param {*} value The value to change to, if omitted the field is removed entirely
		* @example set the sort criteria and then refresh
		* qbTable.setField('sort', 'email').setDirty()
		*/
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

			return $ctrl;
		};

		$element.addClass('qb-table');
		$scope.$watch('stickyThead', ()=> $element.toggleClass('qb-sticky-thead', $scope.stickyThead || $attrs.stickyThead === ''));
		$scope.$watch('stickyTfoot', ()=> $element.toggleClass('qb-sticky-tfoot', $scope.stickyTfoot || $attrs.stickyTfoot === ''));
		$scope.$watch('count', ()=> $element.toggleClass('qb-noresults', $scope.count === 0));
		$scope.$on('queryBuilder.change.replace', (e, q) => {
			$ctrl.query = $scope.qbTable = q;
			$timeout(()=> $ctrl.setDirty());
		});
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
	controller: function($attrs, $element, $scope, $timeout, qbTableSettings) {
		var $ctrl = this;

		$scope.qbTableSettings = qbTableSettings;

		// Sanity checks {{{
		var unSanityChecks = $scope.$watchGroup(['qbTable', 'sortable'], ()=> {
			if ($attrs.sortable === '' && !$scope.qbTable && qbTableSettings.debug) console.warn(qbTableSettings.debugPrefix, 'Added qb-col + sortable onto element', $element, 'but no qb-table query has been assigned on the table element!');
			unSanityChecks();
		});
		// }}}

		// Sort functionality {{{
		$scope.canSort = false; // True if either sortable has a specific value or is at least present
		$scope.isSorted = false; // False, 'asc', 'desc'

		$ctrl.$onInit = ()=> {
			$scope.canSort = $scope.sortable || $attrs.sortable === '';
			$element.toggleClass('sortable', $scope.canSort);

			if ($scope.canSort) {
				// If sortable mode is on - enable clicking anywhere as a sort method
				$element.on('click', ()=> $timeout($scope.toggleSort));
			}
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
				$scope.qbTable
					.setField('sort', $scope.sortable)
					.setDirty()
			} else if ($scope.qbCol && $attrs.sortable === '') { // Has attribute but no value - assume main key if we have one
				$scope.qbTable
					.setField('sort', $scope.qbCol)
					.setDirty()
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
* @param {Object} ^qbTable.qbTable The query Object to mutate
* @param {boolean} [selector] Whether the cell should act as a select / unselect prompt, if any value bind to this as the selection variable
* @param {function} [onPreSelect] Function to run before the selection value changes. Called as ({value})
* @param {function} [onSelect] Function to run after the selection value changes. Called as ({value})
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
		onPreSelect: '&?',
		onSelect: '&?',
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
				if ($scope.onPreSelect) $scope.onPreSelect({value: $scope.selector});
				$scope.selector = !$scope.selector;
				$scope.qbTable.$broadcast('qbTableCellSelect');
				if ($scope.onSelect) $timeout(()=> $scope.onSelect({value: $scope.selector}));
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
				<i ng-class="metaStatus == 'all' ? qbTableSettings.icons.checkMetaChecked : metaStatus == 'some' ? qbTableSettings.icons.checkMetaUnchecked : qbTableSettings.icons.checkMetaUnchecked"></i>
				<i ng-class="qbTableSettings.icons.checkMetaCaret"></i>
			</a>
			<ul class="dropdown-menu">
				<li><a ng-click="metaSelect('all')">All</a></li>
				<li><a ng-click="metaSelect('invert')">Invert</a></li>
				<li><a ng-click="metaSelect('none')">None</a></li>
			</ul>
		</div>
		<div ng-if="isSelector && !isMeta">
			<i ng-class="selector ? qbTableSettings.icons.checkItemChecked : qbTableSettings.icons.checkItemUnchecked"></i>
		</div>
	`,
}})
// }}}

// qbPagination (directive) {{{
/**
* Directive to add table pagination
* NOTE: Any transcluded content will be inserted in the center of the pagination area
* @param {Object} ^qbTable.qbTable The query Object to mutate
* @param {Number} ^qbTable.count The matching number of documents (used to show the page numbers, 'X of Y' displays etc.
*/
.directive('qbPagination', function() { return {
	scope: {},
	require: '^qbTable',
	restrict: 'EA',
	transclude: true,
	controller: function($attrs, $scope, qbTableSettings) {
		var $ctrl = this;

		$scope.qbTableSettings = qbTableSettings;

		$scope.canPrev = true;
		$scope.canNext = true;
		$scope.showRange = {};

		$scope.$watchGroup(['qbTable.query.limit', 'qbTable.query.skip', 'qbTable.count'], sorter => {
			$scope.canPrev = $scope.qbTable.query.skip > 0;
			$scope.canNext = !$scope.qbTable.count || $scope.qbTable.query.skip + $scope.qbTable.query.limit < $scope.qbTable.count;

			// Page X of Y display {{{
			if (qbTableSettings.pagination.showXOfY) {
				$scope.showRange = {
					start: ($scope.qbTable.query.skip || 0) + 1,
					end: Math.min(($scope.qbTable.query.skip || 0) + $scope.qbTable.query.limit, $scope.qbTable.count),
					total: $scope.qbTable.count,
				};
			}
			// }}}

			// Page view calculation {{{
			if (qbTableSettings.pagination.showPages) {
				$scope.pages = {
					current: $scope.qbTable.query.limit ? Math.floor(($scope.qbTable.query.skip || 0) / $scope.qbTable.query.limit) : false,
				};
				$scope.pages.min = Math.max($scope.pages.current - qbTableSettings.pagination.pageRangeBack, 0);
				$scope.pages.total = $scope.qbTable.query.limit
					? Math.ceil($scope.qbTable.count / $scope.qbTable.query.limit)
					: 1; // No limit specified therefore there is only one page
				$scope.pages.max = Math.min($scope.pages.total, $scope.pages.current + qbTableSettings.pagination.pageRangeFore + 1);
				$scope.pages.range = _.range($scope.pages.min, $scope.pages.max).map(i => ({
					number: i,
					mode:
						i == $scope.pages.current ? 'current'
						: i == $scope.pages.current -1 ? 'prev'
						: i == $scope.pages.current +1 ? 'next'
						: 'normal'
				}));
			}
			// }}}
		});

		$scope.navPageRelative = pageRelative => {
			if (pageRelative == -1) {
				$scope.qbTable
					.setField('skip', Math.max(($scope.qbTable.query.skip || 0) - ($scope.qbTable.query.limit || 10), 0))
					.setDirty();
			} else if (pageRelative == 1) {
				$scope.qbTable
					.setField('skip', ($scope.qbTable.query.skip || 0) + ($scope.qbTable.query.limit || 10))
					.setDirty();
			} else {
				throw new Error('Unsupported page move: ' + pageRelative);
			}
		};

		$scope.navPageNumber = number =>
			$scope.qbTable
				.setField('skip', (number || 0) * ($scope.qbTable.query.limit || 10))
				.setDirty();
	},
	link: function(scope, element, attrs, parentScope) {
		scope.qbTable = parentScope;
	},
	template: `
		<nav>
			<ul class="pager">
				<li ng-class="canPrev ? '' : 'disabled'" class="previous"><a ng-click="navPageRelative(-1)"><i ng-class="qbTableSettings.icons.paginationPrev"></i></a></li>
				<ng-transclude class="text-center">
					<span ng-if="qbTableSettings.pagination.showXOfY && showRange.end" class="display-xofy">
						Showing documents {{showRange.start | number}} - {{showRange.end | number}}
						<span ng-if="showRange.total">
							of {{showRange.total | number}}
						</span>
					</span>
					<ul ng-if="qbTableSettings.pagination.showPages && showRange.end && pages.max > 1" class="display-pages pagination">
						<li ng-repeat="page in pages.range track by page.number" ng-class="page.mode == 'current' ? 'active' : ''">
							<a ng-click="navPageNumber(page.number)">
								{{page.number + 1 | number}}
							</a>
						</li>
					</ul>
				</ng-transclude>
				<li ng-class="canNext ? '' : 'disabled'" class="next"><a ng-click="navPageRelative(1)"><i ng-class="qbTableSettings.icons.paginationNext"></i></a></li>
			</ul>
		</nav>
	`,
}})
// }}}

// qbExport (directive) {{{
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
*   <a class="btn btn-primary">Export this list</a>
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
	controller: function($element, $httpParamSerializerJQLike, $scope, $timeout, $window, qbTableSettings, qbTableUtilities) {
		var $ctrl = this;

		$scope.qbTableSettings = qbTableSettings;

		$scope.settings = {}; // Set in $scope.exportPrompt()

		$scope.isShowing = false;
		$scope.exportPrompt = ()=> {
			$scope.settings = angular.extend(
				angular.copy(qbTableSettings.export.defaults),
				{
					query: _($scope.query)
						.omitBy((v, k) => ['skip', 'limit'].includes(k))
						.value(),
					columns: _($scope.spec)
						.pickBy(v => v && v.type && ['string', 'number', 'data', 'boolean', 'objectid'].includes(v.type))
						.map((v, k) => {
							v.id = k;
							v.title = _.startCase(k);
							v.selected = true;
							return v;
						})
						.value(),
					questions: _(qbTableSettings.export.questions) // Populate questions with defaults
						.mapKeys(v => v.id)
						.mapValues(v => v.default)
						.value(),
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
			}, $scope.settings.questions);

			$window.open($scope.url + '?' + $httpParamSerializerJQLike(query));
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
	link: function($scope, $elem) {
		$elem.find('ng-transclude').on('click', ()=> $scope.$applyAsync(()=> $scope.exportPrompt()));
	},
	template: `
		<div class="modal fade">
			<div class="modal-dialog modal-lg">
				<div ng-if="isShowing" class="modal-content">
					<div class="modal-header">
						<a class="close" data-dismiss="modal"><i ng-class="qbTableSettings.icons.modalClose"></i></a>
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
													<i ng-class="qbTableSettings.icons.modalCollapseClosed"></i>
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
													<i ng-class="qbTableSettings.icons.modalCollapseClosed"></i>
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
						<div ng-repeat="question in qbTableSettings.export.questions track by question.id" class="form-group">
							<label class="col-sm-3 control-label">{{question.title}}</label>
							<div ng-switch="question.type" class="col-sm-9">
								<div ng-switch-when="text">
									<input type="text" ng-model="settings.questions[question.id]" class="form-control"/>
								</div>
								<div ng-switch-default>
									<div class="alert alert-danger">
										Unknown question type: "{{question.type}}"
										<pre>{{question | json}}</pre>
									</div>
								</div>
								<div ng-if="question.help" class="help-block">{{question.help}}</div>
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

// qbModal (directive) {{{
/**
* Button binding that shows a modal allowing the user to edit a query
* @param {Object} query The query Object to use when exporting
* @param {Object} spec The specification object of the collection
* @param {function} [onRefresh] Function to call when the user confirms the query editing. Called as `({query, spec})`
* @param {string} [binding='complete'] How to bind the given query to the one in progress. ENUM: 'none' - do nothing (only call onRefresh), 'live' - update the query as the user edits, 'complete' - only update when the user finishes
* @param {string} [title="Edit Filter"] The title of the modal
*
* @example
* <a qb-modal query="myQuery" spec="mySpec" class="btn btn-success">Edit query</a>
*/
.directive('qbModal', function() { return {
	scope: {
		query: '=',
		spec: '<',
		title: '@?',
		onRefresh: '&?',
		binding: '@?',
	},
	transclude: true,
	restrict: 'A',
	controller: function($element, $scope, qbTableSettings) {
		var $ctrl = this;

		$scope.qbTableSettings = qbTableSettings;

		$ctrl.isShown = false;
		$ctrl.rebind = ()=> {
			$element.one('click', ()=> {
				$element.find('.qb-modal')
					.one('hide.bs.modal', ()=> { $ctrl.isShown = false })
					.one('hidden.bs.modal', ()=> { $ctrl.rebind() })
					.modal('show')
			});
		};

		$scope.submit = ()=> {
			if (angular.isFunction($ctrl.onRefresh)) $ctrl.onRefresh({query: $scope.queryCopy, spec: $scope.spec});
			if (!$scope.binding || $scope.binding == 'complete') $scope.query = $scope.queryCopy;

			$element.find('.qb-modal').modal('hide');
		};

		$ctrl.$onInit = ()=> {
			$scope.queryCopy = $scope.binding == 'live' ? $scope.query : angular.copy($scope.query);
		};

		$ctrl.rebind();
	},
	template: `
		<ng-transclude></ng-transclude>
		<div class="qb-modal modal fade">
			<div class="modal-dialog modal-lg">
				<div class="modal-content">
					<div class="modal-header">
						<a class="close" data-dismiss="modal"><i ng-class="qbTableSettings.icons.modalClose"></i></a>
						<h4 class="modal-title">{{title || 'Edit Filter'}}</h4>
					</div>
					<div class="modal-body">
						<ui-query-builder
							query="queryCopy"
							spec="spec"
						></ui-query-builder>
					</div>
					<div class="modal-footer">
						<div class="pull-left">
							<a class="btn btn-danger" data-dismiss="modal">Cancel</a>
						</div>
						<div class="pull-right">
							<a ng-click="submit()" class="btn btn-success">Refresh</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	`,
}})
// }}}

// qbSearch (directive) {{{
/**
* Directive to automatically populate a generic search into a query via a single textbox
* NOTE: Any transcluded content will replace the basic `<input/>` template. Bind to `search` to set the search criteria and fire `submit()` to submit the change, 'clear()' to clear the search
* NOTE: The logic on what fields to search is that the field is a string AND if at least one field has 'index:true' to check for that. If no fields claim an index all string fields are searched (this may cause issues with your backend database). See the useIndexes property for further details
* @param {Object} query The query object to populate
* @param {Object} spec The specification object of the collection
* @param {array} [fields] Optional array of fields to search by, if specified and non-empty this is used as the definitive list of fields to search by instead of computing via `useIndexes`
* @param {function} [onRefresh] Function to call as ({query}) when the user changes the search string and a new query is generated
* @param {string} [binding='complete'] How to bind the given query to the one in progress. ENUM: 'none' - do nothing (only call onRefresh), 'complete' - only update when the user finishes and presses enter or blurs the input
* @param {string} [useIndexes='auto'] How to determine what fields to search. ENUM: 'all' - All fields', 'string' - Only string fields', 'stringIndexed' - only indexed string fields, 'auto' - 'stringIndexed' if at least one field has {index:true} else 'string'
*/
.directive('qbSearch', function() { return {
	scope: {
		query: '=',
		spec: '<',
		onRefresh: '&?',
		fields: '<?',
		useIndexes: '@?',
	},
	restrict: 'AE',
	transclude: true,
	controller: function($element, $scope, $rootScope, $timeout, qbTableSettings, qbTableUtilities) {
		var $ctrl = this;

		$scope.qbTableSettings = qbTableSettings;

		$scope.search = '';
		$scope.isSearching = false;


		/**
		* Submit a search query - injecting the search terms into the query as needed
		* @param {boolean} [clear=true] Clear the existing search before continuing
		*/
		$scope.submit = (clear = true)=> {
			if (!$scope.search && clear) return $scope.clear(false);

			var safeRegEx = qbTableUtilities.escapeRegExp(_.trim($scope.search));
			var searchQuery = {
				$comment: 'search',
				$or: _($scope.spec)
					.pickBy(v => v.type == 'string')
					.mapValues((v, k) => [{$regex: safeRegEx, $options: 'i'}])
					.value()
			};


			var existingQuery = qbTableUtilities.find($scope.query, {$comment: 'search'});
			var newQuery = angular.copy($scope.query);
			if (existingQuery && _.isEqual(existingQuery, ['$comment'])) { // Existing - found at root level
				newQuery = searchQuery;
			} else if (existingQuery && existingQuery[0] == '$and') { // Existing - Found within $and wrapper
				_.set(newQuery, existingQuery, searchQuery);
			} else if (_.isEqual(_.keys(newQuery), ['$and'])) { // Non-existing - Query is of form {$and: QUERY} --
				newQuery.$and.push(searchQuery);
			} else if (_.isObject(newQuery)) { // Non-existing - Append as a single key $or
				var indexMethod = $ctrl.useIndexes || 'auto';
				if (indexMethod == 'auto') { // Determine what indexing method to use before we begin
					indexMethod = _.keys($scope.spec).some(k => k != '_id' && $scope.spec[k].index) ? 'stringIndexed' : 'string';
				}

				if ($scope.fields) { // User is specifying fields to search
					newQuery.$or = _($scope.fields)
						.map(k => ({
							[k]: {$regex: qbTableUtilities.escapeRegExp($scope.search), $options: 'i'},
						}))
						.value();
				} else { // Auto-compute the fields to use
					newQuery.$or = _($scope.spec)
						.pickBy((v, k) => {
							if (k == '_id') return false; // Never search by ID
							if ($scope.fields && $scope.fields.length) return $scope.fields.includes(k);
							switch (indexMethod) {
								case 'all': return true;
								case 'string': return (v.type == 'string');
								case 'stringIndexed': return (v.type == 'string' && v.index);
								default: throw new Error('Unknown field selection method: "' + indexMethod + '"');
							}
						})
						.map((v, k) => ({
							[k]: {$regex: qbTableUtilities.escapeRegExp($scope.search), $options: 'i'},
						}))
						.value()
				}
			} else { // Give up
				console.warn(qbTableSettings.debugPrefix, 'Unable to inject search term', searchQuery, 'within complex query object', newQuery);
			}

			$scope.isSearching = true;

			// Inform the main query builder that we've changed something
			$rootScope.$broadcast('queryBuilder.change.replace', newQuery);
			if (angular.isFunction($ctrl.onRefresh)) $ctrl.onRefresh({query: newQuery});
			if ($ctrl.binding == 'complete' || angular.isUndefined($ctrl.binding)) {
				$scope.query = newQuery;
			}
		};


		/**
		* Attempt to remove a search query from the currently active query block
		* @param {boolean} [refocus=true] Attempt to move the user focus to the input element when clearing
		*/
		$scope.clear = (refocus = true) => {
			var existingQuery = qbTableUtilities.find($scope.query, {$comment: 'search'});
			$scope.isSearching = false;
			$scope.search = '';

			if (refocus) angular.element($element).find('input').focus();

			var newQuery;
			if (existingQuery && _.isEqual(existingQuery, ['$comment'])) { // Existing - found at root level
				newQuery = {};
			} else if (existingQuery && existingQuery[0] == '$and') { // Existing - Found within $and wrapper, unwrap and return to simple key/val format
				newQuery = angular.copy($scope.query);
				newQuery.$and.find((v, k) => v.$comment != 'search');
			} else if (existingQuery) { // Existing - Delete by path
				newQuery = angular.copy($scope.query);
				_.unset(newQuery, existingQuery);
			} else if ($scope.query.$or && $scope.query.$or.every(field => _.size(field) == 1 && _.chain(field).first().keys().find(k => k == '$regEx'))) {
				newQuery = angular.copy($scope.query);
				delete newQuery.$or;
			} else if (qbTableSettings.debug) { // Scream if we can't find the query anywhere and debugging mode is enabled
				console.warn(qbTableSettings.debugPrefix, 'Unable to clear search query within complex query - or query doesnt contain a search anyway', $scope.query);
				return;
			} else {
				// Give up - this should only happen either when:
				// a) there is no search term anyway and we are being asked to clear
				// b) we can't find any search term using any of the techniques above
				return;
			}

			// Inform the main query builder that we've changed something
			$rootScope.$broadcast('queryBuilder.change.replace', newQuery);
			if (angular.isFunction($ctrl.onRefresh)) $ctrl.onRefresh({query: newQuery});
			if ($ctrl.binding == 'complete' || angular.isUndefined($ctrl.binding)) {
				$scope.query = newQuery;
			}
		};

		/**
		* Try and populate initial query
		* NOTE: This is currently only compatible with query.$or.0.*.$regex level queries
		*/
		$scope.check = ()=> {
			try {
				$scope.search = _.chain($scope.query)
					.get('$or')
					.first()
					.values()
					.first()
					.get('$regex')
					.thru(v => qbTableUtilities.unescapeRegExp(v || ''))
					.value();
			} catch (e) {
				$scope.search = '';
			}
		};

		$ctrl.$onInit = ()=> $scope.check();
	},
	template: `
		<ng-transclude>
			<form ng-submit="submit()" class="form-inline">
				<div class="form-group">
					<div class="input-group">
						<input type="text" ng-model="search" class="form-control"/>
						<a ng-click="isSearching ? clear() : submit(false)" class="btn btn-default input-group-addon">
							<i ng-class="isSearching ? qbTableSettings.icons.searchClear : qbTableSettings.icons.search"/>
						</a>
					</div>
				</div>
			</div>
		</ng-transclude>
	`,
}})
// }}}
