var _ = require('lodash');
var babel = require('gulp-babel');
var concat = require('gulp-concat');
var cleanCSS = require('gulp-clean-css');
var file = require('gulp-file');
var ghPages = require('gulp-gh-pages');
var gulp = require('gulp');
var gutil = require('gulp-util');
var preprocess = require('gulp-preprocess');
var plumber = require('gulp-plumber');
var nodemon = require('gulp-nodemon');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var rimraf = require('rimraf');
var uglify = require('gulp-uglify');
var watch = require('gulp-watch');

gulp.task('default', ['serve']);
gulp.task('build', ['js', 'css']);
gulp.on('stop', ()=> process.exit(0));


gulp.task('serve', ['build'], function(done) {
	var monitor = nodemon({
		script: './demo/server.js',
		ext: 'js css',
		ignore: ['./src/**/*.js', '**/.css'], // Ignore everything else as its watched seperately
	})
		.on('start', function() {
			console.log('Server started');
		})
		.on('restart', function() {
			console.log('Server restarted');
		});

	watch(['./index.js', 'demo/**/*.js', 'src/**/*.js'], function() {
		console.log('Rebuild client-side JS files...');
		gulp.start('js');
	});

	watch(['demo/**/*.css', 'src/**/*.css'], function() {
		console.log('Rebuild client-side CSS files...');
		gulp.start('css');
	});

	// Intentionally never call 'done()' to exit
});


gulp.task('js', ['js:all', 'js:core', 'js:tables']);

gulp.task('js:all', ()=>
	gulp.src([
		'./src/angular-ui-query-builder-core.js',
		'./src/angular-ui-query-builder-tables.js',
	])
		.pipe(plumber({
			errorHandler: function(err) {
				gutil.log(gutil.colors.red('ERROR DURING JS BUILD'));
				process.stdout.write(err.stack);
				this.emit('end');
			},
		}))
		.pipe(concat('angular-ui-query-builder.js'))
		.pipe(preprocess({context: {ANGULAR: true}}))
		.pipe(babel({
			presets: ['es2015'],
			plugins: ['angularjs-annotate'],
		}))
		.pipe(gulp.dest('./dist'))
		.pipe(concat('angular-ui-query-builder.min.js'))
		.pipe(uglify())
		.pipe(gulp.dest('./dist'))
);

gulp.task('js:core', ()=>
	gulp.src('./src/angular-ui-query-builder-core.js')
		.pipe(plumber({
			errorHandler: function(err) {
				gutil.log(gutil.colors.red('ERROR DURING JS BUILD'));
				process.stdout.write(err.stack);
				this.emit('end');
			},
		}))
		.pipe(concat('angular-ui-query-builder-core.js'))
		.pipe(preprocess({context: {ANGULAR: true}}))
		.pipe(babel({
			presets: ['es2015'],
			plugins: ['angularjs-annotate'],
		}))
		.pipe(gulp.dest('./dist'))
		.pipe(concat('angular-ui-query-builder-core.min.js'))
		.pipe(uglify())
		.pipe(gulp.dest('./dist'))
);

gulp.task('js:tables', ()=>
	gulp.src('./src/angular-ui-query-builder-tables.js')
		.pipe(plumber({
			errorHandler: function(err) {
				gutil.log(gutil.colors.red('ERROR DURING JS BUILD'));
				process.stdout.write(err.stack);
				this.emit('end');
			},
		}))
		.pipe(concat('angular-ui-query-builder-tables.js'))
		.pipe(preprocess({context: {ANGULAR: true}}))
		.pipe(babel({
			presets: ['es2015'],
			plugins: ['angularjs-annotate'],
		}))
		.pipe(gulp.dest('./dist'))
		.pipe(concat('angular-ui-query-builder-tables.min.js'))
		.pipe(uglify())
		.pipe(gulp.dest('./dist'))
);

gulp.task('css', ['css:all', 'css:core', 'css:tables']);

gulp.task('css:all', ()=>
	gulp.src([
		'./src/angular-ui-query-builder-core.css',
		'./src/angular-ui-query-builder-tables.css',
	])
		.pipe(concat('angular-ui-query-builder.css'))
		.pipe(gulp.dest('./dist'))
		.pipe(concat('angular-ui-query-builder.min.css'))
		.pipe(cleanCSS())
		.pipe(gulp.dest('./dist'))
);

gulp.task('css:core', ()=>
	gulp.src('./src/angular-ui-query-builder-core.css')
		.pipe(concat('angular-ui-query-builder-core.css'))
		.pipe(gulp.dest('./dist'))
		.pipe(concat('angular-ui-query-builder-core.min.css'))
		.pipe(cleanCSS())
		.pipe(gulp.dest('./dist'))
);

gulp.task('css:tables', ()=>
	gulp.src('./src/angular-ui-query-builder-tables.css')
		.pipe(concat('angular-ui-query-builder-tables.css'))
		.pipe(gulp.dest('./dist'))
		.pipe(concat('angular-ui-query-builder-tables.min.css'))
		.pipe(cleanCSS())
		.pipe(gulp.dest('./dist'))
);

gulp.task('gh-pages', ['build'], function() {
	rimraf.sync('./gh-pages');

	var data = require('./demo/testData.js');

	return gulp.src([
		'./LICENSE',
		'./demo/_config.yml',
		'./demo/app.js',
		'./demo/app.css',
		'./demo/index.html',
		'./dist/**/*',
		'./node_modules/angular/angular.min.js',
		'./node_modules/bootstrap/dist/css/bootstrap.min.css',
		'./node_modules/bootstrap/dist/js/bootstrap.min.js',
		'./node_modules/lodash/lodash.min.js',
		'./node_modules/jquery/dist/jquery.min.js',
		'./node_modules/font-awesome/css/font-awesome.min.css',
		'./node_modules/font-awesome/fonts/fontawesome-webfont.ttf',
		'./node_modules/font-awesome/fonts/fontawesome-webfont.woff',
		'./node_modules/font-awesome/fonts/fontawesome-webfont.woff2',
		'./node_modules/moment/min/moment.min.js',
	], {base: __dirname})
		.pipe(rename(function(path) {
			if (path.dirname == 'demo') { // Move all demo files into root
				path.dirname = '.';
			}
			return path;
		}))
		.pipe(file('data.json', JSON.stringify(data)))
		.pipe(file('count.json', JSON.stringify({count: data.length})))
		.pipe(replace(/api\/data/, 'data.json', {skipBinary: true}))
		.pipe(replace(/api\/count/, 'count.json', {skipBinary: true}))
		.pipe(ghPages({
			cacheDir: 'gh-pages',
			push: true, // Change to false for dryrun (files dumped to cacheDir)
		}))
});
