import Pageres from './dist/index.js';

await new Pageres({delay: 2})
	.source('https://github.com/sindresorhus/pageres', ['480x320', '1024x768'], {crop: true})
	.source('https://sindresorhus.com', ['1280x1024', '1920x1080'])
	.source('data:text/html,<h1>Awesome!</h1>', ['1024x768'])
	.destination('screenshots')
	.run();

console.log('Finished generating screenshots!');
