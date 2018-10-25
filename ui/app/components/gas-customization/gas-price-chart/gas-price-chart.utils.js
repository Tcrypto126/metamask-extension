import * as d3 from 'd3'
import c3 from 'c3'

export function handleMouseMove ({ xMousePos, chartXStart, chartWidth, gasPrices, estimatedTimes, chart }) {
  const { currentPosValue, newTimeEstimate } = getNewXandTimeEstimate({
    xMousePos,
    chartXStart,
    chartWidth,
    gasPrices,
    estimatedTimes,
  })

  if (currentPosValue === null && newTimeEstimate === null) {
    hideDataUI(chart, '#overlayed-circle')
  }

  const indexOfNewCircle = estimatedTimes.length + 1
  const dataUIObj = generateDataUIObj(currentPosValue, indexOfNewCircle, newTimeEstimate)

  chart.internal.overlayPoint(dataUIObj, indexOfNewCircle)
  chart.internal.showTooltip([dataUIObj], d3.select('.c3-areas-data1')._groups[0])
  chart.internal.showXGridFocus([dataUIObj])
}

export function getCoordinateData (selector) {
   return d3.select(selector).node().getBoundingClientRect()
}

export function generateDataUIObj (x, index, value) {
  return {
    x,
    value,
    index,
    id: 'data1',
    name: 'data1',
  }
}

export function handleChartUpdate ({ chart, gasPrices, newPrice, cssId }) {
  const {
    closestLowerValueIndex,
    closestLowerValue,
    closestHigherValueIndex,
    closestHigherValue,
  } = getAdjacentGasPrices({ gasPrices, priceToPosition: newPrice })

  if (closestLowerValue && closestHigherValue) {
    setSelectedCircle({
      chart,
      newPrice,
      closestLowerValueIndex,
      closestLowerValue,
      closestHigherValueIndex,
      closestHigherValue,
    })
  } else {
    hideDataUI(chart, cssId)
  }
}

export function getAdjacentGasPrices ({ gasPrices, priceToPosition }) {
  const closestLowerValueIndex = gasPrices.findIndex((e, i, a) => e <= priceToPosition && a[i + 1] >= priceToPosition)
  const closestHigherValueIndex = gasPrices.findIndex((e, i, a) => e > priceToPosition)
  return {
    closestLowerValueIndex,
    closestHigherValueIndex,
    closestHigherValue: gasPrices[closestHigherValueIndex],
    closestLowerValue: gasPrices[closestLowerValueIndex],
  }
}

export function extrapolateY ({ higherY, lowerY, higherX, lowerX, xForExtrapolation }) {
  const slope = (higherY - lowerY) / (higherX - lowerX)
  const newTimeEstimate = -1 * (slope * (higherX - xForExtrapolation) - higherY)

  return newTimeEstimate
}


export function getNewXandTimeEstimate ({ xMousePos, chartXStart, chartWidth, gasPrices, estimatedTimes }) {
  const chartMouseXPos = xMousePos - chartXStart
  const posPercentile = chartMouseXPos / chartWidth

  const currentPosValue = (gasPrices[gasPrices.length - 1] - gasPrices[0]) * posPercentile + gasPrices[0]

  const {
    closestLowerValueIndex,
    closestLowerValue,
    closestHigherValueIndex,
    closestHigherValue,
  } = getAdjacentGasPrices({ gasPrices, priceToPosition: currentPosValue })

  return !closestHigherValue || !closestLowerValue
    ? {
      currentPosValue: null,
      newTimeEstimate: null,
    }
    : {
      currentPosValue,
      newTimeEstimate: extrapolateY({
        higherY: estimatedTimes[closestHigherValueIndex],
        lowerY: estimatedTimes[closestLowerValueIndex],
        higherX: closestHigherValue,
        lowerX: closestLowerValue,
        xForExtrapolation: currentPosValue,
      }),
    }
}

export function hideDataUI (chart, dataNodeId) {
  const overLayedCircle = d3.select(dataNodeId)
  if (!overLayedCircle.empty()) {
    overLayedCircle.remove()
  }
  d3.select('.c3-tooltip-container').style('display', 'none !important')
  chart.internal.hideXGridFocus()
}

export function setTickPosition (axis, n, newPosition, secondNewPosition) {
  const positionToShift = axis === 'y' ? 'x' : 'y'
  const secondPositionToShift = axis === 'y' ? 'y' : 'x'
  d3.select('#chart')
    .select(`.c3-axis-${axis}`)
    .selectAll('.tick')
    .filter((d, i) => i === n)
    .select('text')
    .attr(positionToShift, 0)
    .select('tspan')
    .attr(positionToShift, newPosition)
    .attr(secondPositionToShift, secondNewPosition || 0)
    .style('visibility', 'visible')
}

export function appendOrUpdateCircle ({ data, itemIndex, cx, cy, cssId, appendOnly }) {
  const circle = this.main
    .select('.c3-selected-circles' + this.getTargetSelectorSuffix(data.id))
    .selectAll(`.c3-selected-circle-${itemIndex}`)

  if (appendOnly || circle.empty()) {
    circle.data([data])
      .enter().append('circle')
      .attr('class', () => this.generateClass('c3-selected-circle', itemIndex))
      .attr('id', cssId)
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('stroke', () => this.color(data))
      .attr('r', 6)
  } else {
    circle.data([data])
      .attr('cx', cx)
      .attr('cy', cy)
  }
}

export function setSelectedCircle ({
  chart,
  newPrice,
  closestLowerValueIndex,
  closestLowerValue,
  closestHigherValueIndex,
  closestHigherValue,
}) {
  const numberOfValues = chart.internal.data.xs.data1.length
  const { x: lowerX, y: lowerY } = getCoordinateData(`.c3-circle-${closestLowerValueIndex}`)
  const { x: higherX, y: higherY } = getCoordinateData(`.c3-circle-${closestHigherValueIndex}`)

  const currentX = lowerX + (higherX - lowerX) * (newPrice - closestLowerValue) / (closestHigherValue - closestLowerValue)
  const newTimeEstimate = extrapolateY({ higherY, lowerY, higherX, lowerX, xForExtrapolation: currentX })

  chart.internal.selectPoint(
    generateDataUIObj(currentX, numberOfValues, newTimeEstimate),
    numberOfValues
  )
}


export function generateChart (gasPrices, estimatedTimes, gasPricesMax, estimatedTimesMax) {
  const gasPricesMaxPadded = gasPricesMax + 1
  const chart = c3.generate({
    size: {
      height: 165,
    },
    transition: {
      duration: 0,
    },
    padding: {left: 20, right: 15, top: 6, bottom: 10},
    data: {
        x: 'x',
        columns: [
            ['x', ...gasPrices],
            ['data1', ...estimatedTimes],
        ],
        types: {
          data1: 'area',
        },
        selection: {
          enabled: false,
        },
    },
    color: {
      data1: '#259de5',
    },
    axis: {
      x: {
        min: gasPrices[0],
        max: gasPricesMaxPadded,
        tick: {
          values: [Math.floor(gasPrices[0]), Math.ceil(gasPricesMaxPadded)],
          outer: false,
          format: function (val) { return val + ' GWEI' },
        },
        padding: {left: gasPricesMaxPadded / 50, right: gasPricesMaxPadded / 50},
        label: {
          text: 'Gas Price ($)',
          position: 'outer-center',
        },
      },
      y: {
        padding: {top: 7, bottom: 7},
        tick: {
          values: [Math.floor(estimatedTimesMax * 0.05), Math.ceil(estimatedTimesMax * 0.97)],
          outer: false,
        },
        label: {
          text: 'Confirmation time (sec)',
          position: 'outer-middle',
        },
        min: 0,
      },
    },
    legend: {
        show: false,
    },
    grid: {
        x: {},
        lines: {
          front: false,
        },
    },
    point: {
      focus: {
        expand: {
          enabled: false,
          r: 3.5,
        },
      },
    },
    tooltip: {
      format: {
        title: (v) => v.toPrecision(4),
      },
      contents: function (d) {
        const titleFormat = this.config.tooltip_format_title
        let text
        d.forEach(el => {
          if (el && (el.value || el.value === 0) && !text) {
            text = "<table class='" + 'custom-tooltip' + "'>" + "<tr><th colspan='2'>" + titleFormat(el.x) + '</th></tr>'
          }
        })
        return text + '</table>' + "<div class='tooltip-arrow'></div>"
      },
      position: function (data) {
        if (d3.select('#overlayed-circle').empty()) {
          return { top: -100, left: -100 }
        }

        const { x: circleX, y: circleY, width: circleWidth } = getCoordinateData('#overlayed-circle')
        const { x: chartXStart, y: chartYStart } = getCoordinateData('.c3-chart')

        // TODO: Confirm the below constants work with all data sets and screen sizes
        const flipTooltip = circleY - circleWidth < chartYStart + 5

        d3
        .select('.tooltip-arrow')
        .style('margin-top', flipTooltip ? '-16px' : '4px')

        return {
          top: circleY - chartYStart - 19 + (flipTooltip ? circleWidth + 38 : 0),
          left: circleX - chartXStart + circleWidth - (gasPricesMaxPadded / 50),
        }
      },
      show: true,
    },
  })

  chart.internal.selectPoint = function (data, itemIndex = (data.index || 0)) {
    const { x: chartXStart, y: chartYStart } = getCoordinateData('.c3-areas-data1')

    d3.select('#set-circle').remove()

    appendOrUpdateCircle.bind(this)({
      data,
      itemIndex,
      cx: () => data.x - chartXStart + 11,
      cy: () => data.value - chartYStart + 10,
      cssId: 'set-circle',
      appendOnly: true,
    })
  }

  chart.internal.overlayPoint = function (data, itemIndex) {
    appendOrUpdateCircle.bind(this)({
      data,
      itemIndex,
      cx: this.circleX.bind(this),
      cy: this.circleY.bind(this),
      cssId: 'overlayed-circle',
    })
  }

  chart.internal.showTooltip = function (selectedData, element) {
    const dataToShow = selectedData.filter((d) => d && (d.value || d.value === 0))

    if (dataToShow.length) {
      this.tooltip.html(
        this.config.tooltip_contents.call(this, selectedData, this.axis.getXAxisTickFormat(), this.getYFormat(), this.color)
      ).style('display', 'flex')

      // Get tooltip dimensions
      const tWidth = this.tooltip.property('offsetWidth')
      const tHeight = this.tooltip.property('offsetHeight')
      const position = this.config.tooltip_position.call(this, dataToShow, tWidth, tHeight, element)
      // Set tooltip
      this.tooltip.style('top', position.top + 'px').style('left', position.left + 'px')
    }
  }

  return chart
}
