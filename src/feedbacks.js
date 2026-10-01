const { combineRgb } = require('@companion-module/base')
const { getSources, getBuses } = require('./model')

module.exports = function (self) {
	const sources = getSources(self.config.model)
	const buses = getBuses()

	const tallyChoices = sources.filter((source) => source.tally).map((source) => ({ id: source.tsl, label: source.label }))
	const busChoices = buses.map((bus) => ({ id: bus.tsl, label: bus.label }))
	const busSourceChoices = sources
		.filter((source) => source.tsl !== undefined)
		.map((source) => ({ id: source.id, label: source.label }))

	self.setFeedbackDefinitions({
		tally: {
			type: 'boolean',
			name: 'Tally: source on Program / Preview',
			description: 'Uses the tally sent by the switcher over TSL UMD for the source',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 1,
					choices: tallyChoices,
				},
				{
					type: 'dropdown',
					label: 'Tally',
					id: 'tally',
					default: 'program',
					choices: [
						{ id: 'program', label: 'Program' },
						{ id: 'preview', label: 'Preview' },
					],
				},
			],
			callback: (feedback) => {
				const state = self.tsl.get(Number(feedback.options.source))
				if (!state) return false
				return feedback.options.tally === 'preview' ? state.tally1 : state.tally2
			},
		},

		busSource: {
			type: 'boolean',
			name: 'Bus: source selected',
			description: 'Uses the source name sent by the switcher over TSL UMD for the bus',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					type: 'dropdown',
					label: 'Bus',
					id: 'bus',
					default: 37,
					choices: busChoices,
				},
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: 'IN:1',
					choices: busSourceChoices,
				},
			],
			callback: (feedback) => {
				const state = self.tsl.get(Number(feedback.options.bus))
				const source = sources.find((s) => s.id === feedback.options.source)
				if (!state || !source) return false

				// With ShowUMDId the switcher gives the TSL ID of the source, otherwise only names can be compared
				if (state.sourceId !== undefined) return state.sourceId === source.tsl
				const sourceState = self.tsl.get(source.tsl)
				return !!state.name && source.tsl !== 0 && sourceState?.name === state.name
			},
		},

		tslTally: {
			type: 'boolean',
			name: 'TSL: tally of an address',
			description: 'Raw TSL UMD tally, for addresses that the other feedbacks do not cover',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					type: 'number',
					label: 'TSL address',
					id: 'address',
					default: 1,
					min: 0,
					max: 126,
				},
				{
					type: 'dropdown',
					label: 'Tally',
					id: 'tally',
					default: 'tally2',
					choices: [
						{ id: 'tally1', label: 'Tally 1 (Preview)' },
						{ id: 'tally2', label: 'Tally 2 (Program)' },
						{ id: 'tally3', label: 'Tally 3' },
						{ id: 'tally4', label: 'Tally 4' },
					],
				},
			],
			callback: (feedback) => {
				const state = self.tsl.get(Number(feedback.options.address))
				return !!state?.[feedback.options.tally]
			},
		},
	})
}
