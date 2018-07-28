'use strict'

const createHafas = require('vbb-hafas')

const findTrips = require('..')
// const recording = require('./stadtbahn.json')
const recording = require('./u2-gleisdreieck.json')
// const recording = require('./u2-stadtmitte.json')
// const recording = require('./u2-alexanderplatz.json')
// const recording = require('./u5-alexanderplatz.json')
// const recording = require('./u3-wittenbergplatz.json')

const hafas = createHafas('hafas-find-trips-example')

findTrips(hafas, {recording})
.then((matches) => {
	matches
	.filter(m => m.score < 250)
	.sort((a, b) => a.score - b.score)
	.forEach((match) => {
		const m = match.movement
		const n = m.line && m.line.name
		console.error(n, m.direction, match.score)
		// console.error(JSON.stringify(match.track))
	})
})
.catch((err) => {
	console.error(err)
	process.exitCode = 1
})
