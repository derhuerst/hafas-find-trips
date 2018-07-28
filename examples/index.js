'use strict'

const createHafas = require('vbb-hafas')

const findTrips = require('..')
// const recording = require('./stadtbahn.json')
const recording = require('./u2-gleisdreieck.json')
// const recording = require('./u2-stadtmitte.json')

const hafas = createHafas('hafas-find-trips-example')

findTrips(hafas, {recording})
.then((matches) => {
	for (let match of matches) {
		const m = match.movement
		const n = m.line && m.line.name
		console.error(n, {
			score: match.score,
			trackBearing: match.trackBearing
		})
		// console.error(JSON.stringify(match.track))
	}
})
.catch((err) => {
	console.error(err)
	process.exitCode = 1
})
