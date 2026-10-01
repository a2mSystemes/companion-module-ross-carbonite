const { Regex } = require('@companion-module/base')
const { MODELS, DEFAULT_MODEL } = require('./model')

module.exports = function getConfigFields() {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'Information',
			value:
				'Control uses RossTalk (TCP, port 7788 on the switcher). Feedback uses TSL UMD v3.1: the switcher must be set up to send TSL to this computer, see the module help.',
		},
		{
			type: 'dropdown',
			id: 'model',
			label: 'Model',
			width: 12,
			default: DEFAULT_MODEL,
			choices: Object.entries(MODELS).map(([id, model]) => ({ id, label: model.label })),
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Switcher Frame IP',
			width: 6,
			default: '192.168.0.123',
			regex: Regex.IP,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'RossTalk Port',
			width: 6,
			default: '7788',
			regex: Regex.PORT,
		},
		{
			type: 'checkbox',
			id: 'keepAlive',
			label: 'TCP Keep Alive',
			tooltip: 'TCP Keep Alive: Use a single TCP connection instead of one per command',
			width: 12,
			default: true,
		},
		{
			type: 'checkbox',
			id: 'tslEnabled',
			label: 'Receive TSL UMD v3.1 feedback',
			width: 12,
			default: true,
		},
		{
			type: 'dropdown',
			id: 'tslTransport',
			label: 'TSL Transport',
			width: 6,
			default: 'udp',
			choices: [
				{ id: 'udp', label: 'UDP' },
				{ id: 'tcp', label: 'TCP (the switcher connects to Companion)' },
			],
		},
		{
			type: 'textinput',
			id: 'tslPort',
			label: 'TSL Listen Port',
			tooltip: 'Port on this computer. Enter the same port in the TSL device of the switcher.',
			width: 6,
			default: '5727',
			regex: Regex.PORT,
		},
		{
			type: 'checkbox',
			id: 'tslFilter',
			label: 'Only accept TSL data coming from the Switcher Frame IP',
			width: 12,
			default: true,
		},
	]
}
