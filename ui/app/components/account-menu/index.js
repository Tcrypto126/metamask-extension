const inherits = require('util').inherits
const Component = require('react').Component
const connect = require('react-redux').connect
const { compose } = require('recompose')
const { withRouter } = require('react-router-dom')
const PropTypes = require('prop-types')
const h = require('react-hyperscript')
const actions = require('../../actions')
const { Menu, Item, Divider, CloseArea } = require('../dropdowns/components/menu')
const Identicon = require('../identicon')
const { formatBalance } = require('../../util')
const { ENVIRONMENT_TYPE_POPUP } = require('../../../../app/scripts/lib/enums')
const { getEnvironmentType } = require('../../../../app/scripts/lib/util')


const {
  SETTINGS_ROUTE,
  INFO_ROUTE,
  NEW_ACCOUNT_ROUTE,
  IMPORT_ACCOUNT_ROUTE,
  CONNECT_HARDWARE_ROUTE,
  DEFAULT_ROUTE,
} = require('../../routes')

module.exports = compose(
  withRouter,
  connect(mapStateToProps, mapDispatchToProps)
)(AccountMenu)

AccountMenu.contextTypes = {
  t: PropTypes.func,
}

inherits(AccountMenu, Component)
function AccountMenu () { Component.call(this) }

function mapStateToProps (state) {
  return {
    selectedAddress: state.metamask.selectedAddress,
    isAccountMenuOpen: state.metamask.isAccountMenuOpen,
    keyrings: state.metamask.keyrings,
    identities: state.metamask.identities,
    accounts: state.metamask.accounts,
  }
}

function mapDispatchToProps (dispatch) {
  return {
    toggleAccountMenu: () => dispatch(actions.toggleAccountMenu()),
    showAccountDetail: address => {
      dispatch(actions.showAccountDetail(address))
      dispatch(actions.hideSidebar())
      dispatch(actions.toggleAccountMenu())
    },
    lockMetamask: () => {
      dispatch(actions.lockMetamask())
      dispatch(actions.hideWarning())
      dispatch(actions.hideSidebar())
      dispatch(actions.toggleAccountMenu())
    },
    showConfigPage: () => {
      dispatch(actions.showConfigPage())
      dispatch(actions.hideSidebar())
      dispatch(actions.toggleAccountMenu())
    },
    showInfoPage: () => {
      dispatch(actions.showInfoPage())
      dispatch(actions.hideSidebar())
      dispatch(actions.toggleAccountMenu())
    },
    showForgetAccountConfirmationModal: (address) => {
      return dispatch(actions.showModal({ name: 'CONFIRM_FORGET_ACCOUNT', address }))
    },
  }
}

AccountMenu.prototype.render = function () {
  const {
    isAccountMenuOpen,
    toggleAccountMenu,
    lockMetamask,
    history,
  } = this.props

  return h(Menu, { className: 'account-menu', isShowing: isAccountMenuOpen }, [
    h(CloseArea, { onClick: toggleAccountMenu }),
    h(Item, {
      className: 'account-menu__header',
    }, [
      this.context.t('myAccounts'),
      h('button.account-menu__logout-button', {
        onClick: () => {
          lockMetamask()
          history.push(DEFAULT_ROUTE)
        },
      }, this.context.t('logout')),
    ]),
    h(Divider),
    h('div.account-menu__accounts', this.renderAccounts()),
    h(Divider),
    h(Item, {
      onClick: () => {
        toggleAccountMenu()
        history.push(NEW_ACCOUNT_ROUTE)
      },
      icon: h('img.account-menu__item-icon', { src: 'images/plus-btn-white.svg' }),
      text: this.context.t('createAccount'),
    }),
    h(Item, {
      onClick: () => {
        toggleAccountMenu()
        history.push(IMPORT_ACCOUNT_ROUTE)
      },
      icon: h('img.account-menu__item-icon', { src: 'images/import-account.svg' }),
      text: this.context.t('importAccount'),
    }),
    h(Item, {
      onClick: () => {
        toggleAccountMenu()
        if (getEnvironmentType(window.location.href) === ENVIRONMENT_TYPE_POPUP) {
          global.platform.openExtensionInBrowser(CONNECT_HARDWARE_ROUTE)
        } else {
          history.push(CONNECT_HARDWARE_ROUTE)
        }
      },
      icon: h('img.account-menu__item-icon', { src: 'images/connect-icon.svg' }),
      text: this.context.t('connectHardware'),
    }),
    h(Divider),
    h(Item, {
      onClick: () => {
        toggleAccountMenu()
        history.push(INFO_ROUTE)
      },
      icon: h('img', { src: 'images/mm-info-icon.svg' }),
      text: this.context.t('infoHelp'),
    }),
    h(Item, {
      onClick: () => {
        toggleAccountMenu()
        history.push(SETTINGS_ROUTE)
      },
      icon: h('img.account-menu__item-icon', { src: 'images/settings.svg' }),
      text: this.context.t('settings'),
    }),
  ])
}

AccountMenu.prototype.renderAccounts = function () {
  const {
    identities,
    accounts,
    selectedAddress,
    keyrings,
    showAccountDetail,
  } = this.props

  const accountOrder = keyrings.reduce((list, keyring) => list.concat(keyring.accounts), [])
  return accountOrder.map((address) => {
    const identity = identities[address]
    const isSelected = identity.address === selectedAddress

    const balanceValue = accounts[address] ? accounts[address].balance : ''
    const formattedBalance = balanceValue ? formatBalance(balanceValue, 6) : '...'
    const simpleAddress = identity.address.substring(2).toLowerCase()

    const keyring = keyrings.find((kr) => {
      return kr.accounts.includes(simpleAddress) ||
        kr.accounts.includes(identity.address)
    })

    return h(
      'div.account-menu__account.menu__item--clickable',
      { onClick: () => showAccountDetail(identity.address) },
      [
        h('div.account-menu__check-mark', [
          isSelected ? h('div.account-menu__check-mark-icon') : null,
        ]),

        h(
          Identicon,
          {
            address: identity.address,
            diameter: 24,
          },
        ),

        h('div.account-menu__account-info', [
          h('div.account-menu__name', identity.name || ''),
          h('div.account-menu__balance', formattedBalance),
        ]),

        this.renderKeyringType(keyring),
        this.renderForgetAccount(keyring, identity.address),
      ],
    )
  })
}

AccountMenu.prototype.renderForgetAccount = function (keyring, address) {
  // Any account that's not form the HD wallet can be forgotten
  const type = keyring.type
  const isForgetable = type !== 'HD Key Tree'
  return isForgetable ? h('a.forget-account-icon', { onClick: (e) => this.forgetAccount(e, address) }, '') : null
}

AccountMenu.prototype.forgetAccount = function (e, address) {
  e.preventDefault()
  e.stopPropagation()
  const { showForgetAccountConfirmationModal } = this.props
  console.log('should forget address: ', address)
  showForgetAccountConfirmationModal(address)
}

AccountMenu.prototype.renderKeyringType = function (keyring) {
  try { // Sometimes keyrings aren't loaded yet:
    const type = keyring.type
    let label
    switch (type) {
      case 'Trezor Hardware':
        label = this.context.t('hardware')
      break
      case 'Simple Key Pair':
        label = this.context.t('imported')
      break
      default:
        label = ''
    }

    return label !== '' ? h('.keyring-label.allcaps', label) : null

  } catch (e) { return }
}
