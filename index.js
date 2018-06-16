'use strict'

const {point} = require('@turf/helpers')
const fetchTrackSlice = require('hafas-fetch-track-slice')
const nearestPointOnLine = require('@turf/nearest-point-on-line').default
const lineSlice = require('@turf/line-slice').default
const bearing = require('@turf/bearing').default
const Queue = require('p-queue')
const debug = require('debug')('hafas-find-trips')
const length = require('@turf/length').default
const along = require('@turf/along').default

const findTrip = (hafas, query, opt = {}) => {
	const {latitude: lat, longitude: long} = query
	if ('number' !== typeof lat || Number.isNaN(lat)) {
		throw new Error('invalid query.latitude')
	}
	if ('number' !== typeof long || Number.isNaN(long)) {
		throw new Error('invalid query.longitude')
	}
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

			const frame = v.frames && v.frames[0] && v.frames[0]
			const prev = frame && frame.origin
			const next = frame && frame.destination
			if (!prev || !next) {
				debug(lineName, 'prev', !!prev, 'next', !!next)
				return Promise.resolve() // todo: what to do here?
			}

			return fetchTrackSlice(hafas, prev, next, v.journeyId, lineName)
			.catch(() => null) // swallow errors
			.then((trackSlice) => {
				if (!trackSlice) {
					debug(lineName, 'no trackSlice')
					return null
				}

				const nearestOnTrack = nearestPointOnLine(trackSlice, p)
				const distanceToTrack = nearestOnTrack.properties.dist * 1000
				debug(lineName, 'distanceToTrack', distanceToTrack)

				const toVehicle = lineSlice(nearestOnTrack, loc, trackSlice)
				const distanceOnTrack = length(toVehicle) * 1000
				debug(lineName, 'distanceOnTrack', distanceOnTrack)

				const match = {
					movement: v,
					distanceToTrack, distanceOnTrack,
					score: Math.sqrt(distanceToTrack) + Math.pow(distanceOnTrack, -3)
				}

				// We determine a guide point 300 meters down the track to
				// calculate the track bearing. This is more robust than taking
				// the next stop as a guide because the patch from
				// `nearestOnTrack` to the next stop might not be a direct path
				// (it might be shaped like a U).
				if ('number' === typeof query.bearing) {
					const crds = trackSlice.coordinates
					const guideDistance = Math.min(.3, length(trackSlice))
					debug(lineName, 'guideDistance', guideDistance)
					const guide = along(trackSlice, guideDistance)
					debug(lineName, 'guide', guide.geometry)
					const trackBearing = bearing(nearestOnTrack, guide)
					debug(lineName, 'trackBearing', trackBearing)

					match.trackBearing = trackBearing
					match.score *= 1 + Math.abs(trackBearing - query.bearing) / 90
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
