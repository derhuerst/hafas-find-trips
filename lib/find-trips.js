'use strict'

const center = require('@turf/center').default
const {point, lineString} = require('@turf/helpers')
const Queue = require('p-queue')
const debug = require('debug')('hafas-find-trips')
const distance = require('@turf/distance').default

const matchTrack = require('./match-track')

const findTrips = (hafas, query, opt = {}) => {
	if (!query.recording) throw new Error('missing query.recording')
	const p = center(query.recording)
	const [long, lat] = p.geometry.coordinates

	opt = Object.assign({
		results: 10,
		duration: 1,
		frames: 2
	}, opt)

	return hafas.radar({
		// todo: make this meters-based
		// todo: make this an option
		north: lat + .007,
		west: long - .007,
		south: lat - .007,
		east: long + .007
	}, {
		results: opt.results,
		duration: opt.duration,
		frames: opt.frames
	})
	.then((vehicles) => {
		const matches = []
		// The vehicle movements from `radar()` are often *not* the actual
		// position, but the estimated position, based on their current delays
		// and their track.

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
			.catch((err) => {
				if (err && err.isHafasError) {
					debug(lineName, err + '')
					return
				}
				throw err
			})
			.then((trip) => {
				if (!trip) return;
				if (!trip.polyline) throw new Error('missing trip.polyline')

				const coords = trip.polyline.features.map(f => f.geometry.coordinates);
				const track = lineString(coords)
				const match = matchTrack(query.recording, track)
				if (match) {
					const loc = point([v.location.longitude, v.location.latitude])
					match.distance = distance(p, loc) * 1000
					match.score *= Math.pow(1 + match.distance, 1/3)
					match.movement = v
					Object.defineProperty(match, 'trip', {value: trip})
					matches.push(match)
				}
			})
		}

		const queue = new Queue({concurrency: 4})
		return queue.addAll(vehicles.map(v => {
			debug('checking', v.line && v.line.name)
			return perVehicle(v)
		}))
		.then(() => matches)
	})
}

module.exports = findTrips
