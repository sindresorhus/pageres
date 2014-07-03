'use strict';
var gui = nwrequire('nw.gui');
var options = JSON.parse(gui.App.argv.toString());

options.width = parseInt(options.width, 10);
options.height = parseInt(options.height, 10);

var win = gui.Window.open('https://github.com', {
  position: 'center',
  width: options.width,
  height: options.height,
  show: false
});

win.on('document-end', function(){
	setTimeout(function(){
		win.capturePage(function(buffer) {
			process.stdout.write(buffer);
			win.close(true);
			gui.Window.get().close(true);
		 }, { format : 'png', datatype : 'buffer'});
	}, options.delay * 2000);
});
