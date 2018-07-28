'use strict'

const {getCoords} = require('@turf/invariant')
const {point, lineString} = require('@turf/helpers')
const nearestPointOnLine = require('@turf/nearest-point-on-line').default
const lineSlice = require('@turf/line-slice').default
const bearing = require('@turf/bearing').default
const Queue = require('p-queue')
const debug = require('debug')('hafas-find-trips')
const length = require('@turf/length').default
const along = require('@turf/along').default

const matchTrack = require('./lib/match-track')

const findTrip = (hafas, query, opt = {}) => {
	if (!query.recording) throw new Error('missing query.recording')
	const recPoints = getCoords(query.recording)
	const [long, lat] = recPoints[recPoints.length - 1]
	// todo: use center instead
	const p = point(recPoints[recPoints.length - 1])

	opt = Object.assign({
		results: 10,
		duration: 1,
		frames: 2
	}, opt)

	return hafas.radar({
		// todo: make this meters-based
		// todo: make this an option
		north: lat + .01,
		west: long - .01,
		south: lat - .01,
		east: long + .01
	}, {
		results: opt.results,
		duration: opt.duration,
		frames: opt.frames
	})
	.then((vehicles) => {
		const matches = []
		// The vehicle movements from `radar()` are often *not* the actual
		// position, but the estimated position, based on their current delays
		// and their track. Because this is inaccurate, we check if `point` is
		// close to where the vehicle has recently been or will soon be.

		const perVehicle = (v) => () => {
			const loc = point([v.location.longitude, v.location.latitude])
			const l = v.line
			const lineName = l && l.name || 'foo'

			if (query.product && l && l.product && l.product !== query.product) {
				debug(lineName, 'wrong product', l.product)
				return Promise.resolve()
			}

			return hafas.trip(v.tripId, lineName, {
				polyline: true,
				stopovers: true
			})
			.then((leg) => {
				const coords = leg.polyline.features.map(f => f.geometry.coordinates);
				const track = lineString(coords)

				const match = {
					movement: v,
					score: matchTrack(query.recording, track),
					track
				}
				matches.push(match)
			})
		}

		const queue = new Queue({concurrency: 4})
		debug(vehicles.length, 'vehicles')
		for (let v of vehicles) queue.add(perVehicle(v))

		return queue
		.onIdle()
		.then(() => matches)
	})
}

module.exports = findTrip
