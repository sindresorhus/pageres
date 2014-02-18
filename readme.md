# <img src="logo.png" width="500" alt="pageres">

> Get screenshots of the websites in different resolutions

[![Build Status](https://travis-ci.org/sindresorhus/pageres.png?branch=master)](https://travis-ci.org/sindresorhus/pageres)

A good way to make sure your websites are responsive.

It's speedy and generates 100 screenshots from 10 different websites in just over a minute.

![](screenshot.png)

![](screenshot-output.png)


## CLI app

### Install

```sh
$ npm install --global pageres
```

*PhantomJS, which is used for generating the screenshots, is installed automagically, but in some [rare cases](https://github.com/Obvious/phantomjs/issues/102) it might fail to and you'll get an `Error: spawn EACCES` error. [Download](http://phantomjs.org/download.html) PhantomJS manually and reinstall pageres if that happens.*


### Usage

```sh
$ pageres --help

Get screenshots of websites in different resolutions.

Specify urls and screen resolutions as arguments. Order doesn't matter.
Screenshots are saved in the current directory.

Usage
  pageres <url> <resolution> [<resolution> <url> ...]
  pageres [<url> <resolution> ...] < <file>
  cat <file> | pageres [<url> <resolution> ...]

Example
  pageres todomvc.com yeoman.io 1366x768 1600x900
  pageres 1366x768 < urls.txt
  cat screen-resolutions.txt | pageres todomvc.com yeoman.io

You can also pipe in a newline separated list of urls and screen resolutions which will get merged with the arguments.
If no screen resolutions are specified it will fall back to the ten most popular ones according to w3counter.
```


## Programmatic API

### Install

```sh
$ npm install --save pageres
```

### Example

```js
var pageres = require('pageres');

pageres(['todomvc.com'], ['1366x768', '1600x900'], function () {
	console.log('done');
});
```


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
