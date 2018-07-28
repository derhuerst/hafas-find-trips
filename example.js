'use strict'

const createHafas = require('vbb-hafas')

const findTrips = require('.')

const hafas = createHafas('hafas-find-trips-example')

findTrips(hafas, {
	// U6 tunnel, northbound
	latitude: 52.496633,
	longitude: 13.390944,
	bearing: 16, // degrees, 0 is north
	product: 'subway'
})
.then((matches) => {
	for (let match of matches) {
		const m = match.movement
		const n = m.line && m.line.name
		console.error(n, m.journeyId, {
			distanceToTrack: match.distanceToTrack,
			distanceOnTrack: match.distanceOnTrack,
			trackBearing: match.trackBearing,
			score: match.score
		})
	}
})
.catch((err) => {
	console.error(err)
	process.exitCode = 1
})
