var app = angular.module("app", [
	'angular-ui-query-builder'
]);

// Force URL encoding to use jQuery syntax so we can pass JSON to the backend using URL query objects
app.config($httpProvider => $httpProvider.defaults.paramSerializer = '$httpParamSerializerJQLike')

app.controller('queryBuilderExampleCtrl', function($http, $scope) {
	$scope.spec = {
		_id: {type: 'objectId'},
		name: {type: 'string'},
		username: {type: 'string'},
		email: {type: 'string'},
		'address.street': {type: 'string'},
		'address.city': {type: 'string'},
		'address.zip': {type: 'string'},
		'address.state': {type: 'string'},
		'address.country': {type: 'string'},
		phone: {type: 'string'},
		website: {type: 'string'},
		'company.name': {type: 'string'},
		role: {type: 'string', enum: ['user', 'admin', 'root']},
		status: {type: 'string', enum: ['pending', 'active', 'deleted']},
		lastLogin: {type: 'date'},
	};

	$scope.query = {
		email: {$exists: true},
		role: 'user',
		status: {$in: ['pending', 'active']},
		lastLogin: {$lt: moment().subtract(2, 'd').toDate()},
		sort: 'username',
		limit: 10,
	};

	$scope.data;
	$scope.$watch('query', ()=> {
		// console.log('REFRESH', $scope.query);
		$http.get('api/data', {params: $scope.query})
			.then(res => $scope.data = res.data)
	}, true);
});
