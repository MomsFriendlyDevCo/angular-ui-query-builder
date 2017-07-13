var app = angular.module("app", [
	'angular-ui-query-builder'
]);

app.controller("queryBuilderExampleCtrl", function($scope) {
	$scope.spec = {
		_id: {type: 'objectId'},
		lastLogin: {type: 'date'},
		status: {type: 'string', enum: ['pending', 'active', 'approved', 'deleted']},
		role: {type: 'string', enum: ['user', 'admin', 'root']},
		name: {type: 'string'},
		email: {type: 'string'},
		emailStatus: {type: 'string', enum: ['unverified', 'verified']},
	};

	$scope.query = {
		email: {$exists: true},
		role: 'admin',
		status: {$in: ['active', 'approved']},
		$or: [
			{role: 'email', $exists: {email: true}},
			{emailStatus: {$in: ['verified']}},
		],
	};
});
