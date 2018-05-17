'use strict'

const {point} = require('@turf/helpers')
const fetchTrackSlice = require('hafas-fetch-track-slice')
const distance = require('gps-distance')
const pointToLineDistance = require('@turf/point-to-line-distance').default
const Queue = require('p-queue')

const findTrip = (hafas, pos, opt = {}) => {
	const {latitude: lat, longitude: long} = pos
	const p = point([long, lat])

	opt = Object.assign({
		results: 10,
		duration: 1,
		frames: 2
	}, opt)

	return hafas.radar({
		// todo: make this meters-based
		// todo: make this an option
		north: lat + .005,
		west: long - .005,
		south: lat - .005,
		east: long + .005
	}, opt)
	.then((vehicles) => {
		const matches = []
		const queue = new Queue({concurrency: 4})

		const findByTrack = (v) => () => {
			const frame = v.frames && v.frames[0] && v.frames[0]
			const prev = frame && frame.origin
			const next = frame && frame.destination
			if (!prev || !next) {
				return Promise.resolve() // todo: what to do here?
			}
			const lineName = v.line && v.line.name || 'foo'

			return fetchTrackSlice(hafas, prev, next, v.journeyId, lineName)
			.catch(() => null) // swallow errors
			.then((trackSlice) => {
				if (trackSlice) {
					const d = pointToLineDistance(p, trackSlice)
					if (d < .04) matches.push([d, v])
				}
			})
		}

		// The vehicle movements from `radar()` are often *not* the actual
		// position, but the estimated position, based on their current delays
		// and their track. Because this is inaccurate, we
		// - check if `point` is close to the estimated position of a vehicle,
		// - check if `point` is close to where the vehicle has been or will be.

		// todo: use the direction to find a match
		// todo: use the speed to find a match
		// todo: scoring to find the best system
		for (let v of vehicles) {
			const l = v.location
			const d = distance(lat, long, l.latitude, l.longitude)
			if (d < .08) {
				matches.push([d, v])
			} else {
				queue.add(findByTrack(v))
				.catch(console.error) // todo: handle errors
			}
		}

		return queue
		.onIdle()
		.then(() => matches)
	})
}

module.exports = findTrip
