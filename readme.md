# ![pageres](media/promo.png)

[![Build Status](http://img.shields.io/travis/sindresorhus/pageres/master.svg?style=flat)](https://travis-ci.org/sindresorhus/pageres?style=flat) ![](http://img.shields.io/badge/unicorn-approved-ff69b4.svg?style=flat)

Capture screenshots of websites in various resolutions. A good way to make sure your websites are responsive.

It's speedy and generates 100 screenshots from 10 different websites in just over a minute.

![](media/screenshot.png)

![](media/screenshot-output.png)


## Install

```sh
$ npm install --global pageres
```

*PhantomJS, which is used for generating the screenshots, is installed automagically, but in some [rare cases](https://github.com/Obvious/phantomjs/issues/102) it might fail to and you'll get an `Error: spawn EACCES` error. [Download](http://phantomjs.org/download.html) PhantomJS manually and reinstall pageres if that happens.*


## Usage

Specify urls and screen resolutions as arguments. Order doesn't matter.

If no resolution is specified it will default to `1366x768` which is the most popular resolution.

```sh
$ pageres <url> <resolution>
$ pageres <resolution> <url>

# <url> can also be a local file path.
$ pageres <file> <resolution>
```

List multiple urls and resolutions for pageres to capture all combinations.

```sh
$ pageres <url> <resolution> ...

$ pageres todomvc.com 1024x768 1366x768 # 2 screenshots
$ pageres todomvc.com yeoman.io 1024x768 # 2 screenshots
$ pageres todomvc.com yeoman.io 1024x768 1366x768 # 4 screenshots
```

Pipe in a newline separated list of urls and screen resolutions which will get merged with the arguments.

```sh
# In this case a list of screen resolutions
$ pageres <url> < screen-resolutions.txt
```

Group arguments with square brackets.

```sh
$ pageres [ <url> <resolution> ] [ <url> <resolution> ]
$ pageres [ <url> <resolution> ... ]

# Mix grouped and single arguments
$ pageres [ yeoman.io 1024x768 1600x900 ] todomvc.com 1366x768

# Options defined inside a group will override the outer ones.
$ pageres [ yeoman.io 1024x768 --no-crop ] todomvc.com 1366x768 --crop
```

Screenshots are saved in the current directory.

### Examples

```sh
# Basic multi-url, multi-resolution usage
pageres todomvc.com yeoman.io 1366x768 1600x900

# Override outer option within group
pageres [ yeoman.io 1366x768 1600x900 --no-crop ] [ todomvc.com 1024x768 480x320 ] --crop

# Provide a custom filename template
pageres todomvc.com 1024x768 --filename '<%= date %> - <%= url %>'

# Capture a specific element
pageres yeoman.io 1366x768 --selector '.page-header'

# Hide a specific element
pageres yeoman.io 1366x768 --hide '.page-header'

# Delay and pipe in a list of urls
pageres --delay 3 1366x768 < urls.txt

# Capture a local file
pageres unicorn.html 1366x768

# Pipe in resolutions
cat screen-resolutions.txt | pageres todomvc.com yeoman.io
```

### Options

##### `-v`, `--verbose`

Verbose output to see errors if you need to troubleshoot.

##### `-c`, `--crop`

Crop to the set height.

```sh
$ pageres todomvc.com 1024x768 --crop
```

##### `-d`, `--delay`

Delay screenshot capture.

```sh
$ pageres todomvc.com 1024x768 --delay 3
```

##### `--filename <template>`

Custom filename.

```sh
$ pageres todomvc.com 1024x768 --filename '<%= date %> - <%= url %>'
```

##### `--selector <element>`

Capture DOM element.

```sh
$ pageres yeoman.io 1366x768 --selector '.page-header'
```

##### `--hide <element>`

Hide DOM element, can be set multiple times.

```sh
$ pageres yeoman.io 1366x768 --hide '.page-header'
```

##### `--no-crop`

Override a global crop option within a group.

```sh
$ pageres [ yeoman.io 1366x768 --no-crop ] todomvc.com 1024x768 --crop
```

##### `--cookie <cookie>`

Browser cookie, can be set multiple times.

```sh
$ pageres yeoman.io 1024x768 --cookie 'foo=bar'
```

##### `--username <username>`

Username for HTTP auth.

##### `--password <password>`

Password for HTTP auth.

##### `--scale <number>`

Scale webpage `n` of times.


## Config file

You can persist your commands into a file and run it whenever with eg. `sh .pageres`:

```sh
# .pageres
pageres [ todomvc.com 1000x1000 --crop ] [ yeoman.io 500x500 ]
pageres [ google.com 1000x1000 --crop ] [ github.com 500x500 ]
```


## Task runners

Check out [grunt-pageres](https://github.com/sindresorhus/grunt-pageres) if you're using grunt.

For gulp and broccoli, just use the below API directly. No need for a wrapper plugin.  
*(If you create a useless gulp/broccoli wrapper plugin for this, my cat will be very sad.)*


## API

### Install

```sh
$ npm install --save pageres
```

### Usage

```js
var Pageres = require('pageres');

var pageres = new Pageres({delay: 2})
	.src('yeoman.io', ['480x320', '1024x768', 'iphone 5s'], {crop: true})
	.src('todomvc.com', ['1280x1024', '1920x1080'])
	.dest(__dirname);

pageres.run(function (err) {
	if (err) {
		throw err;
	}

	console.log('done');
});
```


### Pageres(options)

#### options

##### delay

Type: `number` *(seconds)*  
Default: `0`

Delay capturing the screenshot.

Useful when the site does things after load that you want to capture.

##### crop

Type: `boolean`  
Default: `false`

Crop to the set height.

##### cookies

Type: `array` of `string`, `object`

A string with the same format as a [browser cookie](http://en.wikipedia.org/wiki/HTTP_cookie) or an object of what [`phantomjs.addCookie`](http://phantomjs.org/api/phantom/method/add-cookie.html) accepts.

###### Tip

Go to the website you want a cookie for and copy-paste it from Dev Tools.

##### filename

Type: `string`

Define a customized filename using [Lo-Dash templates](http://lodash.com/docs#template).  
For example `<%= date %> - <%= url %>-<%= size %><%= crop %>`.

Available variables:

- `url`: The URL in [slugified](https://github.com/ogt/slugify-url) form, eg. `http://yeoman.io/blog/` becomes `yeoman.io!blog`
- `size`: Specified size, eg. `1024x1000`
- `width`: Width of the specified size, eg. `1024`
- `height`: Height of the specified size, eg. `1000`
- `crop`: Outputs `-cropped` when the crop option is true
- `date`: The current date

##### selector

Type: `string`

Capture a specific DOM element.

##### hide

Type: `array`

Hide an array of DOM elements.

##### username

Type: `string`

Username for authenticating with HTTP auth.

##### password

Type: `string`

Password for authenticating with HTTP auth.

##### scale

Type: `Number`  
Default: `1`

Scale webpage `n` times.


### pageres.src(url, sizes, options)

Add a page to screenshot.

#### url

*Required*  
Type: `string`

URL or local path to the website you want to screenshot.

#### sizes

*Required*  
Type: `array`

Use a `<width>x<height>` notation or a keyword.

A keyword is a version of a device from [this list](http://viewportsizes.com).
You can also pass in the `w3counter` keyword to use the ten most popular
resolutions from [w3counter](http://www.w3counter.com/globalstats.php).

#### options

Type: `object`

Options set here will take precedence over the ones set in the constructor.

### pageres.dest(directory)

Set the destination directory.

#### directory

Type: `string`

### pageres.run(callback)

Run pageres.

#### callback(error, [items])

Type: `function`

If you don't set a `dest()` you'll get `items` in this callback, which is an array of streams.

### pageres.on('warn', callback)

Warnings with eg. page errors.


## Google Analytics screen resolutions

You can use the most popular resolutions for your site with `pageres` by following these steps:

- In Google Analytics go to the site for which you want screen resolutions
- Select `Audience` => `Technology` => `Browser & OS`
- Click the `Screen Resolution` link in the middle of the screen
- Click the `Export` button at the top, then `Google Spreadsheets`, and select yes for importing
- Select all the resolutions and copy them into a new file and save it
- In your terminal run: `pageres website.com < file-from-above-step.txt`


## Credit

[![Sindre Sorhus](http://gravatar.com/avatar/d36a92237c75c5337c17b60d90686bf9?s=144)](http://sindresorhus.com) | [![Kevin Mårtensson](http://gravatar.com/avatar/48fa294e3cd41680b80d3ed6345c7b4d?s=144)](https://github.com/kevva)
---|---
[Sindre Sorhus](http://sindresorhus.com) (creator) | [Kevin Mårtensson](https://github.com/kevva) (maintainer)


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
