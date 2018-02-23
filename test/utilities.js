var expect = require('chai').expect;
var utilities = require('../src/utilities');

describe('utilities.find', function() {

	it('should be able to find a simple key/val path', ()=> {
		var q = {foo: 'foo!', bar: 'bar!', baz: 'baz!'};
		expect(utilities.find(q, 'foo!')).to.be.deep.equal(['foo']);
	});

	it('should be able to find a deeply nested key/val path (expression)', ()=> {
		var q = {foo: {fooFoo: 'FooFoo!', fooBar: 'FooBar!'}, bar: {barFoo: 'BarFoo!', barBar: 'BarBar!'}};
		expect(utilities.find(q, 'BarFoo!')).to.be.deep.equal(['bar', 'barFoo']);
	});

	it('should be able to find a deeply nested key/val path', ()=> {
		var q = {foo: {fooFoo: 'FooFoo!', fooBar: 'FooBar!'}, bar: {barFoo: 'BarFoo!', barBar: 'BarBar!'}};
		expect(utilities.find(q, (v, k) => v == 'BarFoo!')).to.be.deep.equal(['bar', 'barFoo']);
	});

});
