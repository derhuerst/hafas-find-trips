'use strict'

const {getCoords} = require('@turf/invariant')
const {point, lineString} = require('@turf/helpers')
const nearestOnLine = require('@turf/nearest-point-on-line').default
const lineSlice = require('@turf/line-slice').default
const isClockwise = require('@turf/boolean-clockwise').default
const lineToPolygon = require('@turf/line-to-polygon').default
const computeArea = require('@turf/area').default

const matchTrack = (rec, track) => {
	const recPoints = getCoords(rec)

	const recStart = point(recPoints[0])
	const closestToStart = nearestOnLine(track, recStart)
	const recEnd = point(recPoints[recPoints.length - 1])
	const closestToEnd = nearestOnLine(track, recEnd)
	const slice = lineSlice(closestToStart, closestToEnd, track)
	const slicePoints = getCoords(slice)

	let areaPoints;
	if (isClockwise(slicePoints) === isClockwise(recPoints)) {
		areaPoints = recPoints.concat(slicePoints.reverse())
	} else {
		areaPoints = recPoints.concat(slicePoints)
	}
	const area = computeArea(lineToPolygon(lineString(areaPoints)))

	let score = area / 100
	if (closestToStart.properties.location > closestToEnd.properties.location) {
		score *= 3
	}

	return {
		score,
		closestToStart, closestToEnd,
		trackSlice: slice
	}
}

module.exports = matchTrack
