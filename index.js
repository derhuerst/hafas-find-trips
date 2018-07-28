'use strict'

const {getCoords} = require('@turf/invariant')
const center = require('@turf/center').default
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
	const start = point(recPoints[0])
	const end = point(recPoints[recPoints.length - 1])
	const recBearing = bearing(start, end)
	debug('recBearing', recBearing)

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
		// and their track.

		const perVehicle = (v) => () => {
			const loc = point([v.location.longitude, v.location.latitude])
			const l = v.line
			const lineName = l && l.name || 'foo'

			if (query.product && l && l.product && l.product !== query.product) {
				debug(lineName, 'wrong product', l.product)
				return Promise.resolve()
			}

			const frame = v.frames && v.frames[0] && v.frames[0]
			let prev = frame && frame.origin
			let next = frame && frame.destination
			if (!prev || !next) {
				debug(lineName, 'prev', !!prev, 'next', !!next)
				return Promise.resolve() // todo: what to do here?
			}
			prev = point([prev.location.longitude, prev.location.latitude])
			next = point([next.location.longitude, next.location.latitude])
			const trackBearing = bearing(prev, next)

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
			.then((leg) => {
				if (!leg) return;

				const coords = leg.polyline.features.map(f => f.geometry.coordinates);
				const track = lineString(coords)

				const match = {
					movement: v,
					score: matchTrack(query.recording, track),
					track, trackBearing
				}
				// todo: distance to matched track slice
				match.score *= 1 + Math.abs(trackBearing - recBearing) / 90
				matches.push(match)
			})
		}

		const queue = new Queue({concurrency: 4})
		for (let v of vehicles) {
			debug('checking', v.line && v.line.name)
			queue.add(perVehicle(v))
		}

		return queue
		.onIdle()
		.then(() => matches)
	})
}

module.exports = findTrip
