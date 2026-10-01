// Helpers to build RossTalk command strings. Commands are case sensitive and sent one per line.

// A command is a single line: line breaks would let a variable smuggle in extra commands.
function clean(value) {
	return String(value ?? '')
		.replace(/[\r\n]+/g, ' ')
		.trim()
}

function pad(number, width) {
	return String(number).padStart(width, '0')
}

function int(value, min, max) {
	const text = clean(value)
	if (!/^\d+$/.test(text)) return undefined
	const number = parseInt(text, 10)
	return number >= min && number <= max ? number : undefined
}

// ME, AUX:2, ME:1:KEY:2:V ...
function isToken(value) {
	return /^[A-Z]+(:[A-Z0-9]+)*$/.test(value)
}

module.exports = { clean, pad, int, isToken }
