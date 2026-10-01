const { RESOURCES, ME_CHOICES, getSources, getBuses, range } = require('./model')
const { clean, pad, int, isToken } = require('./rosstalk')

const TOKEN_REGEX = '/^[A-Z]+(:[A-Z0-9]+)*$/'

module.exports = function (self) {
	const sources = getSources(self.config.model)
	const sourceChoices = sources.map((source) => ({ id: source.id, label: source.label }))
	const destChoices = getBuses()
		.filter((bus) => bus.dest)
		.map((bus) => ({ id: bus.dest, label: bus.label }))
	const mnemChoices = sources.filter((source) => source.tally).map((source) => ({ id: source.id, label: source.label }))
	const meMemChoices = ME_CHOICES.filter((me) => !me.id.startsWith('MSC'))

	const sendCommand = (cmd) => self.sendCommand(cmd)

	const text = async (context, value) => clean(await context.parseVariablesInString(String(value ?? '')))

	const number = async (context, value, min, max, what) => {
		const result = int(await text(context, value), min, max)
		if (result === undefined) self.log('warn', `${what} must be a number between ${min} and ${max}`)
		return result
	}

	const token = async (context, value, what) => {
		const result = await text(context, value)
		if (isToken(result)) return result
		self.log('warn', `${what} "${result}" is not a valid RossTalk name`)
		return undefined
	}

	const meOption = {
		type: 'dropdown',
		label: 'ME',
		id: 'mle',
		default: 'ME:1',
		choices: ME_CHOICES,
	}

	const keyerOption = {
		type: 'textinput',
		label: 'Keyer',
		id: 'key',
		default: '1',
		tooltip: `1-${RESOURCES.meKeyers} on the ME, 1-${RESOURCES.miniMeKeyers} on a MiniME`,
		useVariables: true,
	}

	const sourceOption = (id, label, def) => ({
		type: 'dropdown',
		label: label,
		id: id,
		default: def,
		choices: sourceChoices,
		allowCustom: true,
		regex: TOKEN_REGEX,
	})

	const memoryOptions = [
		{
			type: 'textinput',
			label: 'Bank (0-9)',
			id: 'bank',
			default: '0',
			useVariables: true,
		},
		{
			type: 'textinput',
			label: 'Memory (0-9)',
			id: 'mem',
			default: '0',
			useVariables: true,
		},
		{
			type: 'multidropdown',
			label: 'MEs',
			id: 'mles',
			default: ['ME:1'],
			minSelection: 1,
			choices: meMemChoices,
		},
	]

	const memoryCommand = async (verb, event, context) => {
		const opt = event.options
		const bank = await number(context, opt.bank, 0, 9, 'Bank')
		const mem = await number(context, opt.mem, 0, 9, 'Memory')
		const mles = Array.isArray(opt.mles) ? opt.mles : []
		if (bank === undefined || mem === undefined || mles.length === 0) return
		sendCommand(`${verb} ${bank}${mem}:${mles.join(':')}`)
	}

	const simple = (name, cmd, description) => ({
		name: name,
		description: description,
		options: [],
		callback: async () => {
			sendCommand(cmd)
		},
	})

	const actions = {
		gpi: {
			name: 'Trigger GPI',
			options: [
				{
					type: 'textinput',
					label: `Number (1-${RESOURCES.gpis})`,
					id: 'gpi',
					default: '1',
					useVariables: true,
				},
			],
			callback: async (event, context) => {
				const gpi = await number(context, event.options.gpi, 1, RESOURCES.gpis, 'GPI')
				if (gpi !== undefined) sendCommand('GPI ' + pad(gpi, 2))
			},
		},

		cc: {
			name: 'Fire custom control',
			options: [
				{
					type: 'textinput',
					label: `CC Bank (1-${RESOURCES.ccBanks})`,
					id: 'bank',
					default: '1',
					useVariables: true,
				},
				{
					type: 'textinput',
					label: `CC Number (1-${RESOURCES.ccPerBank})`,
					id: 'cc',
					default: '1',
					useVariables: true,
				},
			],
			callback: async (event, context) => {
				const bank = await number(context, event.options.bank, 1, RESOURCES.ccBanks, 'CC Bank')
				const cc = await number(context, event.options.cc, 1, RESOURCES.ccPerBank, 'CC Number')
				if (bank !== undefined && cc !== undefined) sendCommand('CC ' + bank + ':' + pad(cc, 2))
			},
		},

		cut: {
			name: 'Cut',
			options: [meOption],
			callback: async (event) => {
				sendCommand('MECUT ' + event.options.mle)
			},
		},

		autotrans: {
			name: 'Auto Transition',
			options: [meOption],
			callback: async (event) => {
				sendCommand('MEAUTO ' + event.options.mle)
			},
		},

		ftb: simple('Fade to black', 'FTB'),

		xpt: {
			name: 'XPT',
			description: 'Select a source on a bus',
			options: [
				{
					type: 'dropdown',
					label: 'Destination',
					id: 'vidDest',
					default: 'ME:1:PST',
					choices: destChoices,
					allowCustom: true,
					regex: TOKEN_REGEX,
				},
				sourceOption('vidSource', 'Source', 'IN:1'),
			],
			callback: async (event, context) => {
				const dst = await token(context, event.options.vidDest, 'Destination')
				const src = await token(context, event.options.vidSource, 'Source')
				if (dst && src) sendCommand('XPT ' + dst + ':' + src)
			},
		},

		transKey: {
			name: 'Transition Keyer',
			options: [
				meOption,
				keyerOption,
				{
					type: 'dropdown',
					label: 'Transition On/Off Air ',
					id: 'transD',
					default: 'TOGGLE',
					choices: [
						{ id: 'TOGGLE', label: 'Toggle Keyer' },
						{ id: 'ON', label: 'Transition OnAir' },
						{ id: 'OFF', label: 'Transition OffAir' },
					],
				},
				{
					type: 'dropdown',
					label: 'Transition type',
					id: 'transT',
					default: 'CUT',
					choices: [
						{ id: 'AUTO', label: 'Auto Transition' },
						{ id: 'CUT', label: 'Cut Transition ' },
					],
				},
			],
			callback: async (event, context) => {
				const opt = event.options
				const key = await number(context, opt.key, 1, RESOURCES.meKeyers, 'Keyer')
				if (key === undefined) return
				const direction = opt.transD === 'TOGGLE' ? '' : opt.transD
				sendCommand('KEY' + opt.transT + direction + ' ' + opt.mle + ':' + key)
			},
		},

		keyMode: {
			name: 'Key Mode',
			options: [
				meOption,
				keyerOption,
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: 'NORMAL',
					choices: [
						{ id: 'NORMAL', label: 'Normal' },
						{ id: 'ADDITIVE', label: 'Additive' },
						{ id: 'FULL', label: 'Full' },
					],
				},
			],
			callback: async (event, context) => {
				const opt = event.options
				const key = await number(context, opt.key, 1, RESOURCES.meKeyers, 'Keyer')
				if (key !== undefined) sendCommand('KEYMODE ' + opt.mle + ':' + key + ':' + opt.mode)
			},
		},

		transIncl: {
			name: 'Next Transition: included elements',
			description: 'Replaces the current selection of the next transition area',
			options: [
				meOption,
				{
					type: 'multidropdown',
					label: 'Include',
					id: 'incl',
					default: ['B'],
					minSelection: 1,
					choices: [
						{ id: 'B', label: 'Background' },
						...range(RESOURCES.meKeyers).map((k) => ({ id: String(k), label: `Key ${k}` })),
					],
				},
			],
			callback: async (event) => {
				const incl = Array.isArray(event.options.incl) ? event.options.incl : []
				if (incl.length > 0) sendCommand('TRANSINCL ' + event.options.mle + ':' + incl.join(':'))
			},
		},

		transRate: {
			name: 'Transition Rate',
			options: [
				meOption,
				{
					type: 'textinput',
					label: 'Rate (frames)',
					id: 'rate',
					default: '15',
					useVariables: true,
				},
			],
			callback: async (event, context) => {
				const rate = await number(context, event.options.rate, 1, 999, 'Rate')
				if (rate !== undefined) sendCommand('TRANSRATE ' + event.options.mle + ':' + rate)
			},
		},

		transType: {
			name: 'Transition Type',
			options: [
				meOption,
				{
					type: 'dropdown',
					label: 'Type',
					id: 'type',
					default: 'DISS',
					choices: [
						{ id: 'DISS', label: 'Dissolve' },
						{ id: 'WIPE', label: 'Wipe' },
						{ id: 'DVE', label: 'DVE' },
						{ id: 'MEDIA', label: 'Media Wipe' },
					],
				},
			],
			callback: async (event) => {
				sendCommand('TRANSTYPE ' + event.options.mle + ':' + event.options.type)
			},
		},

		MEM: {
			name: 'Recall Memory',
			options: memoryOptions,
			callback: async (event, context) => memoryCommand('MEM', event, context),
		},

		MEMSAVE: {
			name: 'Store Memory',
			options: memoryOptions,
			callback: async (event, context) => memoryCommand('MEMSAVE', event, context),
		},

		loadset: {
			name: 'Load Set',
			description: 'Recalls a set from the USB drive of the switcher',
			options: [
				{
					type: 'textinput',
					label: 'Set name',
					id: 'set',
					useVariables: true,
					default: 'set1',
				},
			],
			callback: async (event, context) => {
				const set = await text(context, event.options.set)
				if (set) sendCommand('LOADSET ' + set)
			},
		},

		saveset: {
			name: 'Save Set',
			description: 'Stores the switcher settings to a set on the USB drive of the switcher',
			options: [
				{
					type: 'textinput',
					label: 'Set name',
					id: 'set',
					useVariables: true,
					default: 'set1',
				},
			],
			callback: async (event, context) => {
				const set = await text(context, event.options.set)
				if (set) sendCommand('SAVESET ' + set)
			},
		},

		ms: {
			name: 'Load Media-Store',
			options: [
				{
					type: 'dropdown',
					label: 'Channel',
					id: 'channel',
					default: 1,
					choices: range(RESOURCES.mediaStores).map((n) => ({ id: n, label: `Media-Store ${n}` })),
				},
				{
					type: 'dropdown',
					label: 'Location',
					id: 'location',
					default: 0,
					choices: [
						{ id: 0, label: 'Internal' },
						{ id: 1, label: 'USB' },
					],
				},
				{
					type: 'textinput',
					label: 'Media ID (0-999)',
					id: 'media',
					default: '1',
					useVariables: true,
				},
			],
			callback: async (event, context) => {
				const opt = event.options
				const media = await number(context, opt.media, 0, 999, 'Media ID')
				if (media !== undefined) sendCommand('MS ' + opt.channel + ':' + opt.location + ':' + pad(media, 3))
			},
		},

		mnem: {
			name: 'Set Source Name',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 'IN:1',
					choices: mnemChoices,
				},
				{
					type: 'textinput',
					label: 'Name (8 characters)',
					id: 'name',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event, context) => {
				const name = (await text(context, event.options.name)).substring(0, 8)
				if (name) sendCommand('MNEM ' + event.options.source + ':' + name)
			},
		},

		clip: {
			name: 'Clip Player',
			options: [
				{
					type: 'dropdown',
					label: 'Command',
					id: 'cmd',
					default: 'CLIPPLAY',
					choices: [
						{ id: 'CLIPPLAY', label: 'Play' },
						{ id: 'CLIPPAUSE', label: 'Pause' },
						{ id: 'CLIPEJECT', label: 'Eject' },
						{ id: 'CLIPLOOPON', label: 'Loop On' },
						{ id: 'CLIPLOOPOFF', label: 'Loop Off' },
					],
				},
			],
			callback: async (event) => {
				sendCommand(event.options.cmd)
			},
		},

		clipLoad: {
			name: 'Clip Player: Load Clip',
			options: [
				{
					type: 'textinput',
					label: 'Clip name',
					id: 'clip',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event, context) => {
				const clip = await text(context, event.options.clip)
				if (clip) sendCommand('CLIPLOAD ' + clip)
			},
		},

		ckInit: simple('Initialize Chroma Key', 'CKINIT 1'),

		help: simple('List supported commands', 'HELP', 'The answer of the switcher is written to the module log'),

		custom: {
			name: 'Send a custom command',
			description: 'Refer to RossTalk Guide',
			options: [
				{
					type: 'textinput',
					label: 'Command',
					id: 'cmd',
					useVariables: true,
				},
			],
			callback: async (event, context) => {
				const cmd = await text(context, event.options.cmd)
				if (cmd) sendCommand(cmd)
			},
		},
	}

	self.setActionDefinitions(actions)
}
