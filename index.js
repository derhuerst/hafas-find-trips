'use strict'

const {point} = require('@turf/helpers')
const fetchTrackSlice = require('hafas-fetch-track-slice')
const nearestPointOnLine = require('@turf/nearest-point-on-line').default
const distance = require('@turf/distance').default
const bearing = require('@turf/bearing').default
const Queue = require('p-queue')
const maxBy = require('lodash.maxby')

const findTrip = (hafas, query, opt = {}) => {
	const {latitude: lat, longitude: long} = query
	const p = point([long, lat])

	opt = Object.assign({
		results: 10,
		duration: 1,
		frames: 2,
		maxScore: 10
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
		// todo: use the speed to find a match

		const perVehicle = (v) => () => {
			const loc = point([v.location.longitude, v.location.latitude])
			const l = v.line
			const lineName = l && l.name || 'foo'

			if (query.product && l && l.product && l.product !== query.product) {
				return Promise.resolve()
			}

			const frame = v.frames && v.frames[0] && v.frames[0]
			const prev = frame && frame.origin
			const next = frame && frame.destination
			if (!prev || !next) {
				return Promise.resolve() // todo: what to do here?
			}

			return fetchTrackSlice(hafas, prev, next, v.journeyId, lineName)
			.catch(() => null) // swallow errors
			.then((trackSlice) => {
				if (!trackSlice) return null
				const nearestOnTrack = nearestPointOnLine(trackSlice, p)
				const distanceToTrack = nearestOnTrack.properties.dist * 1000
				const distanceOnTrack = distance(nearestOnTrack, loc) * 1000
				let score = distanceToTrack + Math.pow(distanceOnTrack, -3)

				if ('number' === typeof query.bearing) {
					const crds = trackSlice.coordinates
					const nextStop = point(crds[crds.length - 1])
					const trackBearing = bearing(nearestOnTrack, nextStop)
					score *= 1 + Math.abs(trackBearing - query.bearing) / 90
				}

				if (score < opt.maxScore) matches.push([score, v])
			})
		}

		const queue = new Queue({concurrency: 4})
		for (let v of vehicles) queue.add(perVehicle(v))

		return queue
		.onIdle()
		.then(() => maxBy(matches, 0))
	})
}

module.exports = findTrip
