'use strict'

const hafas = require('vbb-hafas')

const findTrips = require('.')

findTrips(hafas, {
	// U6 tunnel, northbound
	latitude: 52.496633,
	longitude: 13.390944,
	bearing: 16, // degrees, 0 is north
	product: 'subway'
})
.then(console.log)
.catch((err) => {
	console.error(err)
	process.exitCode = 1
})
