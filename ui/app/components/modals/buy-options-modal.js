const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
const connect = require('../../metamask-connect')
const actions = require('../../actions')
const networkNames = require('../../../../app/scripts/config.js').networkNames
const t = require('../../../i18n-helper').getMessage

function mapStateToProps (state) {
  return {
    network: state.metamask.network,
    address: state.metamask.selectedAddress,
  }
}

function mapDispatchToProps (dispatch) {
  return {
    toCoinbase: (address) => {
      dispatch(actions.buyEth({ network: '1', address, amount: 0 }))
    },
    hideModal: () => {
      dispatch(actions.hideModal())
    },
    showAccountDetailModal: () => {
      dispatch(actions.showModal({ name: 'ACCOUNT_DETAILS' }))
    },
    toFaucet: network => dispatch(actions.buyEth({ network })),
  }
}

inherits(BuyOptions, Component)
function BuyOptions () {
  Component.call(this)
}

module.exports = connect(mapStateToProps, mapDispatchToProps)(BuyOptions)

BuyOptions.prototype.renderModalContentOption = function (title, header, onClick) {
  return h('div.buy-modal-content-option', {
    onClick,
  }, [
    h('div.buy-modal-content-option-title', {}, title),
    h('div.buy-modal-content-option-subtitle', {}, header),
  ])
}

BuyOptions.prototype.render = function () {
  const { network, toCoinbase, address, toFaucet } = this.props
  const isTestNetwork = ['3', '4', '42'].find(n => n === network)
  const networkName = networkNames[network]

  return h('div', {}, [
    h('div.buy-modal-content.transfers-subview', {
    }, [
      h('div.buy-modal-content-title-wrapper.flex-column.flex-center', {
        style: {},
      }, [
        h('div.buy-modal-content-title', {
          style: {},
        }, t(this.props.localeMessages, 'transfers')),
        h('div', {}, t(this.props.localeMessages, 'howToDeposit')),
      ]),

      h('div.buy-modal-content-options.flex-column.flex-center', {}, [

        isTestNetwork
          ? this.renderModalContentOption(networkName, t(this.props.localeMessages, 'testFaucet'), () => toFaucet(network))
          : this.renderModalContentOption('Coinbase', t(this.props.localeMessages, 'depositFiat'), () => toCoinbase(address)),

        // h('div.buy-modal-content-option', {}, [
        //   h('div.buy-modal-content-option-title', {}, 'Shapeshift'),
        //   h('div.buy-modal-content-option-subtitle', {}, 'Trade any digital asset for any other'),
        // ]),,

        this.renderModalContentOption(
          t(this.props.localeMessages, 'directDeposit'),
          t(this.props.localeMessages, 'depositFromAccount'),
          () => this.goToAccountDetailsModal()
        ),

      ]),

      h('button', {
        style: {
          background: 'white',
        },
        onClick: () => { this.props.hideModal() },
      }, h('div.buy-modal-content-footer#buy-modal-content-footer-text', {}, t(this.props.localeMessages, 'cancel'))),
    ]),
  ])
}

BuyOptions.prototype.goToAccountDetailsModal = function () {
  this.props.hideModal()
  this.props.showAccountDetailModal()
}
