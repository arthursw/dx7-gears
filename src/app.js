// var paper = require('paper/dist/paper-full');

var _ = require('lodash');
var Angular = require('angular');
var ngStorage = require('ngstorage');
var MMLEmitter = require('mml-emitter');
var MIDIFile = require('midifile');
var MIDIPlayer = require('midiplayer');

var FMVoice = require('./voice-dx7');
var MIDI = require('./midi');
var Synth = require('./synth');
var SysexDX7 = require('./sysex-dx7');
var Visualizer = require('./visualizer');

var config = require('./config');
var defaultPresets = require('./default-presets');

var BUFFER_SIZE_MS = 1000 * config.bufferSize / config.sampleRate;
var MS_PER_SAMPLE = 1000 / config.sampleRate;
var VIZ_MODE_NONE = 0;
var VIZ_MODE_FFT = 1;
var VIZ_MODE_WAVE = 2;
var PARAM_START_MANIPULATION = 'param-start-manipulation';
var PARAM_STOP_MANIPULATION = 'param-stop-manipulation';
var PARAM_CHANGE = 'param-change';
var DEFAULT_PARAM_TEXT = '--';

var app = Angular.module('synthApp', ['ngStorage']);
var synth = new Synth(FMVoice, config.polyphony);
var midi = new MIDI(synth);
var audioContext = new (window.AudioContext || window.webkitAudioContext)();
var visualizer = new Visualizer("analysis", 256, 35, 0xc0cf35, 0x2f3409, audioContext);
var scriptProcessor = null;

var noteOffset = 50;
// var qwertyNotes = [];

// var keys1 = "azertyuiop";
// var keys2 = "qsdfghjklm";
// var keys3 = "wxcvbn";

// var lowNote = 30;
// for ( var i = 0; i < keys1.length; i++ ) {
// 	qwertyNotes[keys1.charCodeAt(i)] = i + lowNote;
// }
// lowNote += keys1.length;

// for ( var i = 0; i < keys2.length; i++ ) {
// 	qwertyNotes[keys2.charCodeAt(i)] = i + lowNote;
// }
// lowNote += keys2.length;

// for ( var i = 0; i < keys2.length; i++ ) {
// 	qwertyNotes[keys3.charCodeAt(i)] = i + lowNote;
// }

var qwertyNotes = {};
var keys = "AZERTYUIOPQSDFGHJKLMWXCVBN";

for ( var i = 0; i < keys.length; i++ ) {
	console.log(keys.charAt(i) + ": " + i)
	qwertyNotes[keys.charAt(i)] = i;
}

//Lower row: zsxdcvgbhnjm...


// qwertyNotes[16] = 41; // = F2
// qwertyNotes[65] = 42;
// qwertyNotes[90] = 43;
// qwertyNotes[83] = 44;
// qwertyNotes[88] = 45;
// qwertyNotes[68] = 46;
// qwertyNotes[67] = 47;
// qwertyNotes[86] = 48; // = C3
// qwertyNotes[71] = 49;
// qwertyNotes[66] = 50;
// qwertyNotes[72] = 51;
// qwertyNotes[78] = 52;
// qwertyNotes[77] = 53; // = F3
// qwertyNotes[75] = 54;
// qwertyNotes[188] = 55;
// qwertyNotes[76] = 56;
// qwertyNotes[190] = 57;
// qwertyNotes[186] = 58;
// qwertyNotes[191] = 59;

// // Upper row: q2w3er5t6y7u...
// qwertyNotes[81] = 60; // = C4 ("middle C")
// qwertyNotes[50] = 61;
// qwertyNotes[87] = 62;
// qwertyNotes[51] = 63;
// qwertyNotes[69] = 64;
// qwertyNotes[82] = 65; // = F4
// qwertyNotes[53] = 66;
// qwertyNotes[84] = 67;
// qwertyNotes[54] = 68;
// qwertyNotes[89] = 69;
// qwertyNotes[55] = 70;
// qwertyNotes[85] = 71;
// qwertyNotes[73] = 72; // = C5
// qwertyNotes[57] = 73;
// qwertyNotes[79] = 74;
// qwertyNotes[48] = 75;
// qwertyNotes[80] = 76;
// qwertyNotes[219] = 77; // = F5
// qwertyNotes[187] = 78;
// qwertyNotes[221] = 79;
// qwertyNotes[220] = 80;
window.qwertyNotes = qwertyNotes;

console.log(qwertyNotes);

function initializeAudio() {
	scriptProcessor = audioContext.createScriptProcessor(config.bufferSize, 0, 2);
	scriptProcessor.connect(audioContext.destination);
	scriptProcessor.connect(visualizer.getAudioNode());
	// Attach to window to avoid GC. http://sriku.org/blog/2013/01/30/taming-the-scriptprocessornode
	scriptProcessor.onaudioprocess = window.audioProcess = function (e) {
		var buffer = e.outputBuffer;
		var outputL = buffer.getChannelData(0);
		var outputR = buffer.getChannelData(1);

		var sampleTime = performance.now() - BUFFER_SIZE_MS;

		for (var i = 0, length = buffer.length; i < length; i++) {
			sampleTime += MS_PER_SAMPLE;
			if (synth.eventQueue.length && synth.eventQueue[0].receivedTime < sampleTime) {
				synth.processMidiEvent(synth.eventQueue.shift());
			}

			var output = synth.render();
			outputL[i] = output[0];
			outputR[i] = output[1];
		}
	};
}

// Polyphony counter
setInterval(function() {
	var count = 0;
	synth.voices.map(function(voice) { if (voice) count++; });
	// if (count) console.log("Current polyphony:", count);
}, 1000);

app.directive('toNumber', function() {
	return {
		require: 'ngModel',
		link: function (scope, elem, attrs, ctrl) {
			ctrl.$parsers.push(function (value) {
				return parseFloat(value || '');
			});
		}
	};
});

app.filter('reverse', function() {
	return function(items) {
		return items ? items.slice().reverse() : items;
	};
});

app.directive('toggleButton', function() {
	return {
		restrict: 'E',
		replace: true,
		transclude: true,
		require: 'ngModel',
		scope: {'ngModel': '='},
		template: '<button type="button" class="dx7-toggle ng-class:{\'dx7-toggle-on\':ngModel}" data-toggle="button" ng-click="ngModel = 1 - ngModel" ng-transclude></button>'
	};
});

app.directive('knob', function() {
	function link(scope, element, attrs) {
		var rotationRange = 300; // ±degrees
		var pixelRange = 200; // pixels between max and min
		var startY, startModel, down = false;
		var fgEl = element.find('div');
		var max = element.attr('max');
		var min = element.attr('min');
		var increment = (max - min) < 99 ? 1 : 2;
		element.on('mousedown', function(e) {
			startY = e.clientY;
			startModel = scope.ngModel || 0;
			down = true;
			e.preventDefault();
			e.stopPropagation();
			window.addEventListener('mousemove', onMove);
			window.addEventListener('mouseup', onUp);
			element[0].querySelector('.knob').focus();
			scope.$emit(PARAM_START_MANIPULATION, scope.ngModel);
		});

		element.on('touchstart', function(e) {
			if (e.touches.length > 1) {
				// Don't interfere with any multitouch gestures
				onUp(e);
				return;
			}

			startY = e.targetTouches[0].clientY;
			startModel = scope.ngModel || 0;
			down = true;
			e.preventDefault();
			e.stopPropagation();
			window.addEventListener('touchmove', onMove);
			window.addEventListener('touchend', onUp);
			element[0].querySelector('.knob').focus();
			scope.$emit(PARAM_START_MANIPULATION, scope.ngModel);
		});

		element.on('keydown', function(e) {
			var code = e.keyCode;
			if (code >= 37 && code <= 40) {
				e.preventDefault();
				e.stopPropagation();
				if (code == 38 || code == 39) {
					scope.ngModel = Math.min(scope.ngModel + 1, max);
				} else {
					scope.ngModel = Math.max(scope.ngModel - 1, min);
				}
				apply();
			}
		});

		element.on('wheel', function(e) {
			e.preventDefault();
			element[0].focus();
			if (e.deltaY > 0) {
				scope.ngModel = Math.max(scope.ngModel - increment, min);
			} else {
				scope.ngModel = Math.min(scope.ngModel + increment, max);
			}
			apply();
		});

		function onMove(e) {
			if (down) {
				var clientY = e.clientY;
				if (e.targetTouches && e.targetTouches[0])
					clientY = e.targetTouches[0].clientY;
				var dy = (startY - clientY) * (max - min) / pixelRange;
				// TODO: use 'step' attribute
				scope.ngModel = Math.round(Math.max(min, Math.min(max, dy + startModel)));
				apply();
			}
		}

		function onUp(e) {
			down = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			window.removeEventListener('touchmove', onMove);
			window.removeEventListener('touchend', onUp);
			scope.$emit(PARAM_STOP_MANIPULATION, scope.ngModel);
		}

		var apply = _.throttle(function () {
			scope.$emit(PARAM_CHANGE, scope.label + ": " + scope.ngModel);
			scope.$apply();
		}, 33);

		scope.getDegrees = function() {
			return (this.ngModel - min) / (max - min) * rotationRange - (rotationRange / 2) ;
		}
	}

	return {
		restrict: 'E',
		replace: true,
		require: 'ngModel',
		scope: {ngModel: '=', label: '@'},
		template: '<div><div class="param-label">{{ label }}</div><div class="knob" tabindex="0"><div class="knob-foreground" ng-style="{\'transform\': \'rotate(\' + getDegrees() + \'deg)\'}"></div></div></div>',
		link: link
	};
});

app.directive('slider', function() {
	function link(scope, element, attrs) {
		var sliderHandleHeight = 8;
		var sliderRailHeight = 50;
		var positionRange = sliderRailHeight - sliderHandleHeight;
		var pixelRange = 50;
		var startY, startModel, down = false;
		var max = element.attr('max');
		var min = element.attr('min');
		var increment = (max - min) < 99 ? 1 : 2;
		element.on('mousedown', function(e) {
			startY = e.clientY;
			startModel = scope.ngModel || 0;
			down = true;
			e.preventDefault();
			e.stopPropagation();
			window.addEventListener('mousemove', onMove);
			window.addEventListener('mouseup', onUp);
			element[0].querySelector('.slider').focus();
			scope.$emit(PARAM_START_MANIPULATION, scope.ngModel);
		});

		element.on('touchstart', function(e) {
			if (e.touches.length > 1) {
				// Don't interfere with any multitouch gestures
				onUp(e);
				return;
			}

			startY = e.targetTouches[0].clientY;
			startModel = scope.ngModel || 0;
			down = true;
			e.preventDefault();
			e.stopPropagation();
			window.addEventListener('touchmove', onMove);
			window.addEventListener('touchend', onUp);
			element[0].querySelector('.slider').focus();
			scope.$emit(PARAM_START_MANIPULATION, scope.ngModel);
		});

		element.on('keydown', function(e) {
			var code = e.keyCode;
			if (code >= 37 && code <= 40) {
				e.preventDefault();
				e.stopPropagation();
				if (code == 38 || code == 39) {
					scope.ngModel = Math.min(scope.ngModel + 1, max);
				} else {
					scope.ngModel = Math.max(scope.ngModel - 1, min);
				}
				apply();
			}
		});

		element.on('wheel', function(e) {
			e.preventDefault();
			element[0].querySelector('.slider').focus();
			if (e.deltaY > 0) {
				scope.ngModel = Math.max(scope.ngModel - increment, min);
			} else {
				scope.ngModel = Math.min(scope.ngModel + increment, max);
			}
			apply();
		});

		function onMove(e) {
			if (down) {
				var clientY = e.clientY;
				if (e.targetTouches && e.targetTouches[0])
					clientY = e.targetTouches[0].clientY;
				var dy = (startY - clientY) * (max - min) / pixelRange;
				scope.ngModel = Math.round(Math.max(min, Math.min(max, dy + startModel)));
				apply();
			}
		}

		function onUp(e) {
			down = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			window.removeEventListener('touchmove', onMove);
			window.removeEventListener('touchend', onUp);
			scope.$emit(PARAM_STOP_MANIPULATION, scope.ngModel);
		}

		var apply = _.throttle(function() {
			scope.$emit(PARAM_CHANGE, scope.label + ": " + scope.ngModel);
			scope.$apply();
		}, 33);

		scope.getTop = function() {
			return positionRange - ((this.ngModel - min) / (max - min) * positionRange);
		}
	}

	return {
		restrict: 'E',
		replace: true,
		require: 'ngModel',
		scope: {ngModel: '=', label: '@'},
		template: '<div><div class="slider" tabindex="0"><div class="slider-foreground" ng-style="{\'top\': getTop() + \'px\'}"></div></div><div class="slider-meter"></div></div>',
		link: link
	};
});


app.controller('MidiCtrl', ['$scope', '$http', function($scope, $http) {
	// MIDI stuff
	var self = this;
	this.midiFileIndex = 0;
	this.midiFiles = [
		"midi/rachmaninoff-op39-no6.mid",
		"midi/minute_waltz.mid",
		"midi/bluebossa.mid",
		"midi/cantaloup.mid",
		"midi/chameleon.mid",
		"midi/tunisia.mid",
		"midi/sowhat.mid",
		"midi/got-a-match.mid"
	];
	this.midiPlayer = new MIDIPlayer({
		output: {
			// Loopback MIDI to input handler.
			send: function(data, timestamp) {
				//console.log("MIDI File Event:", data, timestamp);
				midi.send({ data: data, receivedTime: timestamp });
			}
		}
	});

	this.onMidiPlay = function() {
		$http.get(this.midiFiles[this.midiFileIndex], {responseType: "arraybuffer"})
			.success(function(data) {
				console.log("Loaded %d bytes.", data.byteLength);
				var midiFile = new MIDIFile(data);
				self.midiPlayer.load(midiFile);
				self.midiPlayer.play(function() { console.log("MIDI file playback ended."); });
			});
	};

	this.onMidiStop = function() {
		this.midiPlayer.stop();
		synth.panic();
	};

	var mml = null;
	this.vizMode = 0;
	var mmlDemos = [ "t92 l8 o4 $" +
		"[>cg<cea]2.        [>cg<ceg]4" +
		"[>>a<a<c+fa+]2.    [>>a <a <c+ e a]4" +
		"[>>f <f g+ <c g]2. [>>f <f g+ <c f]4" +
		"[>>g <g g+ b <g+]2.[>>g <g <g]4;" +
		"t92 $ l1 o3 v12 r r r r2 r8 l32 v6 cdef v8 ga v10 b<c v12 de v14 fg;",
		"t120$ l8 o3    >g+2.. g+ a+4. a+ <c2 >a+    g+2.. a+4 a+4 <c4. >d+" +
			"              a+ g+2. g+ a+4. a+ <c2 >a+   g+2.. a+4 a+4 <c2.;" +
			"t120$l8 o4    rr g g4 g+ a+4 d4 d4 d+2     d c g g4 g+ a+4 d4 d4 d+2" +
			"              rr g g4 g+ a+4 d4 d4 d+2     d c g g4 g+ a+4 d4 d4 d+2.;" +
			"t120$l8 o4 v9 rr d+ d+2 r >a+4 a+4 <c2     >a+ g+ <d+ d+2 r >a+4 a+4 a+2" +
			"              rr d+ d+2 r >a+4 a+4 <c2     >a+ g+ <d+ d+2 r >a+4 a+4 a+2.;" +
			"t120$l8 o4 v8 rr c c2 r   >f4 f4 g2        a+ g+ <c c2 >f f4 r f g2<" +
			"              rr c c2 r   >f4 f4 g2        a+ g+ <c c2 >f f4 r f g2.<;"
	];



	this.createMML = function (idx) {
		var mml = new MMLEmitter(audioContext, mmlDemos[idx]);
		var noteHandler = function(e) {
			synth.noteOn(e.midi, e.volume / 20);
			e.noteOff(function() {
				synth.noteOff(e.midi);
			});
		};
		mml.tracks.map(function(track) { track.on('note', noteHandler); });
		return mml;
	};

	this.onDemoClick = function(idx) {
		if (mml && mml._ended == 0) {
			mml.stop();
			synth.panic();
			mml = null;
		} else {
			mml = this.createMML(idx);
			mml.start();
		}
	};

	this.onVizClick = function() {
		this.vizMode = (this.vizMode + 1) % 3;
		switch (this.vizMode) {
			case VIZ_MODE_NONE:
				visualizer.disable();
				break;
			case VIZ_MODE_FFT:
				visualizer.enable();
				visualizer.setModeFFT();
				break;
			case VIZ_MODE_WAVE:
				visualizer.enable();
				visualizer.setModeWave();
				break;
		}
	};

	this.onKeyDown = function(ev) {
		// console.log("onKeyDown1");
		var note = qwertyNotes[String.fromCharCode(ev.keyCode)] + noteOffset;

		console.log("key code: " + ev.keyCode + ", char: " + String.fromCharCode(ev.keyCode) + ", note: " + note)

		if (ev.metaKey) return false;
		if (ev.keyCode == 32) {
			synth.panic();
			ev.stopPropagation();
			ev.preventDefault();
			return false;
		}
		if (note) {
			if (!ev.repeat) {
				synth.noteOn(note, 0.8 + (ev.ctrlKey ? 0.47 : 0));
			}
			// ev.stopPropagation();
			// ev.preventDefault();
		}
		return false;
	};

	this.onKeyUp = function(ev) {
		var note = qwertyNotes[String.fromCharCode(ev.keyCode)] + noteOffset;
		if (note)
			synth.noteOff(note);
		return false;
	};

	window.addEventListener('keydown', this.onKeyDown, false);
	window.addEventListener('keyup', this.onKeyUp, false);


}]);

app.controller('OperatorCtrl', function($scope) {
	$scope.$watchGroup(['operator.oscMode', 'operator.freqCoarse', 'operator.freqFine', 'operator.detune'], function() {
		FMVoice.updateFrequency($scope.operator.idx);
		$scope.freqDisplay = $scope.operator.oscMode === 0 ?
			parseFloat($scope.operator.freqRatio).toFixed(2).toString() :
			$scope.operator.freqFixed.toString().substr(0,4).replace(/\.$/,'');
	});
	$scope.$watch('operator.volume', function() {
		FMVoice.setOutputLevel($scope.operator.idx, $scope.operator.volume);
	});
	$scope.$watch('operator.pan', function() {
		FMVoice.setPan($scope.operator.idx, $scope.operator.pan);
	});
});


app.controller('PresetCtrl', ['$scope', '$localStorage', '$http', function ($scope, $localStorage, $http) {
	var self = this;

	this.lfoWaveformOptions = [ 'Triangle', 'Saw Down', 'Saw Up', 'Square', 'Sine', 'Sample & Hold' ];
	this.presets = defaultPresets;
	this.selectedIndex = 0;
	this.paramDisplayText = DEFAULT_PARAM_TEXT;

	var paramManipulating = false;
	var paramDisplayTimer = null;

	function flashParam(value) {
		self.paramDisplayText = value;
		clearTimeout(paramDisplayTimer);
		if (!paramManipulating) {
			paramDisplayTimer = setTimeout(function() {
				self.paramDisplayText = DEFAULT_PARAM_TEXT;
				$scope.$apply();
			}, 1500);
		}
	}

	$scope.$on(PARAM_START_MANIPULATION, function(e, value) {
		paramManipulating = true;
		flashParam(value);
	});

	$scope.$on(PARAM_STOP_MANIPULATION, function(e, value) {
		paramManipulating = false;
		flashParam(value);
	});

	$scope.$on(PARAM_CHANGE, function(e, value) {
		flashParam(value);
	});

	$http.get('roms/ROM1A.SYX')
		.success(function(data) {
			self.basePresets = SysexDX7.loadBank(data);
			self.$storage = $localStorage;
			self.presets = [];
			for (var i = 0; i < self.basePresets.length; i++) {
				if (self.$storage[i]) {
					self.presets[i] = Angular.copy(self.$storage[i]);
				} else {
					self.presets[i] = Angular.copy(self.basePresets[i]);
				}
			}
			self.selectedIndex = 10; // Select E.PIANO 1
			self.onChange();
		});

	this.onChange = function() {
		this.params = this.presets[this.selectedIndex];
		FMVoice.setParams(this.params);
		// TODO: separate UI parameters from internal synth parameters
		// TODO: better initialization of computed parameters
		for (var i = 0; i < this.params.operators.length; i++) {
			var op = this.params.operators[i];
			FMVoice.setOutputLevel(i, op.volume);
			FMVoice.updateFrequency(i);
			FMVoice.setPan(i, op.pan);
		}
		FMVoice.setFeedback(this.params.feedback);
	};

	this.save = function() {
		this.$storage[this.selectedIndex] = Angular.copy(this.presets[this.selectedIndex]);
		console.log("Saved preset %s.", this.presets[this.selectedIndex].name);
	};

	this.reset = function() {
		if (confirm('Are you sure you want to reset this patch?')) {
			delete this.$storage[this.selectedIndex];
			console.log("Reset preset %s.", this.presets[this.selectedIndex].name);
			this.presets[this.selectedIndex] = Angular.copy(self.basePresets[this.selectedIndex]);
			this.onChange();
		}
	};

	$scope.$watch('presetCtrl.params.feedback', function(newValue) {
		if (newValue !== undefined) {
			FMVoice.setFeedback(self.params.feedback);
		}
	});

	$scope.$watchGroup([
		'presetCtrl.params.lfoSpeed',
		'presetCtrl.params.lfoDelay',
		'presetCtrl.params.lfoAmpModDepth',
		'presetCtrl.params.lfoPitchModDepth',
		'presetCtrl.params.lfoPitchModSens',
		'presetCtrl.params.lfoWaveform'
	], function() {
		FMVoice.updateLFO();
	});

	self.onChange();

  // Dirty iOS audio workaround. Sound can only be enabled in a touch handler.
	if (/iPad|iPhone|iPod/.test(navigator.platform)) {
		window.addEventListener("touchend", iOSUnlockSound, false);
		function iOSUnlockSound() {
			window.removeEventListener("touchend", iOSUnlockSound, false);
			var buffer = audioContext.createBuffer(1, 1, 22050);
			var source = audioContext.createBufferSource();
			source.buffer = buffer;
			source.connect(audioContext.destination);
			if(source.play){ source.play(0); } else if(source.noteOn){ source.noteOn(0); }
			flashParam("Starting audio...");
			initializeAudio();
		}
	} else {
		initializeAudio();
	}

}]);


app.directive('draw', function () {
    return {
        restrict: 'AEC',
        link: function postLink(scope, element, attrs) {


			// Accepts a MouseEvent as input and returns the x and y
		    // coordinates relative to the target element.
		    var getCrossBrowserElementCoords = function (mouseEvent)
		    {
		      var result = {
		        x: 0,
		        y: 0
		      };

		      if (!mouseEvent)
		      {
		        mouseEvent = window.event;
		      }

		      if (mouseEvent.pageX || mouseEvent.pageY)
		      {
		        result.x = mouseEvent.pageX;
		        result.y = mouseEvent.pageY;
		      }
		      else if (mouseEvent.clientX || mouseEvent.clientY)
		      {
		        result.x = mouseEvent.clientX + document.body.scrollLeft +
		          document.documentElement.scrollLeft;
		        result.y = mouseEvent.clientY + document.body.scrollTop +
		          document.documentElement.scrollTop;
		      }

		      if (mouseEvent.target)
		      {
		        var offEl = mouseEvent.target;
		        var offX = 0;
		        var offY = 0;

		        if (typeof(offEl.offsetParent) != "undefined")
		        {
		          while (offEl)
		          {
		            offX += offEl.offsetLeft;
		            offY += offEl.offsetTop;

		            offEl = offEl.offsetParent;
		          }
		        }
		        else
		        {
		          offX = offEl.x;
		          offY = offEl.y;
		        }

		        result.x -= offX;
		        result.y -= offY;
		      }

		      result.x /= window.devicePixelRatio;
		      result.y /= window.devicePixelRatio;

		      return result;
		    };


		    // ---------------------------- //
		    // --- Musical game of life --- //
			// ---------------------------- //

            var path;
            var drag = false;
			
			var drawDelay = 8;
            
			var canvas = document.getElementById('canvas');
			// var header = document.getElementById('dx7-top-panel');

            var canvasWidth = document.getElementById("dx7-container").clientWidth / window.devicePixelRatio;
            var canvasHeight = canvasWidth * 0.6;
			
			canvas.width = canvasWidth;
			canvas.height = canvasHeight;

            var gridWidth = 2*4;
            var gridHeight = 2*12;
            
            var cellWidth = canvasWidth / gridWidth;
            var cellHeight = canvasHeight / gridHeight;

			var paused = false;

            var grid = [];

            // initialize a 2D array of cells
			var cells = [];
			for (var x = 0; x < gridWidth; x += 1) {
			    cells[x] = [];
			    for (var y = 0; y < gridHeight; y += 1) {
			        cells[x][y] = 0;
			    }
			}
			// initialize a 2D array of cells for the next generation
			var nextGen = [];
			for (var x = 0; x < gridWidth; x += 1) {
			    nextGen[x] = [];
			    for (var y = 0; y < gridHeight; y += 1) {
			        nextGen[x][y] = 0;
			    }
			}

			var noteBuffer = new Map()
			
			// cells[0][10] = 1;
			// cells[0][9] = 1;
			// cells[0][8] = 1;
			// cells[0][4] = 1;
			// cells[0][3] = 1;
			// cells[0][7] = 1;

			function livesOn(x, y)
			{
			    // first count the number of live neighbors
			    var numNeighbors = 0;
			    for (var i = -1; i <= 1; i +=1 ) {
			        for (var j = -1; j <= 1; j += 1) {
			            var neighborX = (x + i + gridWidth) % gridWidth;
			            var neighborY = (y + j + gridHeight) % gridHeight;
			            
			            if (neighborX !== x || neighborY !== y) {
			                if (cells[neighborX][neighborY] === 1) {
			                    numNeighbors += 1;
			                }
			            }
			            
			        }
			    }
			    // if the cell is living and has 2 or 3 live neighbors...
			    if (cells[x][y] === 1 &&
			            (numNeighbors === 2 || numNeighbors === 3)) {
			        return true;
			    }
			    // if the cell is dead and has exactly 3 neighbors...
			    if (cells[x][y] === 0 && numNeighbors === 3) {
			        return true;
			    }
			    // otherwise it's either overpopulated or underpopulated
			    // and the cell is dead
			    return false;
			};

			function nextGeneration()
			{
				// console.log("next gen");
			    for (var x = 0; x < gridWidth; x += 1) {
			        for (var y = 0; y < gridHeight; y += 1) {
			        	
			        	// Update cells: rectangle grid
			            if (cells[x][y] === 1) {
				            grid[x][y].fillColor = { hue: 35, saturation: 0.8, brightness: 0.9 };
			            } else {
							grid[x][y].fillColor = "#4a4950";
			            }

			            // Update Synth
			        	if(x == 0)
			        	{
							let note = y + noteOffset;
				            let nb = noteBuffer.get(note) || 0;

				            // set color and draw
				            if (cells[x][y] === 1) {
				            	console.log("note buffer: " + nb + ", note: " + note);
				            	if (nb < 3) {
				            		synth.noteOn(note, 0.8);
				            		noteBuffer.set(note, 3);
				            		console.log("note buffer: " + noteBuffer.get(note) + ", note: " + note);
				            	}

				            } else {
				                
				                if(nb > 0) {
				                	noteBuffer.set(note, nb-1);
				                } else if (nb == 0) {
				                	synth.noteOff(note, 0.8);
				                	noteBuffer.set(note, nb-1);
				                }

				            }
			        	}

			        	// Set next gen to the left cell: time propagation
			        	nextGen[x][y] = cells[(x - 1 + gridWidth) % gridWidth][y];

			            // build next generation array
			            if(x === 0) {
			                if (livesOn(x,y)) {
			                    nextGen[x][y] = 1;
			                }
			                else {
			                    nextGen[x][y] = 0;
			                }
			            }
			            
			        }
			    }
			    // copy next generation into current generation array
			    for (var i = 0; i < gridWidth; i += 1) {
			        for (var j = 0; j < gridHeight; j += 1) {
			            cells[i][j] = nextGen[i][j];
			        }
			    }
			};


            function mouseUp(event) {
                //Clear Mouse Drag Flag
                drag = false;
            }

            function mouseDrag(event) {
                if (drag) {
					var point = new paper.Point(getCrossBrowserElementCoords(event));

				    var x = Math.floor(point.x / cellWidth);
				    var y = Math.floor(point.y / cellHeight);
			    	
			    	cells[x][y] = 1;
			    	grid[x][y].fillColor = { hue: 35, saturation: 0.8, brightness: 0.9 };
                }
            	paper.view.update();
            }

            function mouseDown(event) {
                //Set  flag to detect mouse drag
				var point = new paper.Point(getCrossBrowserElementCoords(event));

			    var x = Math.floor(point.x / cellWidth);
			    var y = Math.floor(point.y / cellHeight);
			    
			    console.log("down at x: " + x + ", " + y + ", point: " + point.toString());

			    cells[x][y] = 1;
			    grid[x][y].fillColor = { hue: 35, saturation: 0.8, brightness: 0.9 };

                drag = true;
            	paper.view.update();
            }
			
			var t = 0;
			function onFrame() {

			    // to keep the animation from going too fast, only
			    // draw after the specified delay
			    if (t === drawDelay) {
			        nextGeneration();
			        t = 0;
			    }
			    // only increment t if we are not paused
			    if (!paused) {
			        t += 1;
			    }

            	paper.view.update();

				requestAnimationFrame(onFrame);
            }

            function initPaper() {


				paper.setup('canvas');

	            for(let x=0 ; x<gridWidth ; x++) {
	            	var column = [];
	            	for(let y=0 ; y<gridHeight ; y++) {
	            		var cell = new paper.Path.Rectangle(x*cellWidth, y*cellHeight, cellWidth, cellHeight);
	            		cell.fillColor = 'gray';
	            		cell.strokeColor = "#33333";
	            		column.push(cell);
	            	}
	            	grid.push(column);
	            }

	            element.on('mousedown', mouseDown).on('mouseup', mouseUp).on('mousemove', mouseDrag);

    			requestAnimationFrame(onFrame);

            }

            initPaper();

            var playNote = function(note) {


				if (note) {
					cellY = Math.abs(note - 1)

			    	cells[0][ cellY % gridHeight ] = 1;
			    	grid[0][cellY % gridHeight].fillColor = { hue: 35, saturation: 0.8, brightness: 0.9 };

					// ev.stopPropagation();
					// ev.preventDefault();
				}
            };

			var onKeyDown = function(ev) {
				// console.log("onKeyDown2");
				var note = qwertyNotes[String.fromCharCode(ev.keyCode)]+1;
				// console.log("ev.keyCode= " + ev.keyCode);
				// console.log("note= " + note);

				if (ev.keyCode == 32) {
					// When space key: erase everything
							
					for (var x = 0; x < gridWidth; x += 1) {
					    for (var y = 0; y < gridHeight; y += 1) {
					        cells[x][y] = 0;
					        nextGen[x][y] = 0;
					        grid[x][y].fillColor = "#4a4950";
					    }
					}
					ev.stopPropagation();
					ev.preventDefault();
					return false;
				}
				playNote(note);
				// return false;
			};

			var onMidiKeyDown = function(ev) {
				console.log("onMidiKeyDown: ");
				console.log(ev);
				console.log(ev.noteNumber);
				console.log(ev.noteNumber-noteOffset);
				playNote(ev.noteNumber-noteOffset);
			};

			window.addEventListener('keydown', onKeyDown, false);
			window.addEventListener('GLmidiKeyDown', onMidiKeyDown, false);

        }
    };
});