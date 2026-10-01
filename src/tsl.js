// TSL UMD v3.1 receiver. The switcher is the sender: it pushes 18 byte packets over UDP,
// or connects to us over TCP, so this module has to listen.
//
// Packet: byte 0 = 0x80 + address (0-126)
//         byte 1 = control: bits 0-3 tally 1-4, bits 4-5 brightness
//         bytes 2-17 = 16 ASCII display characters

const dgram = require('dgram')
const net = require('net')
const { EventEmitter } = require('events')

const PACKET_LENGTH = 18

function parsePacket(buf) {
	const control = buf[1]
	return {
		address: buf[0] & 0x7f,
		tally1: (control & 0x01) !== 0,
		tally2: (control & 0x02) !== 0,
		tally3: (control & 0x04) !== 0,
		tally4: (control & 0x08) !== 0,
		brightness: (control >> 4) & 0x03,
		label: buf
			.subarray(2, PACKET_LENGTH)
			.toString('latin1')
			.replace(/\0/g, ' ')
			.trim(),
	}
}

// What the module keeps for an address. With ShowUMDId the switcher starts the label with the TSL ID
// of the source, as in "3:CAM 3".
function packetToState(packet) {
	const match = /^(\d{1,3}):(.*)$/.exec(packet.label)
	return {
		tally1: packet.tally1,
		tally2: packet.tally2,
		tally3: packet.tally3,
		tally4: packet.tally4,
		name: match ? match[2].trim() : packet.label,
		sourceId: match ? Number(match[1]) : undefined,
	}
}

// Cuts a byte stream into packets. The header is the only byte with bit 7 set, which is used to resynchronise.
class TslFramer {
	constructor() {
		this.buffer = Buffer.alloc(0)
	}

	push(chunk) {
		this.buffer = Buffer.concat([this.buffer, chunk])
		const packets = []

		for (;;) {
			const start = this.buffer.findIndex((byte) => byte >= 0x80)
			if (start === -1) {
				this.buffer = Buffer.alloc(0)
				break
			}
			if (start > 0) this.buffer = this.buffer.subarray(start)

			// A header inside the packet body means the packet was truncated: restart from that header
			const next = this.buffer.subarray(1, PACKET_LENGTH).findIndex((byte) => byte >= 0x80)
			if (next !== -1) {
				this.buffer = this.buffer.subarray(next + 1)
				continue
			}
			if (this.buffer.length < PACKET_LENGTH) break

			packets.push(parsePacket(this.buffer))
			this.buffer = this.buffer.subarray(PACKET_LENGTH)
		}

		return packets
	}
}

function normaliseAddress(address) {
	return String(address ?? '').replace(/^::ffff:/, '')
}

// Events: 'listening', 'error' (err), 'packet' (packet), 'rejected' (address)
class TslListener extends EventEmitter {
	// allowedHost: when set, data from any other address is dropped
	constructor({ transport, port, allowedHost }) {
		super()
		this.transport = transport === 'tcp' ? 'tcp' : 'udp'
		this.port = Number(port)
		this.allowedHost = allowedHost ? normaliseAddress(allowedHost) : undefined
		this.sockets = new Set()
	}

	isAllowed(address) {
		if (!this.allowedHost || normaliseAddress(address) === this.allowedHost) return true
		this.emit('rejected', normaliseAddress(address))
		return false
	}

	start() {
		if (this.transport === 'udp') {
			this.server = dgram.createSocket({ type: 'udp4', reuseAddr: true })
			this.server.on('message', (msg, rinfo) => {
				if (!this.isAllowed(rinfo.address)) return
				for (const packet of new TslFramer().push(msg)) this.emit('packet', packet)
			})
			this.server.on('error', (err) => this.emit('error', err))
			this.server.on('listening', () => this.emit('listening'))
			this.server.bind(this.port)
		} else {
			this.server = net.createServer((socket) => {
				if (!this.isAllowed(socket.remoteAddress)) {
					socket.destroy()
					return
				}
				const framer = new TslFramer()
				this.sockets.add(socket)
				socket.on('data', (data) => {
					for (const packet of framer.push(data)) this.emit('packet', packet)
				})
				socket.on('error', () => socket.destroy())
				socket.on('close', () => this.sockets.delete(socket))
			})
			this.server.on('error', (err) => this.emit('error', err))
			this.server.on('listening', () => this.emit('listening'))
			this.server.listen(this.port)
		}
	}

	stop() {
		for (const socket of this.sockets) socket.destroy()
		this.sockets.clear()
		if (this.server) {
			this.server.removeAllListeners()
			this.server.on('error', () => {})
			try {
				this.server.close()
			} catch (e) {
				// not listening yet
			}
			delete this.server
		}
	}
}

module.exports = { PACKET_LENGTH, parsePacket, packetToState, TslFramer, TslListener }
