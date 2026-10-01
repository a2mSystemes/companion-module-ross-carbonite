const { combineRgb } = require('@companion-module/base')
const { RESOURCES, getSources, range } = require('./model')

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const RED = combineRgb(255, 0, 0)
const GREEN = combineRgb(0, 204, 0)

module.exports = function (self) {
	const presets = {}

	const button = (category, name, text, actionId, options, feedbacks = []) => ({
		type: 'button',
		category: category,
		name: name,
		style: {
			text: text,
			size: 'auto',
			color: WHITE,
			bgcolor: BLACK,
		},
		steps: [
			{
				down: [{ actionId: actionId, options: options }],
				up: [],
			},
		],
		feedbacks: feedbacks,
	})

	for (const source of getSources(self.config.model).filter((s) => s.tally)) {
		const text = `$(${self.label}:source_${source.key}_name)`

		presets[`pgm_${source.key}`] = button(
			'Program',
			`${source.label} to Program`,
			text,
			'xpt',
			{ vidDest: 'ME:1:PGM', vidSource: source.id },
			[
				{
					feedbackId: 'tally',
					options: { source: source.tsl, tally: 'program' },
					style: { bgcolor: RED, color: WHITE },
				},
			],
		)
		presets[`pst_${source.key}`] = button(
			'Preset',
			`${source.label} to Preset`,
			text,
			'xpt',
			{ vidDest: 'ME:1:PST', vidSource: source.id },
			[
				{
					feedbackId: 'tally',
					options: { source: source.tsl, tally: 'preview' },
					style: { bgcolor: GREEN, color: WHITE },
				},
			],
		)
	}

	presets.cut = button('Transitions', 'Cut', 'CUT', 'cut', { mle: 'ME:1' })
	presets.auto = button('Transitions', 'Auto Transition', 'AUTO', 'autotrans', { mle: 'ME:1' })
	presets.ftb = button('Transitions', 'Fade to black', 'FTB', 'ftb', {})

	for (const k of range(RESOURCES.meKeyers)) {
		presets[`key${k}_cut`] = button('Keyers', `Key ${k} Cut`, `KEY ${k}\\nCUT`, 'transKey', {
			mle: 'ME:1',
			key: String(k),
			transD: 'TOGGLE',
			transT: 'CUT',
		})
		presets[`key${k}_auto`] = button('Keyers', `Key ${k} Auto`, `KEY ${k}\\nAUTO`, 'transKey', {
			mle: 'ME:1',
			key: String(k),
			transD: 'TOGGLE',
			transT: 'AUTO',
		})
	}

	self.setPresetDefinitions(presets)
}
