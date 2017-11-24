const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
const isNode = require('detect-node')
const findDOMNode = require('react-dom').findDOMNode
const jazzicon = require('jazzicon')
const blockies = require('blockies')
const iconFactoryGen = require('../../lib/icon-factory')
const iconFactory = iconFactoryGen(jazzicon)

module.exports = IdenticonComponent

inherits(IdenticonComponent, Component)
function IdenticonComponent () {
  Component.call(this)

  this.defaultDiameter = 46
}

IdenticonComponent.prototype.render = function () {
  var props = this.props
  const { className = '', address, useBlockie } = props
  var diameter = props.diameter || this.defaultDiameter

  return address
    ? (
      h('div', {
        className: `${className} identicon`,
        key: 'identicon-' + address,
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: diameter,
          width: diameter,
          borderRadius: diameter / 2,
          overflow: 'hidden',
        },
      })
    )
    : (
      h('img.balance-icon', {
        src: '../images/eth_logo.svg',
        style: {
          height: diameter,
          width: diameter,
          borderRadius: diameter / 2,
        },
      })
    )
}

IdenticonComponent.prototype.componentDidMount = function () {
  var props = this.props
  const { address } = props

  if (!address) return

  // eslint-disable-next-line react/no-find-dom-node
  var container = findDOMNode(this)

  var diameter = props.diameter || this.defaultDiameter
  if (!isNode) {
    var img = iconFactory.iconForAddress(address, diameter)
    container.appendChild(img)
  }
}

IdenticonComponent.prototype.componentDidUpdate = function () {
  var props = this.props
  const { address } = props

  if (!address) return

  // eslint-disable-next-line react/no-find-dom-node
  var container = findDOMNode(this)

  var children = container.children
  for (var i = 0; i < children.length; i++) {
    container.removeChild(children[i])
  }

  var diameter = props.diameter || this.defaultDiameter
  if (!isNode) {
    var img = iconFactory.iconForAddress(address, diameter)
    container.appendChild(img)
  }
}

