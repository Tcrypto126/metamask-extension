const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
const formatBalance = require('../util').formatBalance

module.exports = EthBalanceComponent

inherits(EthBalanceComponent, Component)
function EthBalanceComponent () {
  Component.call(this)
}

EthBalanceComponent.prototype.render = function () {
  var state = this.props
  var style = state.style

  const value = formatBalance(state.value)

  return (

    h('.ether-balance', {
      style: style,
    }, [
      h('.ether-balance-amount', {
        style: {
          display: 'inline',
        },
      }, this.renderBalance(value)),
    ])

  )
}
EthBalanceComponent.prototype.renderBalance = function (value) {

  if (value === 'None') return value

  var balance = value.split(' ')[0]
  var label = value.split(' ')[1]

  return (
    h('.flex-column', {
      style: {
        alignItems: 'flex-end',
        lineHeight: '13px',
        fontFamily: 'Montserrat Thin',
        textRendering: 'geometricPrecision',
      },
    }, [
      h('div', balance),
      h('div', {
        style: {
          color: ' #AEAEAE',
          fontSize: '12px',
        },
      }, label),
    ])
  )
}
