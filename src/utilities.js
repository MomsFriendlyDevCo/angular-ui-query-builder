// @ifndef ANGULAR
var _ = require('lodash');

module.exports = {
// @endif
	/**
	* Return a human readable synopsis of a query
	* @param {object} query The query to summerise
	* @return {string} A short string summerising the query
	*/
	getSynopsis: query => {
		var filters = _.keys(query).filter(i => !['sort', 'skip', 'limit', 'select'].includes(i));

		return [
			!filters.length ? 'All documents'
				: filters.length == 1 ? '1 filter'
				: `${filters.length} filters`,
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


	/**
	* Find the dotted path to a specific query element by a predicate
	* @param {object} query The query to search
	* @returns {string|false} Either the found path of the item or false
	*/
	find: (query, predicate) => {
		var searchExpr = _.isFunction(predicate) ? predicate : _.matches(predicate);
		var foundPath;
		var deepSearcher = (node, path) => {
			if (searchExpr(node, path.slice(path.length-1))) {
				foundPath = path;
				return true;
			} else if (_.isArray(node)) {
				return node.some((v, k) => deepSearcher(v, path.concat(k)));
			} else if (_.isObject(node)) {
				return _.some(node, (v, k) => deepSearcher(v, path.concat(k)));
			}
		};

		var res = deepSearcher(query, []);
		return res ? foundPath : false;
	},

	/**
	* Utlility function to return an escaped expression within a RegExp
	* @param {string} text The text to escape
	* @returns {string} The escaped expression
	*/
	escapeRegExp: text => String(text).replace(/(\W)/g, '\\$1'),

	/**
	* Utility to reverse quoting a RegExp
	* @param {string} text The escaped regular expression to reverse
	* @returns {string} The unescaped expression
	*/
	unescapeRegExp: text => String(text).replace(/\\(\W)/g, '$1'),

// @ifndef ANGULAR
}
// @endif
