'use strict'

const {point} = require('@turf/helpers')
const fetchTrackSlice = require('hafas-fetch-track-slice')
const nearestPointOnLine = require('@turf/nearest-point-on-line').default
const bearing = require('@turf/bearing').default
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
		// The vehicle movements from `radar()` are often *not* the actual
		// position, but the estimated position, based on their current delays
		// and their track. Because this is inaccurate, we check if `point` is
		// close to where the vehicle has recently been or will soon be.
		// todo: use the speed to find a match
		// todo: filter by product

		const perVehicle = (v) => () => {
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
				if (!trackSlice) return null
				const nearestOnTrack = nearestPointOnLine(trackSlice, p)
				const distanceToTrack = nearestOnTrack.properties.dist
				let score = distanceToTrack

				if ('number' === typeof pos.bearing) {
					const crds = trackSlice.coordinates
					const nextStop = point(crds[crds.length - 1])
					const trackBearing = bearing(nearestOnTrack, nextStop)
					score *= 1 + Math.abs(trackBearing - pos.bearing) / 90
				}

				matches.push([score, v])
			})
		}

		const queue = new Queue({concurrency: 4})
		for (let v of vehicles) queue.add(perVehicle(v))

		return queue
		.onIdle()
		.then(() => matches)
	})
}

module.exports = findTrip
