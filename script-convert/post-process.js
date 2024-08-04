
import { getFlowchart, TreeNode } from "./flowchart.js"
import { LOGIC_FILE } from "./script-convert.js"

const TEXT_LINE_REGEXP = /^[^a-z;*!#@~\\]/
const isTextLine = TEXT_LINE_REGEXP.test.bind(TEXT_LINE_REGEXP)

const colorImages = new Map(Object.entries({
	'"image\\bg\\ima_10.jpg"' : '#000000',
	'"image\\bg\\ima_11.jpg"' : '#ffffff',
	'"image\\bg\\ima_11b.jpg"': '#9c0120'
}))

class Context {

	constructor() {
		/** @type {Map<string, string|null>}*/
		this.properties = new Map(Object.entries({
			bg: null, l: null, c: null, r: null,
			track: null, waveloop: null,
			monocro: null
		}));
	}
	get bg() { return this.properties.get('bg'); }
	set bg(val) { this.properties.set('bg', val); }
	get l() { return this.properties.get('l'); }
	set l(val) { this.properties.set('l', val); }
	get c() { return this.properties.get('c'); }
	set c(val) { this.properties.set('c', val); }
	get r() { return this.properties.get('r'); }
	set r(val) { this.properties.set('r', val); }

	get track() { return this.properties.get('track'); }
	set track(val) { return this.properties.set('track', val); }
	
	get waveloop() { return this.properties.get('waveloop'); }
	set waveloop(val) { return this.properties.set('waveloop', val); }

	get monocro() { return this.properties.get('monocro'); }
	set monocro(val) { return this.properties.set('monocro', val); }

	set(key, value) {
		if (!this.properties.has(key))
			throw new Error(`unknown property key ${key}`)
		this.properties.set(key, value)
	}
	get(key) {
		if (!this.properties.has(key))
			throw new Error(`unknown property key ${key}`)
		return this.properties.get(key)
	}

	isNull() {
		for (let value of this.properties.values()) {
			if (value != null)
				return false;
		}
		return true;
	}
	isFull() {
		for (let value of this.properties.values()) {
			if (value == null)
				return false;
		}
		return true;
	}

	equals(context) {
		for (let [key, value] of this.properties.entries()) {
			if (value != context.properties.get(key))
				return false;
		}
		return true;
	}
	
	clone() {
		const ctx = new Context();
		for (let [key, value] of this.properties.entries()) {
			ctx.properties.set(key, value)
		}
		return ctx;
	}
	/**
	 * @param {Context} ctx 
	 */
	include(ctx) {
		for (let [key, value] of this.properties.entries()) {
			if (value == null)
				this.properties.set(key, ctx.properties.get(key))
		}
		return this;
	}
	/**
	 * @param {Context} ctx 
	 */
	exclude(ctx) {
		for (let [key, value] of ctx.properties.entries()) {
			if (value != null)
				this.properties.set(key, null)
		}
		return this;
	}

	fill() {
		for (let [key, value] of this.properties.entries()) {
			if (value == null)
				this.properties.set(key, '')
		}
		return this;
	}

	/**
	 * @param {string} cmd 
	 * @param {string} arg
	 * @returns {boolean} `false` if command contains a delay, `true` otherwise
	 */
	readCmd(cmd, arg) {
		switch (cmd) {
			case 'bg' : {
				const [ bg, effect ] = arg.split(',');
				this.bg = bg;
				this.l = this.c = this.r = '';
				return effect.includes("nowaitdisp");
			}
			case 'ld' : {
				const [pos, img, effect] = arg.split(',');
				this.set(pos, img);
				return effect.includes('nowaitdisp');
			}
			case 'cl' : {
				let [pos, effect] = arg.split(',');
				if (pos == 'a')
					this.l = this.c = this.r = '';
				else
					this.set(pos, ''); 
				return effect.includes('nowaitdisp');
			}
			case 'play' : this.track = arg; return true;
			case 'playstop' : this.track = ''; return true;
			case 'waveloop' : this.waveloop = arg; return true;
			case 'wave' :
			case 'wavestop' : this.waveloop = ''; return true;
			case 'monocro' : this.monocro = arg == 'off' ? '' : arg; return true;
			case 'gosub' :
				this.bg = this.l = this.c = this.r = '';
				this.track = '';
				this.waveloop = '';
				this.monocro = '';
				return false;
			case 'delay' :
			case 'waittimer':
			case '!w' :
			case '!d' : return false;
		}
		return true;
	}

	toJSON() {
		const nonNullProps = [...this.properties.entries()].filter(([_k, v])=> (v != null))
		return Object.fromEntries(nonNullProps);
	}
}

function getCmdArg(line) {
	if (isTextLine(line))
		return [null, null]
	let indexSep = line.indexOf(' ');
	let indexTab = line.indexOf('\t');
	if (indexSep == -1 || (indexTab >= 0 && indexTab < indexSep))
		indexSep = indexTab;
	let cmd, arg;
	if (indexSep >= 0) {
		cmd = line.substring(0, indexSep);
		arg = line.substring(indexSep+1);
	} else if (line.startsWith('!')) {
		cmd = line.substring(0, 2);
		arg = line.substring(2)
	} else {
		cmd = line;
		arg = null;
	}
	return [cmd, arg]
}


//#endregion ###################################################################
//#region                          General fixes
//##############################################################################

function processTextLine(line) {
	if (!line.startsWith('`'))
		line = '`' + line;
	const result = []
	do {
		let index = line.search(/\\(?!$)/); // '\' before end of line
		if (index == -1) {
			result.push(line);
			break;
		} else {
			result.push(line.substring(0, index+1));
			line = line.substring(index+1);
			if (!line.startsWith(' '))
				line = ' '+line
			line = '`'+line;
		}
	} while (line.length > 0);
	return result;
}

function replaceColorImages(str) {
	for (let [file, color] of colorImages.entries()) {
		if (str.includes(file)) {
			return str.replace(file, color)
		}
	}
	return str;
}

// transform mp3loop m9 into play "*9"
function processMp3Loop(i, arg) {
	let m;
	if (m = arg.match(/m(?<n>\d+)/))
		return processLine(i, `play "*${m.groups['n']}"`);
	else if (arg.match(/se\d+/))
		return processLine(i, `waveloop ${arg}`);
	else if (m = arg.match(/"bgm\\(?<n>\d+).wav"/))
		return processLine(i, `play "*${Number.parseInt(m.groups['n'], 10)}"`);
	else
		throw Error(`Unexpected mp3loop argument: ${arg}`);
}


function processIf(i, arg) {
	let index = arg.search(/ [a-z]/);
	if (index == -1)
	  throw Error(`no separation between condition and command: "if ${arg}"`);
	const condition = arg.substring(0, index);
	const instructions = arg.substring(index+1)
			.split(':')
			.map(instr=> processLine(i, instr))
			.join(':');
	return `if ${condition} ${instructions}`;
}
function processSelect(line) {
	if (!line.includes('`'))
		return line.replace(/"/g, '`')
	else
		return line;
}

function processLine(i, line, lines = null) {
	if (isTextLine(line))
		return processTextLine(line);
	if (line.length == 0 || line.startsWith(';'))
		return null;
	if (line.startsWith('*'))
		return line;
	if (line.startsWith('#'))
		line = `textcolor ${line}`;

	while (line.endsWith(',') && lines) {
		line = line + lines.splice(i+1, 1)
	}
	line = line.trim();
	const [cmd, arg] = getCmdArg(line);
	//TODO split instructions with ':', except inside 'if'
	/*
	const colonRegexp = /^\s?\w([^"`:]*"[^"`]*")*[^"`:]*:/
	if (match = line.match(colonRegexp)) {
		const index = match[0].length-1;
		result.push(line.substring(0, index).trimEnd());
		line = line.substring(index+1).trimStart();
	} 
	*/
	switch(cmd) {
		// text
		case '\\' 	: return line;
		case '@' 	: return line;
		case 'br' 	: return line;
		case 'textcolor' : return line;

		// audio
		case 'mp3loop' 	: return processMp3Loop(i, arg);
		case 'stop'		: return "playstop";
		case 'play' 	: return line;
		case 'playstop' : return line;
		case 'wave' 	: return line;
		case 'waveloop' : return line;
		case 'wavestop' : return line;

		// graphics
		case 'ld' : return line;
		case 'cl' : return line;
		case 'bg' : return replaceColorImages(line);
		case 'monocro'	: return line;
		case 'quakex'	: return line;
		case 'quakey'	: return line;

		// timer
		case 'resettimer': return line; // keep for now, check in +Disc and KT if necessary
		case 'waittimer' : return line;
		case '!w' : return line;
		case '!d' : return line;

		// variables
		case 'mov'	: return replaceColorImages(line);
		case 'dec'	: return line;
		case 'inc'	: return line;
		case 'add'	: return line;
		case 'sub'	: return line;

		// script jumps
		case 'gosub' 	: return line;
		case 'goto'  	: return line;
		case 'if' 		: return processIf(i, arg);
		case 'skip'		: return `skipTo(${i+Number.parseInt(arg)})`; // replaced in second loop
		case 'select' 	: return processSelect(line);
		// ignored
		case 'selgosub'		: return null;
		case '!s'			: return null;
		case 'return'		: return null;
		case '+' 			: return null;
		case 'setwindow'	: return null;
		case 'windoweffect' : return null;
		case 'setcursor'	: return null;
		case 'autoclick'	: return null;
		default :
			throw Error(`Unknown command line ${i}: ${line}`)
	}
}

const skipToRegexp = /skipTo\((?<p>\d+)\)/

function sanitizeLines(lines) {
	const result = []
	const newIndices = new Array(lines.length);
	for (let i = 0; i < lines.length; i++) {
		newIndices[i] = result.length;
		const processed = processLine(i, lines[i], lines)
		if (processed == null)
			continue;
		if (processed.constructor == String)
			result.push(processed)
		else
			result.push(...processed);
	}
	// second loop to update skip delta
	for (let i = 0; i < result.length; i++) {
		const line = result[i];
		let m = skipToRegexp.exec(line)
		if (m) {
			let target = Number.parseInt(m.groups["p"]);
			target = newIndices[target];
			result[i] = line.substring(0, m.index) + 
				   `skip ${target - i}` +
				   line.substring(m.index + m[0].length)
		}
	}
	lines.splice(0, lines.length, ...result);
}

//#endregion ###################################################################
//#region                         Specific fixes
//##############################################################################

/**
 * Center all lines that do not start with '---', except the last one
 * @param {Array<string>} lines 
 */
function centerOpenning(lines) {
	let textLines = Array.from(Array.from(lines.entries()).filter(([_i, line])=> {
		if(!isTextLine(line))
			return false; // include only text lines
		if (line.startsWith('`'))
			line = line.substring(1);
		line = line.trimStart();
		if (['-', '─'].includes(line.charAt(0)))
			return false; //lines that start with '---' stay left-aligned
		return true;
	}));

	// add [center] on remaining text lines
	for (let [i, line] of textLines) {
		let prefix = line.startsWith('`') ? '`' : '';
		if (prefix == '`')
			line = line.substring(1);
		line = line.trimStart();
		lines[i] = `${prefix}[center]${line}`;
	}
}

function applyContext(context, lines) {
	// lines.unshift(';---added context above---')
	if (context.l ) lines.unshift(`ld l,${context.l},%type_nowaitdisp`);
	if (context.c ) lines.unshift(`ld c,${context.l},%type_nowaitdisp`);
	if (context.r ) lines.unshift(`ld r,${context.l},%type_nowaitdisp`);
	if (context.bg) lines.unshift(`bg ${context.bg },%type_nowaitdisp`);
	if (context.track != null)
		lines.unshift(context.track == '' ? "playstop" : `play ${context.track}`)
	if (context.waveloop != null)
		lines.unshift(context.waveloop == '' ? 'wavestop' : `waveloop ${context.waveloop}`)
	if (context.monocro != null)
		lines.unshift(`monocro ${context.monocro || 'off'}`)
}
/**
 * @type {Object.<string, function(string, Array<string>)>}
 */
const specificFixes = {
	'openning': (_label, lines) => {
		centerOpenning(lines);
	},
	's46' : (_label, lines) => {
		const i = lines.findIndex((line) => line.startsWith('bg'));
		lines.splice(i+1, 0, 'waveloop se10');
	},
	's121' : (_label, lines) => {
		const i = lines.indexOf('if %flgE>=1 skip 5')
		lines[i] = 'if %flgE>=1 skip 6'; // otherwise first skip lands on second one
	},
	's228' : (_label, lines) => {
		const i = lines.findLastIndex((line) => line.startsWith('bg'));
		lines.splice(i+1, 0, "playstop");
	},
	's333' : (_label, lines) => {
		const i = lines.findLastIndex((line) => line.startsWith("!w"));
		lines.splice(i+1, 0, "playstop");
	},
	's140' : (_label, lines) => {
		let i = lines.findLastIndex((line) => line.startsWith("cl c"));
		i += lines.slice(i).findIndex((line) => line == "\\");
		lines.splice(i+1, 0, "playstop");
	},
	's178' : (_label, lines) => {
		lines.splice(0, 0, 'play "*1"');
	},
}

//#endregion ###################################################################
//#region                         Context check
//##############################################################################

function extractContexts(lines) {
	const ctx = new Context();
	let startContext = null;

	for (const line of lines) {
		const [cmd, arg] = getCmdArg(line);
		if (startContext == null) {
			if (cmd == null || !ctx.readCmd(cmd, arg)) {
				startContext = ctx.clone()
			}
		} else if (cmd != null) {
			ctx.readCmd(cmd, arg);
		}
	}
	return {
		start: startContext ?? ctx,
		end: ctx
	};
}

function getEndContext(label, tree, end_contexts, start_contexts, report) {
	let end_context = end_contexts.get(label);
	if (!end_context.isFull())
		end_context.include(getStartContext(label, tree, end_contexts, start_contexts, report))
	return end_context;
}

function getStartContext(label, tree, end_contexts, start_contexts, report) {
	let start_context = start_contexts.get(label)
	if (start_context.isFull()) {
		return start_context;
	}
	const parent_scenes = tree.get(label)?.parent_nodes.map(node => node.scene) ?? []
	if (parent_scenes.length == 0) {
		start_context = start_context.clone().fill();
	} else {
		const parent_contexts = parent_scenes.map(scene => start_context.clone().include(
			getEndContext(scene, tree, end_contexts, start_contexts, report)
		))
		let context = parent_contexts[0]
		for (let ctx of parent_contexts.slice(1)) {
			if (!ctx.equals(context)) {
				report.conflicts.scenes[label] = [...parent_contexts]
				break
			}
		}
		start_context = context
	}
	let end_context = end_contexts.get(label);
	if (!end_context.isFull())
		end_context.include(start_context);
	return start_context;
}

//#endregion ###################################################################
//#region                              Main
//##############################################################################

/**
 * 
 * @param {Map<string, {file: string, lines: Array<string>}} scenes
 * @param {Array<string>} lines 
 * @param {Object} report
 */
function postProcess(scenes, report) {

	/** @type {Map<string, {graphics: {bg: boolean, l:boolean, c:boolean, r:boolean}, track: boolean, waveloop: boolean, monocro: boolean}>} */
	const startContexts = new Map()
	/** @type {Map<string, {graphics: {bg: string, l:string, c:string, r:string}, track: string, waveloop: string, monocro: string}>} */
	const endContexts = new Map()

	for (const [label, {file, lines}] of scenes.entries()) {
		sanitizeLines(lines)
		if (specificFixes.hasOwnProperty(label)) {
			specificFixes[label](label, lines)
		}
		if (file != LOGIC_FILE) {
			const {start, end} = extractContexts(lines)
			startContexts.set(label, start)
			endContexts.set(label, end)
		}
	}
	const tree = getFlowchart(scenes, {'openning': {before: ['f20']}, 'eclipse': {}})

	report.conflicts = {
		info: "Conflicts when deducing start contexts",
		scenes: {}
	}
	report.appliedContexts = {
		info: "contexts applied to scenes",
		scenes: {}
	}
	for (const label of tree.keys()) {
		const startContext = startContexts.get(label);
		if (!startContext.isFull()) {
			const diff = getStartContext(label, tree, endContexts, startContexts, report).clone();
			diff.exclude(startContext);
			applyContext(diff, scenes.get(label).lines)
			report.appliedContexts.scenes[label] = diff.toJSON();
		}
	}
}

//#endregion

export {
	postProcess 
}