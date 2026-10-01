const { test } = require('node:test')
const assert = require('node:assert/strict')
const dgram = require('dgram')
const net = require('net')
const { once } = require('events')

const { parsePacket, packetToState, TslFramer, TslListener } = require('../src/tsl')

function packet(address, control, label) {
	const buf = Buffer.alloc(18, 0x20)
	buf[0] = 0x80 + address
	buf[1] = control
	buf.write(label, 2, 'latin1')
	return buf
}

test('parsePacket decodes address, tallies, brightness and label', () => {
	const parsed = parsePacket(packet(5, 0b00110010, 'CAM 5'))
	assert.deepEqual(parsed, {
		address: 5,
		tally1: false,
		tally2: true,
		tally3: false,
		tally4: false,
		brightness: 3,
		label: 'CAM 5',
	})
})

test('packetToState splits the TSL ID that ShowUMDId puts in front of the name', () => {
	assert.deepEqual(packetToState(parsePacket(packet(37, 0, '3:CAM 3'))), {
		tally1: false,
		tally2: false,
		tally3: false,
		tally4: false,
		name: 'CAM 3',
		sourceId: 3,
	})
	const plain = packetToState(parsePacket(packet(3, 1, 'CAM 3')))
	assert.equal(plain.name, 'CAM 3')
	assert.equal(plain.sourceId, undefined)
	assert.equal(plain.tally1, true)
})

test('TslFramer reassembles packets split across chunks', () => {
	const framer = new TslFramer()
	const stream = Buffer.concat([packet(1, 1, 'ONE'), packet(2, 2, 'TWO')])
	assert.deepEqual(framer.push(stream.subarray(0, 7)), [])
	const first = framer.push(stream.subarray(7, 25))
	assert.deepEqual(
		first.map((p) => p.label),
		['ONE'],
	)
	const second = framer.push(stream.subarray(25))
	assert.deepEqual(
		second.map((p) => [p.address, p.label]),
		[[2, 'TWO']],
	)
})

test('TslFramer resynchronises after garbage and truncated packets', () => {
	const framer = new TslFramer()
	const stream = Buffer.concat([Buffer.from('junk'), packet(1, 1, 'CUT').subarray(0, 10), packet(9, 2, 'NINE')])
	assert.deepEqual(
		framer.push(stream).map((p) => [p.address, p.label]),
		[[9, 'NINE']],
	)
})

test('TslListener receives UDP packets and filters by sender', async () => {
	const probe = dgram.createSocket('udp4')
	probe.bind(0)
	await once(probe, 'listening')
	const port = probe.address().port
	probe.close()

	const listener = new TslListener({ transport: 'udp', port, allowedHost: '127.0.0.1' })
	listener.start()
	await once(listener, 'listening')

	const sender = dgram.createSocket('udp4')
	const received = once(listener, 'packet')
	sender.send(Buffer.concat([packet(4, 2, 'CAM 4')]), port, '127.0.0.1')
	const [parsed] = await received
	assert.equal(parsed.address, 4)
	assert.equal(parsed.tally2, true)
	sender.close()
	listener.stop()

	const strict = new TslListener({ transport: 'udp', port, allowedHost: '10.9.8.7' })
	strict.start()
	await once(strict, 'listening')
	const sender2 = dgram.createSocket('udp4')
	const rejected = once(strict, 'rejected')
	sender2.send(packet(4, 2, 'CAM 4'), port, '127.0.0.1')
	assert.deepEqual(await rejected, ['127.0.0.1'])
	sender2.close()
	strict.stop()
})

test('TslListener receives TCP packets', async () => {
	const listener = new TslListener({ transport: 'tcp', port: 0 })
	listener.start()
	await once(listener, 'listening')
	const port = listener.server.address().port

	const packets = []
	listener.on('packet', (p) => packets.push(p))

	const client = net.connect(port, '127.0.0.1')
	await once(client, 'connect')
	const stream = Buffer.concat([packet(37, 0, '2:CAM 2'), packet(2, 2, 'CAM 2')])
	client.write(stream.subarray(0, 20))
	await new Promise((resolve) => setTimeout(resolve, 50))
	client.write(stream.subarray(20))
	await new Promise((resolve) => setTimeout(resolve, 50))

	assert.deepEqual(
		packets.map((p) => [p.address, p.label]),
		[
			[37, '2:CAM 2'],
			[2, 'CAM 2'],
		],
	)
	client.destroy()
	listener.stop()
})
