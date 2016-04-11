# ![pageres](media/promo.png)

[![Build Status](https://travis-ci.org/sindresorhus/pageres.svg?branch=master)](https://travis-ci.org/sindresorhus/pageres) [![Coverage Status](https://coveralls.io/repos/sindresorhus/pageres/badge.svg?branch=master)](https://coveralls.io/r/sindresorhus/pageres?branch=master)

Capture screenshots of websites in various resolutions. A good way to make sure your websites are responsive. It's speedy and generates 100 screenshots from 10 different websites in just over a minute. It can also be used to render SVG images.

*See [pageres-cli](https://github.com/sindresorhus/pageres-cli) for the command-line tool.*


## Install

```
$ npm install --save pageres
```

*PhantomJS, which is used for generating the screenshots, is installed automagically, but in some [rare cases](https://github.com/Obvious/phantomjs/issues/102) it might fail to and you'll get an `Error: spawn EACCES` error. [Download](http://phantomjs.org/download.html) PhantomJS manually and reinstall pageres if that happens.*


## Usage

```js
const Pageres = require('pageres');

const pageres = new Pageres({delay: 2})
	.src('yeoman.io', ['480x320', '1024x768', 'iphone 5s'], {crop: true})
	.src('todomvc.com', ['1280x1024', '1920x1080'])
	.dest(__dirname)
	.run()
	.then(() => console.log('done'));
```

## API

### Pageres([options])

#### options

##### delay

Type: `number` *(seconds)*  
Default: `0`

Delay capturing the screenshot.

Useful when the site does things after load that you want to capture.

##### timeout

Type: `number` *(seconds)*  
Default: `60`

Number of seconds after which PhantomJS aborts the request.

##### crop

Type: `boolean`  
Default: `false`

Crop to the set height.

##### css

Type: `string`

Apply custom CSS to the webpage. Specify some CSS or the path to a CSS file.

##### cookies

Type: `array` of `string`, `object`

A string with the same format as a [browser cookie](https://en.wikipedia.org/wiki/HTTP_cookie) or an object of what [`phantomjs.addCookie`](http://phantomjs.org/api/phantom/method/add-cookie.html) accepts.

###### Tip

Go to the website you want a cookie for and copy-paste it from Dev Tools.

##### filename

Type: `string`

Define a customized filename using [Lo-Dash templates](https://lodash.com/docs#template).  
For example `<%= date %> - <%= url %>-<%= size %><%= crop %>`.

Available variables:

- `url`: The URL in [slugified](https://github.com/ogt/slugify-url) form, eg. `http://yeoman.io/blog/` becomes `yeoman.io!blog`
- `size`: Specified size, eg. `1024x1000`
- `width`: Width of the specified size, eg. `1024`
- `height`: Height of the specified size, eg. `1000`
- `crop`: Outputs `-cropped` when the crop option is true
- `date`: The current date (Y-M-d), eg. 2015-05-18
- `time`: The current time (h-m-s), eg. 21-15-11

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

Type: `number`  
Default: `1`

Scale webpage `n` times.

##### format

Type: `string`  
Default: `png`  
Values: `png`, `jpg`

Image format.

##### userAgent

Type: `string`

Custom user agent.

##### headers

Type: `object`

Custom HTTP request headers.


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

### pageres.run()

Run pageres. Returns a promise for an array of streams.

### pageres.on('warn', callback)

Warnings with e.g. page errors.


## Task runners

Check out [grunt-pageres](https://github.com/sindresorhus/grunt-pageres) if you're using Grunt.

For Gulp and Broccoli, just use the API directly. No need for a wrapper plugin.


## Built with Pageres

- [Break Shot](https://github.com/victorferraz/break-shot) - Desktop app for capturing screenshots of responsive websites.


## Team

[![Sindre Sorhus](http://gravatar.com/avatar/d36a92237c75c5337c17b60d90686bf9?s=144)](https://sindresorhus.com) | [![Kevin Mårtensson](https://gravatar.com/avatar/48fa294e3cd41680b80d3ed6345c7b4d?s=144)](https://github.com/kevva) | [![Sam Verschueren](https://gravatar.com/avatar/30aba8d6414326b745aa2516f5067d53?s=144)](https://github.com/SamVerschueren)
---|---|---
[Sindre Sorhus](https://sindresorhus.com) | [Kevin Mårtensson](https://github.com/kevva) | [Sam Verschueren](https://github.com/SamVerschueren)


## License

MIT © [Sindre Sorhus](https://sindresorhus.com)
