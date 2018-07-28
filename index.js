'use strict'

const express = require('express')
const corser = require('corser')
const compression = require('compression')
const bodyParser = require('body-parser')
const createHafas = require('vbb-hafas')

const findTrips = require('./lib/find-trips')

const app = express()
app.use(corser.create({
	requestHeaders: corser.simpleRequestHeaders.concat('User-Agent')
}))
app.use(compression())
app.use(bodyParser.json())

const hafas = createHafas('hafas-find-trips-example')

app.post('/', (req, res) => {
	if (!req.body) res.status(400).end('missing recording, send JSON body')
	const query = {recording: req.body}
	if (req.query.product) query = req.query.product

	findTrips(hafas, query)
	.then((matches) => {
		res.json(matches)
	})
	.catch((err) => {
		console.error(err)
		res.status(err.statusCode || 500).end(err + '')
	})
})

app.listen(3000)
