const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
const CurrencyDisplay = require('./currency-display')

module.exports = GasFeeDisplay

inherits(GasFeeDisplay, Component)
function GasFeeDisplay () {
  Component.call(this)
}

GasFeeDisplay.prototype.render = function () {
  const {
    conversionRate,
    gasTotal,
    onClick,
  } = this.props

  return h('div', [

    gasTotal
      ? h(CurrencyDisplay, {
        primaryCurrency: 'ETH',
        convertedCurrency: 'USD',
        value: gasTotal,
        conversionRate,
        convertedPrefix: '$',
        readOnly: true,
      })
      : h('div.currency-display', 'Loading...')
    ,

    h('div.send-v2__sliders-icon-container', {
      onClick,
    }, [
      h('i.fa.fa-sliders.send-v2__sliders-icon'),
    ])

  ])
}

