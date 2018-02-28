var app = angular.module("app", [
	'angular-ui-query-builder'
]);

// Force URL encoding to use jQuery syntax so we can pass JSON to the backend using URL query objects
app.config($httpProvider => $httpProvider.defaults.paramSerializer = '$httpParamSerializerJQLike')

// Add a custom quesiton to the exporter
app.config(qbTableSettingsProvider => {
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
		lastLogin: {$lt: moment().subtract(2, 'd').toDate()},
		sort: 'username',
		limit: 10,
	};

	// FIXME: Pre-populated search for 'xxx' - this will be removed before deploy {{{
	$scope.query = {
		"$and": [
			{
				"email": {
					"$exists": true
				},
				"role": "user",
				"status": {
					"$in": [
						"pending",
						"active"
					]
				},
				"lastLogin": {
					"$lt": "2018-02-26T05:02:10.498Z"
				},
				"sort": "username",
				"limit": 10
			},
			{
				"$comment": "search",
				"$or": {
					"name": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"username": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"email": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"address.street": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"address.city": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"address.zip": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"address.state": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"address.country": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"phone": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"website": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"company.name": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"role": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					],
					"status": [
						{
							"$regexp": "/xxx/",
							"options": "i"
						}
					]
				}
			}
		]
	};
	// }}}

	$scope.data;
	$scope.$watch('query', ()=> {
		// console.log('REFRESH', $scope.query);
		$http.get('api/data', {params: $scope.query})
			.then(res => $scope.data = res.data)
	}, true);

	$scope.notifyChange = (id, value) => console.log('Value of', id, 'changed to', value);

	$scope.isGitHub = /\.github.io$/.test(document.location.hostname);
});
