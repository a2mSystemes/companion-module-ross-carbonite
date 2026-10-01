// Resources of the Carbonite Black Solo family, their RossTalk tokens and their TSL UMD v3.1 addresses.
// TSL addresses come from Ross "TSL UMD Protocol Setup", table "Carbonite Black Solo/Graphite/Carbonite Black".

const MODELS = {
	solo13: { label: 'Carbonite Black Solo 13 (CBF-113): 12 SDI + 1 HDMI', sdi: 12, hdmi: 1 },
	solo: { label: 'Carbonite Black Solo / 109 (CBF-109): 6 SDI + 3 HDMI', sdi: 6, hdmi: 3 },
}

const DEFAULT_MODEL = 'solo13'

const RESOURCES = {
	miniMes: 2,
	auxes: 16,
	mediaStores: 4,
	meKeyers: 4,
	miniMeKeyers: 2,
	gpis: 24,
	ccBanks: 8,
	ccPerBank: 32,
}

// ME-source:ME-number, as used by MECUT, MEAUTO, KEYCUT, MEM...
const ME_CHOICES = [
	{ id: 'ME:1', label: 'ME 1' },
	{ id: 'MME:1', label: 'MiniME 1' },
	{ id: 'MME:2', label: 'MiniME 2' },
	{ id: 'MSC:1', label: 'MultiScreen 1' },
]

function getModel(id) {
	return MODELS[id] ?? MODELS[DEFAULT_MODEL]
}

function range(count) {
	return Array.from({ length: count }, (_, i) => i + 1)
}

// Video sources. `id` is the RossTalk token, `tsl` the TSL address of the source (when it has one),
// `key` is used to build variable ids.
function getSources(modelId) {
	const model = getModel(modelId)
	const sources = []

	for (const n of range(model.sdi + model.hdmi)) {
		const kind = n <= model.sdi ? 'SDI' : `HDMI ${n - model.sdi}`
		sources.push({ id: `IN:${n}`, key: `in${n}`, label: `Input ${n} (${kind})`, name: `IN ${n}`, tsl: n, tally: true })
	}
	sources.push({ id: 'BK', key: 'bk', label: 'Black', name: 'BK', tsl: 0 })
	sources.push({ id: 'BG', key: 'bg', label: 'Matte Color', name: 'BG', tsl: 0 })
	for (const n of range(RESOURCES.mediaStores)) {
		sources.push({ id: `MS:${n}`, key: `ms${n}`, label: `Media-Store ${n}`, name: `MS ${n}`, tsl: 100 + n, tally: true })
	}
	sources.push({ id: 'CLIP', key: 'clip', label: 'Clip Player', name: 'CLIP' })
	sources.push({ id: 'PGM', key: 'pgm', label: 'Program', name: 'PGM', tsl: 110 })
	sources.push({ id: 'PV', key: 'pv', label: 'Preview', name: 'PV', tsl: 111 })
	sources.push({ id: 'CLN', key: 'cln', label: 'Clean Feed', name: 'CLN', tsl: 112 })
	sources.push({ id: 'ME:1:PGM', key: 'me1_pgm', label: 'ME 1 Program', name: 'ME1 PGM', tsl: 113 })
	sources.push({ id: 'ME:1:PV', key: 'me1_pv', label: 'ME 1 Preview', name: 'ME1 PV', tsl: 114 })
	sources.push({ id: 'ME:1:CLN', key: 'me1_cln', label: 'ME 1 Clean', name: 'ME1 CLN', tsl: 115 })
	sources.push({ id: 'ME:1:BKGD', key: 'me1_bkgd', label: 'ME 1 Background', name: 'ME1 BKGD', tsl: 37 })
	sources.push({ id: 'ME:1:PST', key: 'me1_pst', label: 'ME 1 Preset', name: 'ME1 PST', tsl: 38 })
	for (const k of range(RESOURCES.meKeyers)) {
		const base = 37 + 2 * k
		sources.push({ id: `ME:1:KEY:${k}:V`, key: `me1_key${k}_v`, label: `ME 1 Key ${k} Video`, name: `K${k} V`, tsl: base })
		sources.push({
			id: `ME:1:KEY:${k}:A`,
			key: `me1_key${k}_a`,
			label: `ME 1 Key ${k} Alpha`,
			name: `K${k} A`,
			tsl: base + 1,
		})
	}
	sources.push({ id: 'ME:1:MW', key: 'me1_mw', label: 'ME 1 MediaWipe', name: 'ME1 MW' })
	sources.push({ id: 'ME:1:MWA', key: 'me1_mwa', label: 'ME 1 MediaWipe Alpha', name: 'ME1 MWA' })
	for (const n of range(RESOURCES.miniMes)) {
		const base = 87 + 4 * (n - 1)
		sources.push({ id: `MME:${n}:PGM`, key: `mme${n}_pgm`, label: `MiniME ${n} Program`, name: `MME${n}`, tsl: 115 + n })
		sources.push({ id: `MME:${n}:PV`, key: `mme${n}_pv`, label: `MiniME ${n} Preview`, name: `MME${n} PV` })
		sources.push({
			id: `MME:${n}:BKGD`,
			key: `mme${n}_bkgd`,
			label: `MiniME ${n} Background`,
			name: `MME${n} BG`,
			tsl: base,
		})
		sources.push({ id: `MME:${n}:PST`, key: `mme${n}_pst`, label: `MiniME ${n} Preset`, name: `MME${n} PST`, tsl: base + 1 })
	}
	for (const n of range(RESOURCES.auxes)) {
		sources.push({ id: `AUX:${n}`, key: `aux${n}`, label: `Aux ${n}`, name: `AUX ${n}`, tsl: 66 + n })
	}
	sources.push({ id: 'CK:1', key: 'ck1', label: 'Chroma Key 1 Video', name: 'CK 1' })
	sources.push({ id: 'CKA:1', key: 'cka1', label: 'Chroma Key 1 Alpha', name: 'CK 1 A' })

	return sources
}

// Buses. On a bus address the switcher sends the name of the source selected on that bus.
// `dest` is the RossTalk XPT destination, when the bus can be switched over RossTalk.
function getBuses() {
	const buses = [
		{ key: 'me1_bkgd', label: 'ME 1 Background (Program)', tsl: 37, dest: 'ME:1:PGM' },
		{ key: 'me1_pst', label: 'ME 1 Preset', tsl: 38, dest: 'ME:1:PST' },
	]
	for (const k of range(RESOURCES.meKeyers)) {
		const base = 37 + 2 * k
		buses.push({ key: `me1_key${k}`, label: `ME 1 Key ${k}`, tsl: base, dest: `ME:1:KEY:${k}` })
		buses.push({ key: `me1_key${k}_alpha`, label: `ME 1 Key ${k} Alpha`, tsl: base + 1 })
	}
	for (const n of range(RESOURCES.auxes)) {
		buses.push({ key: `aux${n}`, label: `Aux ${n}`, tsl: 66 + n, dest: `AUX:${n}` })
	}
	for (const n of range(RESOURCES.miniMes)) {
		const base = 87 + 4 * (n - 1)
		buses.push({ key: `mme${n}_bkgd`, label: `MiniME ${n} Background`, tsl: base, dest: `MME:${n}` })
		buses.push({ key: `mme${n}_pst`, label: `MiniME ${n} Preset`, tsl: base + 1 })
		for (const k of range(RESOURCES.miniMeKeyers)) {
			buses.push({ key: `mme${n}_key${k}`, label: `MiniME ${n} Key ${k}`, tsl: base + 1 + k })
		}
	}
	return buses
}

module.exports = { MODELS, DEFAULT_MODEL, RESOURCES, ME_CHOICES, getModel, getSources, getBuses, range }
