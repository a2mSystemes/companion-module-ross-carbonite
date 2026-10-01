const net = require('net')
const { TCPHelper, InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base')

const getConfigFields = require('./src/config')
const updateActions = require('./src/actions')
const updateFeedbacks = require('./src/feedbacks')
const updateVariables = require('./src/variables')
const updatePresets = require('./src/presets')
const upgrades = require('./src/upgrades')
const { TslListener, packetToState } = require('./src/tsl')

class CarboniteBlackSoloInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		// Last TSL UMD state received for each address
		this.tsl = new Map()
		this.rossTalkStatus = { status: InstanceStatus.Connecting }
	}

	async init(config) {
		await this.configUpdated(config)
	}

	async configUpdated(config) {
		this.config = config
		this.tsl.clear()

		updateActions(this)
		updateFeedbacks(this)
		updateVariables(this)
		updatePresets(this)

		this.init_tsl()

		if (this.config.keepAlive) {
			this.setRossTalkStatus(InstanceStatus.Connecting, 'Waiting To Connect')
			this.init_tcp()
		} else {
			this.destroy_tcp()
			this.setRossTalkStatus(InstanceStatus.Ok)
		}
	}

	getConfigFields() {
		return getConfigFields()
	}

	setRossTalkStatus(status, message) {
		this.rossTalkStatus = { status, message }
		this.refreshStatus()
	}

	// RossTalk drives the status. A TSL problem only downgrades a working connection to a warning.
	refreshStatus() {
		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'Switcher Frame IP is missing')
		} else if (this.rossTalkStatus.status !== InstanceStatus.Ok) {
			this.updateStatus(this.rossTalkStatus.status, this.rossTalkStatus.message)
		} else if (this.tslError) {
			this.updateStatus(InstanceStatus.UnknownWarning, this.tslError)
		} else {
			this.updateStatus(InstanceStatus.Ok)
		}
	}

	destroy_tcp() {
		if (this.socket !== undefined) {
			this.socket.destroy()
			delete this.socket
		}
	}

	init_tcp() {
		this.destroy_tcp()

		if (!this.config.host) return

		this.log('debug', 'Opening socket.')
		this.socket = new TCPHelper(this.config.host, Number(this.config.port) || 7788)

		this.socket.on('status_change', (status, message) => {
			if (status !== 'unknown_error') {
				this.setRossTalkStatus(status, message)
			}
		})

		this.socket.on('error', (err) => {
			this.setRossTalkStatus(InstanceStatus.ConnectionFailure, err.code)
			this.log('error', 'Network error: ' + err.message)
		})

		this.socket.on('connect', () => {
			this.log('debug', 'Connected')
		})

		this.socket.on('data', (data) => this.receive(data))
	}

	sendCommand(cmd) {
		if (cmd === undefined || !this.config.host) return

		if (!this.config.keepAlive) {
			this.sendOnce(cmd)
		} else if (this.socket !== undefined && this.socket.isConnected) {
			this.log('debug', `sending tcp ${cmd} to ${this.config.host}`)
			this.socket.send(cmd + '\r\n')
		} else {
			this.log('warn', `Socket not connected, ${cmd} was not sent`)
		}
	}

	// One connection per command
	sendOnce(cmd) {
		const socket = net.connect(Number(this.config.port) || 7788, this.config.host)
		socket.setTimeout(5000)

		socket.on('connect', () => {
			this.log('debug', `sending tcp ${cmd} to ${this.config.host}`)
			this.setRossTalkStatus(InstanceStatus.Ok)
			socket.end(cmd + '\r\n')
		})
		socket.on('data', (data) => this.receive(data))
		socket.on('timeout', () => socket.destroy(new Error('Connection timed out')))
		socket.on('error', (err) => {
			this.setRossTalkStatus(InstanceStatus.ConnectionFailure, err.code)
			this.log('error', `Network error: ${err.message}, ${cmd} was not sent`)
		})
	}

	// The switcher only answers to HELP
	receive(data) {
		for (const line of data.toString('latin1').split(/[\r\n]+/)) {
			if (line.trim()) this.log('info', 'RossTalk: ' + line.trim())
		}
	}

	init_tsl() {
		if (this.tslListener !== undefined) {
			this.tslListener.stop()
			delete this.tslListener
		}
		delete this.tslError

		if (!this.config.tslEnabled) return

		const port = Number(this.config.tslPort)
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			this.tslError = 'TSL Listen Port is invalid'
			return
		}

		const rejected = new Set()
		this.tslListener = new TslListener({
			transport: this.config.tslTransport,
			port: port,
			allowedHost: this.config.tslFilter ? this.config.host : undefined,
		})
		this.tslListener.on('listening', () => {
			this.log('debug', `Listening for TSL UMD on ${this.config.tslTransport} port ${port}`)
		})
		this.tslListener.on('error', (err) => {
			this.log('error', 'TSL error: ' + err.message)
			this.tslError = `TSL: ${err.code ?? err.message}`
			this.refreshStatus()
		})
		this.tslListener.on('rejected', (address) => {
			if (rejected.has(address)) return
			rejected.add(address)
			this.log('warn', `Ignoring TSL data from ${address}: it is not the Switcher Frame IP`)
		})
		this.tslListener.on('packet', (packet) => this.handleTsl(packet))
		this.tslListener.start()
	}

	handleTsl(packet) {
		const state = packetToState(packet)

		const previous = this.tsl.get(packet.address)
		if (previous && Object.keys(state).every((key) => previous[key] === state[key])) return
		this.tsl.set(packet.address, state)

		const values = {}
		for (const variable of this.tslVariables.get(packet.address) ?? []) {
			values[variable.variableId] = state[variable.field] ?? ''
		}
		this.setVariableValues(values)
		this.checkFeedbacks('tally', 'busSource', 'tslTally')
	}

	// When module gets deleted
	async destroy() {
		this.destroy_tcp()
		if (this.tslListener !== undefined) {
			this.tslListener.stop()
			delete this.tslListener
		}
		this.log('debug', 'destroy')
	}
}

runEntrypoint(CarboniteBlackSoloInstance, upgrades)
