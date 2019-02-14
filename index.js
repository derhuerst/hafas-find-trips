'use strict'

const express = require('express')
const corser = require('corser')
const compression = require('compression')
const serveStatic = require('serve-static')
const createHafas = require('vbb-hafas')
const bodyParser = require('body-parser')

const findTrips = require('./lib/find-trips')

const app = express()
app.use(corser.create({
	requestHeaders: corser.simpleRequestHeaders.concat('User-Agent')
}))
app.use(compression())
app.use(serveStatic(__dirname))

const hafas = createHafas('hafas-find-trips-example')

app.post('/movements', bodyParser.json(), (req, res) => {
	if (!req.body) return res.status(400).end('missing recording, send JSON body')
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
