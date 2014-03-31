# <img src="logo.png" width="500" alt="pageres">

> Get screenshots of the websites in different resolutions

[![Build Status](https://travis-ci.org/sindresorhus/pageres.svg?branch=master)](https://travis-ci.org/sindresorhus/pageres)

A good way to make sure your websites are responsive.

It's speedy and generates 100 screenshots from 10 different websites in just over a minute.

![](screenshot.png)

![](screenshot-output.png)


## Install

```sh
$ npm install --global pageres
```

*PhantomJS, which is used for generating the screenshots, is installed automagically, but in some [rare cases](https://github.com/Obvious/phantomjs/issues/102) it might fail to and you'll get an `Error: spawn EACCES` error. [Download](http://phantomjs.org/download.html) PhantomJS manually and reinstall pageres if that happens.*


## Usage

```
$ pageres --help

Specify urls and screen resolutions as arguments. Order doesn't matter. Group arguments with [ ]
Screenshots are saved in the current directory.

Usage
  pageres <url> <resolution>
  pageres [ <url> <resolution> ] [ <url> <resolution> ]
  pageres [ <url> <resolution> ... ] < <file>
  cat <file> | pageres [ <url> <resolution> ... ]

Example
  pageres todomvc.com yeoman.io 1366x768 1600x900
  pageres [ yeoman.io 1366x768 1600x900 ] [ todomvc.com 1024x768 480x320 ]
  pageres --delay 3 1366x768 < urls.txt
  cat screen-resolutions.txt | pageres todomvc.com yeoman.io

Options
  -d, --delay <seconds>    Delay capturing the screenshot

You can also pipe in a newline separated list of urls and screen resolutions which will get merged with the arguments. If no screen resolutions are specified it will fall back to the ten most popular ones according to w3counter.
```


## API

*The API is still in flux and might change between minor versions. Feedback welcome!*

### Install

```sh
$ npm install --save pageres
```

### Usage

```js
var eachAsync = require('each-async');
var pageres = require('pageres');

var items = [{
	url: 'yeoman.io',
	sizes: ['480x320', '1024x768']
}, {
	url: 'todomvc.com',
	sizes: ['1280x1024', '1920x1080']
}];

pageres(items, { delay: 2 }, function (err, shots) {
	eachAsync(shots, function (el, i, next) {
		var stream = el.pipe(fs.createWriteStream(el.filename));
		stream.on('finish', next);
		stream.on('error', next);
	}, function (err) {
		if (err) {
			throw err;
		}

		console.log('done');
	});
});
```

### Options

#### delay

Type: `number`  
Default: `0`

Delay capturing the screenshot.

Useful when the site does things after load that you want to capture.


## Google Analytics screen resolutions

You can use the most popular resolutions for your site with `pageres` by following these steps:

- In Google Analytics go to the site for which you want screen resolutions
- Select `Audience` => `Technology` => `Browser & OS`
- Click the `Screen Resolution` link in the middle of the screen
- Click the `Export` button at the top, then `Google Spreadsheets`, and select yes for importing
- Select all the resolutions and copy them into a new file and save it
- In your terminal run: `pageres website.com < file-from-above-step.txt`


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
