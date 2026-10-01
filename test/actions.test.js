const { test } = require('node:test')
const assert = require('node:assert/strict')

const updateActions = require('../src/actions')
const updateFeedbacks = require('../src/feedbacks')
const { getSources, getBuses } = require('../src/model')
const { packetToState } = require('../src/tsl')

function setup(model = 'solo13') {
	const sent = []
	const warnings = []
	const self = {
		config: { model },
		tsl: new Map(),
		log: (level, message) => warnings.push(message),
		sendCommand: (cmd) => sent.push(cmd),
		setActionDefinitions: (definitions) => (self.actions = definitions),
		setFeedbackDefinitions: (definitions) => (self.feedbacks = definitions),
	}
	updateActions(self)
	updateFeedbacks(self)

	const context = { parseVariablesInString: async (text) => text.replace('$(var)', '7') }
	const run = async (id, options = {}) => {
		const defaults = Object.fromEntries(self.actions[id].options.map((option) => [option.id, option.default]))
		await self.actions[id].callback({ options: { ...defaults, ...options } }, context)
		return sent[sent.length - 1]
	}
	return { self, sent, warnings, run }
}

test('actions build the documented RossTalk commands', async () => {
	const { run } = setup()

	assert.equal(await run('gpi', { gpi: '4' }), 'GPI 04')
	assert.equal(await run('cc', { bank: '1', cc: '5' }), 'CC 1:05')
	assert.equal(await run('cut'), 'MECUT ME:1')
	assert.equal(await run('autotrans', { mle: 'MSC:1' }), 'MEAUTO MSC:1')
	assert.equal(await run('ftb'), 'FTB')
	assert.equal(await run('xpt', { vidDest: 'ME:1:PGM', vidSource: 'IN:6' }), 'XPT ME:1:PGM:IN:6')
	assert.equal(await run('xpt', { vidDest: 'AUX:2', vidSource: 'ME:1:CLN' }), 'XPT AUX:2:ME:1:CLN')
	assert.equal(await run('transKey', { key: '4', transT: 'AUTO' }), 'KEYAUTO ME:1:4')
	assert.equal(await run('transKey', { mle: 'MME:2', key: '1', transD: 'OFF' }), 'KEYCUTOFF MME:2:1')
	assert.equal(await run('keyMode', { key: '1' }), 'KEYMODE ME:1:1:NORMAL')
	assert.equal(await run('transIncl', { incl: ['B', '2', '3'] }), 'TRANSINCL ME:1:B:2:3')
	assert.equal(await run('transRate'), 'TRANSRATE ME:1:15')
	assert.equal(await run('transType', { mle: 'MSC:1' }), 'TRANSTYPE MSC:1:DISS')
	assert.equal(await run('MEM', { bank: '1', mem: '9', mles: ['ME:1', 'MME:1'] }), 'MEM 19:ME:1:MME:1')
	assert.equal(await run('MEMSAVE', { bank: '1', mem: '9' }), 'MEMSAVE 19:ME:1')
	assert.equal(await run('loadset'), 'LOADSET set1')
	assert.equal(await run('saveset'), 'SAVESET set1')
	assert.equal(await run('ms', { media: '2' }), 'MS 1:0:002')
	assert.equal(await run('mnem', { source: 'IN:6', name: 'CAM 1' }), 'MNEM IN:6:CAM 1')
	assert.equal(await run('clip'), 'CLIPPLAY')
	assert.equal(await run('clipLoad', { clip: 'trees' }), 'CLIPLOAD trees')
	assert.equal(await run('ckInit'), 'CKINIT 1')
	assert.equal(await run('help'), 'HELP')
	assert.equal(await run('custom', { cmd: 'GPI 12' }), 'GPI 12')
})

test('variables are parsed and bad values are not sent', async () => {
	const { run, sent, warnings } = setup()

	assert.equal(await run('gpi', { gpi: '$(var)' }), 'GPI 07')
	assert.equal(await run('xpt', { vidDest: 'AUX:$(var)', vidSource: 'IN:1' }), 'XPT AUX:7:IN:1')

	const count = sent.length
	await run('gpi', { gpi: '25' })
	await run('cc', { bank: '9', cc: '1' })
	await run('xpt', { vidDest: 'AUX:1', vidSource: 'in 1' })
	assert.equal(sent.length, count)
	assert.equal(warnings.length, 3)
})

test('a command cannot carry a second line', async () => {
	const { run } = setup()
	assert.equal(await run('custom', { cmd: 'FTB\r\nMECUT ME:1' }), 'FTB MECUT ME:1')
	assert.equal(await run('loadset', { set: 'a\nFTB' }), 'LOADSET a FTB')
})

test('model tables match the Ross TSL mapping', () => {
	const solo13 = getSources('solo13')
	assert.equal(solo13.filter((s) => s.id.startsWith('IN:')).length, 13)
	assert.equal(solo13.find((s) => s.id === 'IN:13').label, 'Input 13 (HDMI 1)')
	assert.equal(getSources('solo').filter((s) => s.id.startsWith('IN:')).length, 9)
	assert.equal(getSources('solo').find((s) => s.id === 'IN:7').label, 'Input 7 (HDMI 1)')

	const tsl = Object.fromEntries(getBuses().map((bus) => [bus.key, bus.tsl]))
	assert.equal(tsl.me1_bkgd, 37)
	assert.equal(tsl.me1_pst, 38)
	assert.equal(tsl.me1_key1, 39)
	assert.equal(tsl.me1_key4_alpha, 46)
	assert.equal(tsl.aux1, 67)
	assert.equal(tsl.aux16, 82)
	assert.equal(tsl.mme1_bkgd, 87)
	assert.equal(tsl.mme1_key2, 90)
	assert.equal(tsl.mme2_bkgd, 91)
	assert.equal(tsl.mme2_key2, 94)
	assert.equal(solo13.find((s) => s.id === 'MS:4').tsl, 104)
	assert.equal(solo13.find((s) => s.id === 'MME:2:PGM').tsl, 117)

	const addresses = getBuses().map((bus) => bus.tsl)
	assert.equal(new Set(addresses).size, addresses.length)
})

test('feedbacks follow the TSL state', () => {
	const { self } = setup()
	const state = (label, control = 0) =>
		packetToState({ label, tally1: !!(control & 1), tally2: !!(control & 2), tally3: false, tally4: false })
	const tally = (source, type) => self.feedbacks.tally.callback({ options: { source, tally: type } })
	const bus = (address, source) => self.feedbacks.busSource.callback({ options: { bus: address, source } })

	assert.equal(tally(3, 'program'), false)
	self.tsl.set(3, state('CAM 3', 2))
	self.tsl.set(4, state('CAM 4', 1))
	assert.equal(tally(3, 'program'), true)
	assert.equal(tally(3, 'preview'), false)
	assert.equal(tally(4, 'preview'), true)

	// ShowUMDId on: the bus gives the TSL ID of its source
	self.tsl.set(37, state('3:CAM 3'))
	assert.equal(bus(37, 'IN:3'), true)
	assert.equal(bus(37, 'IN:4'), false)
	self.tsl.set(67, state('0:BK'))
	assert.equal(bus(67, 'BK'), true)

	// ShowUMDId off: only the names can be compared
	self.tsl.set(38, state('CAM 4'))
	assert.equal(bus(38, 'IN:4'), true)
	assert.equal(bus(38, 'IN:3'), false)

	assert.equal(self.feedbacks.tslTally.callback({ options: { address: 3, tally: 'tally2' } }), true)
	assert.equal(self.feedbacks.tslTally.callback({ options: { address: 99, tally: 'tally2' } }), false)
})
