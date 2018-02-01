var faker = require('faker');
module.exports = [...Array(100)].map((i, offset) => ({
	id: `user${offset}`,
	name: `${faker.name.firstName()} ${faker.name.lastName()}`,
	username: faker.internet.userName(),
	email: Math.random() > 0.4
		? faker.internet.email()
		: undefined,
	address: {
		street: faker.address.streetAddress(),
		city: faker.address.city(),
		zip: faker.address.zipCode(),
		state: faker.address.state(),
		country: faker.address.country(),
	},
	phone: Math.random() > 0.5
		? faker.phone.phoneNumber()
		: undefined,
	website: Math.random() > 0.5
		? faker.internet.url()
		: undefined,
	company: Math.random() > 0.7
		? {name: faker.company.companyName()}
		: undefined,
	role:
		Math.random() > 0.3 ? 'user'
		: Math.random() > 0.3 ? 'admin'
		: 'root',
	status:
		Math.random() > 0.3 ? 'active'
		: Math.random() > 0.3 ? 'pending'
		: 'deleted',
	lastLogin: Math.random() > 0.5
		? faker.date.past()
		: faker.date.recent(),
}));
