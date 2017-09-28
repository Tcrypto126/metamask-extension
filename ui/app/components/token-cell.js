const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
const connect = require('react-redux').connect
const Identicon = require('./identicon')
const prefixForNetwork = require('../../lib/etherscan-prefix-for-network')
const selectors = require('../selectors')
const actions = require('../actions')
const { conversionUtil } = require('../conversion-util')

function mapStateToProps (state) {
  return {
    network: state.metamask.network,
    selectedTokenAddress: state.metamask.selectedTokenAddress,
    userAddress: selectors.getSelectedAddress(state),
    tokenExchangeRates: state.metamask.tokenExchangeRates,
    ethToUSDRate: state.metamask.conversionRate,
    sidebarOpen: state.appState.sidebarOpen,
  }
}

function mapDispatchToProps (dispatch) {
  return {
    setSelectedToken: address => dispatch(actions.setSelectedToken(address)),
    updateTokenExchangeRate: token => dispatch(actions.updateTokenExchangeRate(token)),
    hideSidebar: () => dispatch(actions.hideSidebar()),
  }
}

module.exports = connect(mapStateToProps, mapDispatchToProps)(TokenCell)

inherits(TokenCell, Component)
function TokenCell () {
  Component.call(this)
}

TokenCell.prototype.componentWillMount = function () {
  const {
    updateTokenExchangeRate,
    symbol,
  } = this.props

  updateTokenExchangeRate(symbol)
}

TokenCell.prototype.render = function () {
  const props = this.props
  const {
    address,
    symbol,
    string,
    network,
    setSelectedToken,
    selectedTokenAddress,
    tokenExchangeRates,
    ethToUSDRate,
    hideSidebar,
    sidebarOpen,
    // userAddress,
  } = props
  
  const pair = `${symbol.toLowerCase()}_eth`;

  let currentTokenToEthRate;
  let currentTokenInUSD;
  let formattedUSD = ''

  if (tokenExchangeRates[pair]) {
    currentTokenToEthRate = tokenExchangeRates[pair].rate;
    currentTokenInUSD = conversionUtil(string, {
      fromNumericBase: 'dec',
      fromCurrency: symbol,
      toCurrency: 'USD',
      numberOfDecimals: 2,
      conversionRate: currentTokenToEthRate,
      ethToUSDRate,
    })
    formattedUSD = `$${currentTokenInUSD} USD`;
  }
 
  return (
    h('div.token-list-item', {
      className: `token-list-item ${selectedTokenAddress === address ? 'token-list-item--active' : ''}`,
      // style: { cursor: network === '1' ? 'pointer' : 'default' },
      // onClick: this.view.bind(this, address, userAddress, network),
      onClick: () => {
        setSelectedToken(address)
        selectedTokenAddress !== address && sidebarOpen && hideSidebar()
      },
    }, [

      h(Identicon, {
        className: 'token-list-item__identicon',
        diameter: 45,
        address,
        network,
      }),

      h('h.token-list-item__balance-wrapper', null, [
        h('h3.token-list-item__token-balance', `${string || 0} ${symbol}`),

        h('div.token-list-item__fiat-amount', {
          style: {},
        }, formattedUSD),
      ]),

      /*
      h('button', {
        onClick: this.send.bind(this, address),
      }, 'SEND'),
      */

    ])
  )
}

TokenCell.prototype.send = function (address, event) {
  event.preventDefault()
  event.stopPropagation()
  const url = tokenFactoryFor(address)
  if (url) {
    navigateTo(url)
  }
}

TokenCell.prototype.view = function (address, userAddress, network, event) {
  const url = etherscanLinkFor(address, userAddress, network)
  if (url) {
    navigateTo(url)
  }
}

function navigateTo (url) {
  global.platform.openWindow({ url })
}

function etherscanLinkFor (tokenAddress, address, network) {
  const prefix = prefixForNetwork(network)
  return `https://${prefix}etherscan.io/token/${tokenAddress}?a=${address}`
}

function tokenFactoryFor (tokenAddress) {
  return `https://tokenfactory.surge.sh/#/token/${tokenAddress}`
}

