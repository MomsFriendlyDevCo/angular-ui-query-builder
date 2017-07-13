angular-ui-query-builder
========================
MongoDB format query-builder UI component for Angular.

[Demo](https://momsfriendlydevco.github.io/angular-ui-query-builder).


Installation
------------
1. Grab the NPM

```shell
npm install --save @momsfriendlydevco/angular-ui-query-builder
```


2. Install the required script + CSS somewhere in your build chain or include it in a HTML header:

```html
<script src="/libs/angular-ui-query-builder/dist/angular-ui-query-builder.min.js"/>
<link href="/libs/angular-ui-query-builder/dist/angular-ui-query-builder.min.css" rel="stylesheet" type="text/css"/>
```

3. Include the router in your main `angular.module()` call:

```javascript
var app = angular.module('app', ['angular-ui-query-builder'])
```

4. Use somewhere in your template:

```html
<ui-query-builder query="$ctrl.myQuery" spec="$ctrl.mySpec"></ui-query-builder>
```

A demo is also available. To use this [follow the instructions in the demo directory](./demo/README.md).


TODO
====

* [x] Basic field filtering
* [ ] CSS tidyup
* [ ] Compound queries - `$or` / `$and`
* [ ] Automatically moving from a static string (`$eq` condition) to a multiple choice enum (`$in`) when a comma is used in a string
* [ ] Convert string ENUMs to a `$in` type automatically
* [ ] Number filtering - above, below, between
* [ ] Date support - date selector, before, after
* [ ] Nicer syntax support for `$regexp`
* [ ] Support for `$length`
* [ ] Nicer multi level path support
