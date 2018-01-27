var app = angular.module("app", [
	'angular-ui-query-builder'
]);

app.controller("queryBuilderExampleCtrl", function($http, $scope) {
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
		status: {$in: ['pending', 'approved']},
	};

	$scope.data;
	$scope.$watch('query', ()=> {
		console.log('REFRESH', $scope.query);
		$http.get('api/data', {params: $scope.query})
			.then(res => $scope.data = res.data)
	}, true);
});
