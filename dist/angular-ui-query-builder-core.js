"use strict";

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

angular.module('angular-ui-query-builder', []) // Service: QueryBuilder {{{
.service('QueryBuilder', function () {
  var QueryBuilder = this;
  /**
  * Apply various tidy functions to a raw spec before we process it
  * @param {Object} spec The raw spec to clean
  * @returns {Object} The output spec post cleaning
  */

  QueryBuilder.cleanSpec = function (spec) {
    return _(spec).mapValues(function (v, k) {
      return {
        type: v.type,
        enum: _(v.enum).map(function (e) {
          return _.isString(e) ? {
            id: e,
            title: _.startCase(e)
          } : e;
        }).sortBy('title').value()
      };
    }).value();
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
      actions: [{
        id: '$eq',
        title: 'Equals'
      }],
      action: '$eq',
      canDelete: true
    },
    populate: {
      type: 'hidden'
    },
    skip: {
      type: 'keyVal',
      actions: [{
        id: '$eq',
        title: 'Equals'
      }],
      action: '$eq',
      canDelete: true
    },
    sort: {
      type: 'keyVal',
      actions: [{
        id: '$eq',
        title: 'Equals'
      }],
      action: '$eq',
      canDelete: false
    }
  };
  /**
  * Actions that can apply to all fields by default
  * The contents of this array are mutated by QueryBuilder.queryPathPrototype to select the items that are actually applicable
  * @var {array}
  */

  QueryBuilder.queryPathPrototypeActions = [{
    id: '$eq',
    title: 'Equals'
  }, {
    id: '$neq',
    title: 'Doesnt equal'
  }, {
    id: '$lt',
    title: 'Is less than'
  }, {
    id: '$lte',
    title: 'Is equal to or less than'
  }, {
    id: '$gt',
    title: 'Is greater than'
  }, {
    id: '$gte',
    title: 'Is equal or greater than'
  }, {
    id: '$in',
    title: 'Is one of'
  }, {
    id: '$nin',
    title: 'Is not one of'
  }, {
    id: '$exists',
    title: 'Has a value'
  }, {
    id: '$nexists',
    title: 'Does not have a value'
  }];
  /**
  * Utility function for QueryBuilder.queryToArray which returns a prototype of a query element based on its meta properties
  * For example if 'foo' has a spec which defines it as a string, the string options are populated (['$eq', '$ne'...]) accordingly
  * @param {string} path The Mongo path of the item to prototype
  * @param {Object} [operand={}] An existing query infrastructure
  * @return {Object} A prototype qbTable collection item representing the spec of the path
  */

  QueryBuilder.queryPathPrototype = function (path) {
    var operand = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var spec = arguments.length > 2 ? arguments[2] : undefined;
    var pathSpec = spec[path];

    var firstKey = _.isObject(operand) && _(operand).keys().first();

    var firstValue = _.isObject(operand) ? _(operand).values().first() : operand;

    if ( // Looks like a meta 'search' entry?
    path == '$or' && operand.every(function (i) {
      return _.isObject(i) && _.keys(i).length == 1;
    }) && operand.map(function (i) {
      return _.chain(i).first().values().first().keys().find(function (i) {
        return i == '$regexp';
      }).value();
    }).length == operand.length // Every key has a $regexp search
    ) {
        return {
          path: path,
          type: 'search',
          title: 'Search',
          value: // Horrible expression to find the first regexp value
          _.chain(operand).first().values().first().get('$regexp').value(),
          fields: _(operand).map(function (i) {
            return _.keys(i);
          }).flatten().value(),
          actions: QueryBuilder.queryPathPrototypeActions
        };
      } else if (path == '$and' || path == '$or') {
      // Meta combinational types
      if (!_.isArray(operand)) {
        console.warn('query-builder', 'Query path', path, 'is a meta key', operand, 'but is not an array!', 'Given', _typeof(operand));
        operand = [];
      }

      return {
        path: path,
        type: 'binaryGroup',
        title: path == '$and' ? 'AND' : path == '$or' ? 'OR' : 'UNKNOWN',
        condition: path.replace(/\$/, ''),
        children: operand.map(function (i) {
          return QueryBuilder.queryToArray(i, spec);
        }),
        actions: QueryBuilder.queryPathPrototypeActions
      };
    } else if (QueryBuilder.metaProperties[path]) {
      // Is a meta property
      return Object.assign({
        path: path,
        title: _.startCase(path),
        value: operand,
        type: 'hidden',
        action: '$hidden',
        actions: QueryBuilder.queryPathPrototypeActions
      }, QueryBuilder.metaProperties[path]);
    } else if (firstKey == '$exists') {
      return {
        path: path,
        title: operand.title || _.startCase(path),
        // Create a title from the key if its omitted
        value: !!operand,
        type: 'exists',
        action: '$exists',
        actions: QueryBuilder.queryPathPrototypeActions
      };
    } else if (pathSpec.type == 'string' && _.isArray(pathSpec.enum) && pathSpec.enum.length) {
      return {
        path: path,
        title: operand.title || _.startCase(path),
        type: 'enum',
        action: operand.$in ? '$in' : operand.$nin ? '$nin' : pathSpec.enum.length ? '$in' : '$eq',
        enum: pathSpec.enum,
        value: operand.$in ? operand.$in : operand.$nin ? operand.$nin : pathSpec.enum.length && !_.isArray(operand) ? [operand] : operand,
        actions: QueryBuilder.queryPathPrototypeActions
      };
    } else {
      // General fields
      return {
        path: path,
        title: operand.title || _.startCase(path),
        // Create a title from the key if its omitted
        type: pathSpec.type == 'string' ? 'string' : pathSpec.type == 'number' ? 'number' : pathSpec.type == 'date' ? 'date' : 'string',
        action: '$eq',
        value: pathSpec.type == 'date' ? moment(firstValue).toDate() // Convert date string weirdness into real dates
        : firstValue,
        actions: QueryBuilder.queryPathPrototypeActions
      };
    }
  };
  /**
  * Returns a queryList collection from a query object
  * @param {Object} query The raw MongoDB / Sift object to transform from an object into a collection
  * @returns {array} An array where each parameter is represented as a object for easier handling
  */


  QueryBuilder.queryToArray = function (query, spec) {
    return _(query).pickBy(function (v, k) {
      var maps = spec[k] // Maps onto a spec path
      || k == '$and' || k == '$or' || QueryBuilder.metaProperties[k]; // is a meta directive

      if (!maps) console.warn('query-builder', 'Incomming query path', k, 'Does not map to anything in spec', spec);
      return !!maps;
    }).map(function (v, k) {
      return QueryBuilder.queryPathPrototype(k, v, spec);
    }).value();
  };
  /**
  * Reverse of `queryToArray()`
  * @param {array} queryList the internal array composed by queryToArray
  * @returns {Object} A Mongo / Sift compatible object
  */


  QueryBuilder.arrayToQuery = function (queryList) {
    var composer = function composer(ql) {
      return _(ql).mapKeys(function (ql) {
        return ql.path;
      }).mapValues(function (ql) {
        switch (ql.type) {
          case 'string':
          case 'number':
          case 'date':
            if (ql.action == '$eq') {
              return ql.value;
            } else {
              return _defineProperty({}, ql.action, ql.value);
            }

          case 'enum':
            return _defineProperty({}, ql.action, ql.value);

          case 'exists':
            return {
              $exists: ql.action == '$exists'
            };

          case 'search':
            return ql.fields.map(function (f) {
              return _defineProperty({}, f, {
                $regexp: ql.value,
                options: 'i'
              });
            });

          case 'keyVal':
          case 'hidden':
            return ql.value;

          default:
            console.warn('Unknown type to convert:', ql.type);
        }
      }).value();
    };

    return composer(queryList);
  };
}) // }}}
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
    spec: '<'
  },
  template: "\n\t\t<div class=\"ui-query-builder\">\n\t\t\t<div ng-if=\"$ctrl.isEmpty\">\n\t\t\t\t<ui-query-builder-group\n\t\t\t\t\tqb-group=\"$ctrl.emptyQueryLayout\"\n\t\t\t\t\tqb-spec=\"$ctrl.qbSpec\"\n\t\t\t\t></ui-query-builder-group>\n\t\t\t</div>\n\t\t\t<div ng-if=\"!$ctrl.isEmpty\" class=\"query-container\">\n\t\t\t\t<ui-query-builder-group\n\t\t\t\t\tqb-group=\"$ctrl.qbQuery\"\n\t\t\t\t\tqb-spec=\"$ctrl.qbSpec\"\n\t\t\t\t></ui-query-builder-group>\n\t\t\t</div>\n\t\t</div>\n\t",
  controller: ["$scope", "$timeout", "QueryBuilder", function controller($scope, $timeout, QueryBuilder) {
    var $ctrl = this; // Main loader {{{

    $ctrl.qbSpec;
    $ctrl.qbQuery;
    var initUnwatch = $scope.$watchGroup(['$ctrl.query', '$ctrl.spec'], function () {
      if (!$ctrl.spec || !$ctrl.query) return; // Not yet got everything we need

      $ctrl.qbSpec = QueryBuilder.cleanSpec($ctrl.spec);
      $ctrl.qbQuery = QueryBuilder.queryToArray($ctrl.query, $ctrl.qbSpec);
      initUnwatch(); // Release the watcher so we don't get stuck in a loop
    }); // }}}

    /**
    * Emitted by lower elements to inform the main builder that something has changed
    * This will recompute the output query
    */

    $scope.$on('queryBuilder.change', function (e, replaceQuery) {
      return $timeout(function () {
        // Timeout to wait for Angular to catch up with its low level populates
        if (replaceQuery) {
          // If we're given an entire query to overwrite - recompute it
          $ctrl.query = replaceQuery;
          $ctrl.qbQuery = QueryBuilder.queryToArray($ctrl.query, $ctrl.qbSpec);
        } else {
          $ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);
        }
      });
    });
    /**
    * Remove an item from the query by path
    * @param {Object} event
    * @param {string} path The path to remove
    */

    $scope.$on('queryBuilder.pathAction.drop', function (e, path) {
      $ctrl.qbQuery = $ctrl.qbQuery.filter(function (p) {
        return p.path != path;
      });
      $ctrl.query = QueryBuilder.arrayToQuery($ctrl.qbQuery);
    });
    /**
    * Swap an item from within query by path
    * @param {Object} event
    * @param {string} path The path to swap
    * @param {string} newPath The new path to use
    */

    $scope.$on('queryBuilder.pathAction.swapPath', function (e, path, newPath) {
      var existingItemIndex = $ctrl.qbQuery.findIndex(function (q) {
        return q.path == path;
      });
      if (existingItemIndex < 0) throw new Error("Cannot find path \"".concat(path, "\" to swap with new path \"").concat(newPath, "\""));
      $ctrl.qbQuery[existingItemIndex] = QueryBuilder.queryPathPrototype(newPath, undefined, $ctrl.qbSpec);
      $timeout(function () {
        return $scope.$broadcast('queryBuilder.focusOperand', newPath);
      }); // Tell the widget to try and focus itself
    });
    $scope.$on('queryBuilder.pathAction.swapAction', function (e, path, newAction) {
      console.log('SWAPACTION', path, newAction);
    });
    /**
    * Add a new item by path
    * @param {Object} event
    * @param {string} [path] The new path to add, if omitted the new path is added at the root element
    */

    $scope.$on('queryBuilder.pathAction.add', function (e, path) {
      if (!path) {
        var existingItemIndex = $ctrl.qbQuery.findIndex(function (q) {
          return !q.path;
        }); // Adding an existing path somewhere already?

        if (existingItemIndex) {
          // Append new path and set to blank
          $ctrl.qbQuery.push({
            path: '',
            type: 'blank',
            value: null,
            fields: []
          });
        }

        $timeout(function () {
          return $scope.$broadcast('queryBuilder.focusPath', '');
        }); // Tell the widget to try and focus itself
      } else {
        console.warn('Adding a path to a sub-node is not yet supported');
      }
    }); // Manage empty queries {{{

    $ctrl.emptyQueryLayout = [{
      type: 'alert',
      title: 'No query specified'
    }];
    $ctrl.isEmpty;
    $scope.$watchCollection('$ctrl.qbQuery', function () {
      return $ctrl.isEmpty = _.isEmpty($ctrl.qbQuery);
    }); // }}}
  }]
}) // }}}
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
    qbSpec: '<'
  },
  template: "\n\t\t<div ng-repeat=\"row in $ctrl.qbGroup | filter:$ctrl.qbGroupFilter\" meta-key=\"{{row.path}}\">\n\t\t\t<ui-query-builder-row\n\t\t\t\tqb-item=\"row\"\n\t\t\t\tqb-spec=\"$ctrl.qbSpec\"\n\t\t\t></ui-query-builder-row>\n\t\t</div>\n\t\t<button ng-click=\"$ctrl.add()\" type=\"button\" class=\"btn-add\"></button>\n\t",
  controller: ["$scope", "QueryBuilder", function controller($scope, QueryBuilder) {
    var $ctrl = this;

    $ctrl.add = function () {
      return $scope.$emit('queryBuilder.pathAction.add');
    };

    $ctrl.qbGroupFilter = function (item) {
      return item.type != 'hidden';
    };
  }]
}) // }}}
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
    qbSpec: '<'
  },
  controller: ["$element", "$scope", "QueryBuilder", function controller($element, $scope, QueryBuilder) {
    var $ctrl = this;

    $ctrl.delete = function (path) {
      return $scope.$emit('queryBuilder.pathAction.drop', path);
    };

    $ctrl.setChanged = function () {
      return $scope.$emit('queryBuilder.change');
    };

    $ctrl.setAction = function (action) {
      return $scope.$emit('queryBuilder.pathAction.swapAction', $ctrl.qbItem, action);
    };

    $scope.$on('queryBuilder.focusPath', function (e, path) {
      if ($ctrl.qbItem.path != path) return; // We don't control this path - ignore

      $element.find('ui-query-builder-path .dropdown-toggle').dropdown('toggle');
    });
    $scope.$on('queryBuilder.focusOperand', function (e, path) {
      if ($ctrl.qbItem.path != path) return; // We don't control this path - ignore
      // Try finding a single input box {{{

      var focusElem = $element.find('input.form-control');
      if (focusElem.length == 1) return focusElem.focus(); // }}}

      console.warn('Unable to focus any element within DOM', $element[0], 'for type', $ctrl.type, 'on line item', $ctrl.qbItem);
    });
  }],
  template: "\n\t\t<div ng-switch=\"$ctrl.qbItem.type\">\n\t\t\t<!-- $and / $or condition {{{ -->\n\t\t\t<div ng-switch-when=\"binaryGroup\" class=\"query-row\">\n\t\t\t\t<a ng-click=\"$ctrl.delete($ctrl.qbItem.path)\" class=\"btn-trash\"></a>\n\t\t\t\t<div class=\"query-block\">\n\t\t\t\t\t<div class=\"btn btn-1 btn-block\">\n\t\t\t\t\t\t{{$ctrl.qbItem.title}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div ng-repeat=\"conditional in $ctrl.qbItem.children\" class=\"query-container clearfix\">\n\t\t\t\t\t<ui-query-builder-group\n\t\t\t\t\t\tqb-group=\"conditional\"\n\t\t\t\t\t\tqb-spec=\"$ctrl.spec\"\n\t\t\t\t\t></ui-query-builder-group>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- String {{{ -->\n\t\t\t<div ng-switch-when=\"string\" class=\"query-row\">\n\t\t\t\t<a ng-click=\"$ctrl.delete($ctrl.qbItem.path)\" class=\"btn-trash\"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"1\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.path\"\n\t\t\t\t\tqb-spec=\"$ctrl.qbSpec\"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"2\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.action\"\n\t\t\t\t\toptions=\"$ctrl.qbItem.actions\"\n\t\t\t\t\ton-change=\"$ctrl.setAction(selected)\"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<div class=\"query-block\">\n\t\t\t\t\t<div class=\"btn btn-3 btn-block\">\n\t\t\t\t\t\t<input\n\t\t\t\t\t\t\tng-model=\"$ctrl.qbItem.value\"\n\t\t\t\t\t\t\tng-change=\"$ctrl.setChanged()\"\n\t\t\t\t\t\t\ttype=\"text\"\n\t\t\t\t\t\t\tclass=\"form-control\"\n\t\t\t\t\t\t/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Enum {{{ -->\n\t\t\t<div ng-switch-when=\"enum\" class=\"query-row\">\n\t\t\t\t<a ng-click=\"$ctrl.delete($ctrl.qbItem.path)\" class=\"btn-trash\"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"1\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.path\"\n\t\t\t\t\tqb-spec=\"$ctrl.qbSpec\"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"2\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.action\"\n\t\t\t\t\toptions=\"$ctrl.qbItem.actions\"\n\t\t\t\t\ton-change=\"$ctrl.setAction(selected)\"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<ui-query-builder-block-menu-multiple\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"3\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.value\"\n\t\t\t\t\toptions=\"$ctrl.qbItem.enum\"\n\t\t\t\t></ui-query-builder-block-menu-multiple>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Date {{{ -->\n\t\t\t<div ng-switch-when=\"date\" class=\"query-row\">\n\t\t\t\t<a ng-click=\"$ctrl.delete($ctrl.qbItem.path)\" class=\"btn-trash\"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"1\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.path\"\n\t\t\t\t\tqb-spec=\"$ctrl.qbSpec\"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"2\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.action\"\n\t\t\t\t\toptions=\"$ctrl.qbItem.actions\"\n\t\t\t\t\ton-change=\"$ctrl.setAction(selected)\"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<div class=\"query-block\">\n\t\t\t\t\t<div class=\"btn btn-3 btn-block\">\n\t\t\t\t\t\t<input\n\t\t\t\t\t\t\tng-model=\"$ctrl.qbItem.value\"\n\t\t\t\t\t\t\tng-change=\"$ctrl.setChanged()\"\n\t\t\t\t\t\t\ttype=\"date\"\n\t\t\t\t\t\t\tclass=\"form-control\"\n\t\t\t\t\t\t/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Number {{{ -->\n\t\t\t<div ng-switch-when=\"number\" class=\"query-row\">\n\t\t\t\t<a ng-click=\"$ctrl.delete($ctrl.qbItem.path)\" class=\"btn-trash\"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"1\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.path\"\n\t\t\t\t\tqb-spec=\"$ctrl.qbSpec\"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"2\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.action\"\n\t\t\t\t\toptions=\"$ctrl.qbItem.actions\"\n\t\t\t\t\ton-change=\"$ctrl.setAction(selected)\"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t\t<div class=\"query-block\">\n\t\t\t\t\t<div class=\"btn btn-3 btn-block\">\n\t\t\t\t\t\t<input\n\t\t\t\t\t\t\tng-value=\"$ctrl.qbItem.value\"\n\t\t\t\t\t\t\tng-changed=\"$ctrl.setChanged()\"\n\t\t\t\t\t\t\ttype=\"number\"\n\t\t\t\t\t\t\tclass=\"form-control\"\n\t\t\t\t\t\t/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Exists {{{ -->\n\t\t\t<div ng-switch-when=\"exists\" class=\"query-row\">\n\t\t\t\t<a ng-click=\"$ctrl.delete($ctrl.qbItem.path)\" class=\"btn-trash\"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"1\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.path\"\n\t\t\t\t\tqb-spec=\"$ctrl.qbSpec\"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<ui-query-builder-block-menu\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"2\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.action\"\n\t\t\t\t\toptions=\"$ctrl.qbItem.actions\"\n\t\t\t\t\ton-change=\"$ctrl.setAction(selected)\"\n\t\t\t\t></ui-query-builder-block-menu>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Search {{{ -->\n\t\t\t<div ng-switch-when=\"search\" class=\"query-row\">\n\t\t\t\t<a ng-click=\"$ctrl.delete($ctrl.qbItem.path)\" class=\"btn-trash\"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"1\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.path\"\n\t\t\t\t\tqb-spec=\"$ctrl.qbSpec\"\n\t\t\t\t\ton-change=\"$ctrl.setAction(selected)\"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<div class=\"query-block\">\n\t\t\t\t\t<div class=\"btn btn-2 btn-block\">\n\t\t\t\t\t\t<input\n\t\t\t\t\t\t\tng-model=\"$ctrl.qbItem.value\"\n\t\t\t\t\t\t\tng-change=\"$ctrl.setChanged()\"\n\t\t\t\t\t\t\ttype=\"text\"\n\t\t\t\t\t\t\tclass=\"form-control\"\n\t\t\t\t\t\t/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- keyVal (Only title + value) {{{ -->\n\t\t\t<div ng-switch-when=\"keyVal\" class=\"query-row\">\n\t\t\t\t<a ng-if=\"$ctrl.qbItem.canDelete === undefined || $ctrl.qbItem.canDelete\" ng-click=\"$ctrl.delete($ctrl.qbItem.path)\" class=\"btn-trash\"></a>\n\t\t\t\t<ui-query-builder-block\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"1\"\n\t\t\t\t\ttitle=\"$ctrl.qbItem.title\"\n\t\t\t\t></ui-query-builder-block>\n\t\t\t\t<div class=\"query-block\">\n\t\t\t\t\t<div class=\"btn btn-2 btn-block\">\n\t\t\t\t\t\t<input\n\t\t\t\t\t\t\tng-model=\"$ctrl.qbItem.value\"\n\t\t\t\t\t\t\tng-change=\"$ctrl.setChanged()\"\n\t\t\t\t\t\t\ttype=\"text\"\n\t\t\t\t\t\t\tclass=\"form-control\"\n\t\t\t\t\t\t/>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Blank (i.e. field not set yet) {{{ -->\n\t\t\t<div ng-switch-when=\"blank\" class=\"query-row\">\n\t\t\t\t<a ng-click=\"$ctrl.delete($ctrl.qbItem.path)\" class=\"btn-trash\"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"1\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.path\"\n\t\t\t\t\tqb-spec=\"$ctrl.qbSpec\"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Alert {{{ -->\n\t\t\t<div ng-switch-when=\"alert\" class=\"query-row\">\n\t\t\t\t<div class=\"query-block query-block-2\">\n\t\t\t\t\t<div class=\"btn btn-block btn-noclick\" ng-bind=\"$ctrl.qbItem.title\"></div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t\t<!-- Unknown {{{ -->\n\t\t\t<div ng-switch-default class=\"query-row\">\n\t\t\t\t<a ng-click=\"$ctrl.delete($ctrl.qbItem.path)\" class=\"btn-trash\"></a>\n\t\t\t\t<ui-query-builder-path\n\t\t\t\t\tclass=\"query-block\"\n\t\t\t\t\tlevel=\"1\"\n\t\t\t\t\tselected=\"$ctrl.qbItem.path\"\n\t\t\t\t\tqb-spec=\"$ctrl.qbSpec\"\n\t\t\t\t></ui-query-builder-path>\n\t\t\t\t<div class=\"query-block\">\n\t\t\t\t\t<div class=\"btn btn-warning btn-block\">\n\t\t\t\t\t\tUnknown handler: {{$ctrl.qbItem.type}}\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t\t<!-- }}} -->\n\t\t</div>\n\t"
}) // }}}
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
    qbSpec: '<'
  },
  controller: ["$scope", function controller($scope) {
    var $ctrl = this;

    $ctrl.setSelected = function (option) {
      return $scope.$emit('queryBuilder.pathAction.swapPath', $ctrl.selected, option);
    };

    $ctrl.options;

    $ctrl.$onInit = function () {
      $ctrl.options = _.map($ctrl.qbSpec, function (info, path) {
        return Object.assign({}, {
          path: path,
          title: _.startCase(path)
        }, info);
      });
      $ctrl.selectedOption = $ctrl.options.find(function (p) {
        return p.path == $ctrl.selected;
      });
    };
  }],
  template: "\n\t\t<a class=\"btn btn-block btn-{{$ctrl.level}} dropdown-toggle\" data-toggle=\"dropdown\" ng-bind=\"$ctrl.selectedOption.title\"></a>\n\t\t<ul class=\"dropdown-menu pull-right\">\n\t\t\t<li ng-repeat=\"path in $ctrl.options track by path.path\"><a ng-click=\"$ctrl.setSelected(path.path)\">{{path.title}}</a></li>\n\t\t</ul>\n\t"
}) // }}}
// Component: uiQueryBuilderBlock {{{

/**
* Component for drawing a Block with no-interactivity
* @param {number} level The level of button we are drawing
* @param {string} title The title of the block to display
*/
.component('uiQueryBuilderBlock', {
  bindings: {
    level: '<',
    title: '<'
  },
  controller: ["$scope", function controller($scope) {
    var $ctrl = this;
  }],
  template: "\n\t\t<a class=\"btn btn-block btn-{{$ctrl.level}}\">\n\t\t\t{{$ctrl.title}}\n\t\t</a>\n\t"
}) // }}}
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
    onChange: '&?'
  },
  controller: ["$scope", function controller($scope) {
    var $ctrl = this;

    $ctrl.setSelected = function (option) {
      $ctrl.selected = option.id;
      if (angular.isFunction($ctrl.onChange)) $ctrl.onChange({
        selected: $ctrl.selected
      });
    };

    $ctrl.selectedOption;
    $scope.$watchGroup(['$ctrl.options', '$ctrl.selected'], function () {
      $ctrl.selectedOption = $ctrl.options.find(function (i) {
        return i.id == $ctrl.selected;
      });
    });
  }],
  template: "\n\t\t<a class=\"btn btn-block btn-{{$ctrl.level}} dropdown-toggle\" data-toggle=\"dropdown\" ng-bind=\"$ctrl.selectedOption.title\"></a>\n\t\t<ul class=\"dropdown-menu pull-right\">\n\t\t\t<li ng-repeat=\"option in $ctrl.options track by option.id\"><a ng-click=\"$ctrl.setSelected(option)\">{{option.title}}</a></li>\n\t\t</ul>\n\t"
}) // }}}
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
    selected: '='
  },
  controller: ["$scope", function controller($scope) {
    var $ctrl = this;

    $ctrl.toggle = function (option) {
      if (!$ctrl.selected) $ctrl.selected = [];

      if ($ctrl.selected.includes(option.id)) {
        $ctrl.selected = $ctrl.selected.filter(function (i) {
          return i != option.id;
        });
      } else {
        $ctrl.selected.push(option.id);
      }

      $scope.$emit('queryBuilder.change');
    };

    $ctrl.selectedOptions;
    $scope.$watch('$ctrl.selected', function () {
      $ctrl.selectedOptions = $ctrl.options.filter(function (i) {
        return ($ctrl.selected || []).includes(i.id);
      });
      $ctrl.options.forEach(function (o) {
        return o.selected = $ctrl.selectedOptions.some(function (s) {
          return s.id == o.id;
        });
      });
    }, true);
  }],
  template: "\n\t\t<a class=\"btn btn-block btn-{{$ctrl.level}} dropdown-toggle\" data-toggle=\"dropdown\">\n\t\t\t<span ng-repeat=\"item in $ctrl.selectedOptions track by item.id\" class=\"pill\">\n\t\t\t\t{{item.title}}\n\t\t\t</span>\n\t\t</a>\n\t\t<ul class=\"dropdown-menu pull-right\">\n\t\t\t<li ng-repeat=\"option in $ctrl.options track by option.id\">\n\t\t\t\t<a ng-click=\"$ctrl.toggle(option)\">\n\t\t\t\t\t<i class=\"fa fa-fw\" ng-class=\"option.selected ? 'fa-check-square-o' : 'fa-square-o'\"></i>\n\t\t\t\t\t{{option.title}}\n\t\t\t\t</a>\n\t\t\t</li>\n\t\t</ul>\n\t"
}); // }}}