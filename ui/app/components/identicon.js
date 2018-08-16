const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
const connect = require('react-redux').connect
const isNode = require('detect-node')
const findDOMNode = require('react-dom').findDOMNode
const jazzicon = require('jazzicon')
const iconFactoryGen = require('../../lib/icon-factory')
const iconFactory = iconFactoryGen(jazzicon)
const { toDataUrl } = require('../../lib/blockies')

module.exports = connect(mapStateToProps)(IdenticonComponent)

inherits(IdenticonComponent, Component)
function IdenticonComponent () {
  Component.call(this)

  this.defaultDiameter = 46
}

function mapStateToProps (state) {
  return {
    useBlockie: state.metamask.useBlockie,
  }
}

IdenticonComponent.prototype.render = function () {
  var props = this.props
  const { className = '', address, imageUrl } = props
  var diameter = props.diameter || this.defaultDiameter
  const style = {
    height: diameter,
    width: diameter,
    borderRadius: diameter / 2,
  }
  if (imageUrl) {
    return h('img', {
      className: `${className} identicon`,
      src: imageUrl,
      style: {
        ...style,
      },
    })
  } else if (address) {
    return h('div', {
      className: `${className} identicon`,
      key: 'identicon-' + address,
      style: {
        display: 'flex',
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
        overflow: 'hidden',
      },
    })
  } else {
    return h('img.balance-icon', {
      src: './images/eth_logo.svg',
      style: {
        ...style,
      },
    })
  }
}

IdenticonComponent.prototype.componentDidMount = function () {
  var props = this.props
  const { address, useBlockie } = props

  if (!address) return

  if (!isNode) {
    // eslint-disable-next-line react/no-find-dom-node
    var container = findDOMNode(this)

    const diameter = props.diameter || this.defaultDiameter

    if (useBlockie) {
      _generateBlockie(container, address, diameter)
    } else {
      _generateJazzicon(container, address, diameter)
    }
  }
}

IdenticonComponent.prototype.componentDidUpdate = function () {
  var props = this.props
  const { address, useBlockie } = props

  if (!address) return

  if (!isNode) {
    // eslint-disable-next-line react/no-find-dom-node
    var container = findDOMNode(this)

    var children = container.children
    for (var i = 0; i < children.length; i++) {
      container.removeChild(children[i])
    }

    const diameter = props.diameter || this.defaultDiameter

    if (useBlockie) {
      _generateBlockie(container, address, diameter)
    } else {
      _generateJazzicon(container, address, diameter)
    }
  }
}

function _generateBlockie (container, address, diameter) {
  const img = new Image()
  img.src = toDataUrl(address)
  img.height = diameter
  img.width = diameter
  container.appendChild(img)
}

function _generateJazzicon (container, address, diameter) {
  const img = iconFactory.iconForAddress(address, diameter)
  container.appendChild(img)
}
