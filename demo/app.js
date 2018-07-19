var app = angular.module("app", [
	'angular-ui-query-builder'
]);

// Force URL encoding to use jQuery syntax so we can pass JSON to the backend using URL query objects
app.config($httpProvider => $httpProvider.defaults.paramSerializer = '$httpParamSerializerJQLike')

// Add a custom quesiton to the exporter
app.config(qbTableSettingsProvider => {
	qbTableSettingsProvider.debug = true;

	qbTableSettingsProvider.export.questions.push({
		id: 'docTitle',
		type: 'text',
		title: 'Document title',
		default: 'Exported Data',
		help: 'What your document will be called when exported',
	});

});

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
		sort: 'username',
		limit: 10,
	};


	// Data refresher {{{
	$scope.data;
	$scope.count;
	$scope.refresh = ()=> {
		console.log('REFRESH', $scope.query);
		$http.get('api/data', {params: $scope.query})
			.then(res => $scope.data = res.data);

		$http.get('api/count', {params: $scope.query})
			.then(res => $scope.count = res.data.count);
	}

	$scope.$on('queryBuilder.change', $scope.refresh);

	// Kickoff initial refresh
	$scope.$evalAsync($scope.refresh);
	// }}}


	$scope.notifyChange = (id, value) => console.log('Value of', id, 'changed to', value);

	$scope.isGitHub = /\.github.io$/.test(document.location.hostname);
});
