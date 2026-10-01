const { getSources, getBuses } = require('./model')

// Variables fed by TSL UMD, indexed by TSL address
function getTslVariables(modelId) {
	const byAddress = new Map()
	const add = (address, variable) => {
		if (!byAddress.has(address)) byAddress.set(address, [])
		byAddress.get(address).push(variable)
	}

	for (const source of getSources(modelId)) {
		if (!source.tally) continue
		add(source.tsl, { variableId: `source_${source.key}_name`, name: `${source.label}: name`, field: 'name', initial: source.name })
	}
	for (const bus of getBuses()) {
		add(bus.tsl, { variableId: `bus_${bus.key}_source`, name: `${bus.label}: selected source`, field: 'name', initial: '' })
		add(bus.tsl, {
			variableId: `bus_${bus.key}_source_id`,
			name: `${bus.label}: TSL ID of the selected source`,
			field: 'sourceId',
			initial: '',
		})
	}
	return byAddress
}

module.exports = function (self) {
	self.tslVariables = getTslVariables(self.config.model)

	const definitions = []
	const values = {}
	for (const [address, variables] of self.tslVariables) {
		const state = self.tsl.get(address)
		for (const variable of variables) {
			definitions.push({ variableId: variable.variableId, name: variable.name })
			values[variable.variableId] = state?.[variable.field] ?? variable.initial
		}
	}

	self.setVariableDefinitions(definitions)
	self.setVariableValues(values)
}
