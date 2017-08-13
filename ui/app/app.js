const inherits = require('util').inherits
const Component = require('react').Component
const connect = require('react-redux').connect
const h = require('react-hyperscript')
const actions = require('./actions')
// init
const InitializeMenuScreen = require('./first-time/init-menu')
const NewKeyChainScreen = require('./new-keychain')
// unlock
const UnlockScreen = require('./unlock')
// accounts
const MainContainer = require('./main-container')
const SendTransactionScreen = require('./send')
const ConfirmTxScreen = require('./conf-tx')
// notice
const NoticeScreen = require('./components/notice')
const generateLostAccountsNotice = require('../lib/lost-accounts-notice')

// slideout menu
const WalletView = require('./components/wallet-view')

// other views
const ConfigScreen = require('./config')
const AddTokenScreen = require('./add-token')
const Import = require('./accounts/import')
const InfoScreen = require('./info')
const Loading = require('./components/loading')
const SandwichExpando = require('sandwich-expando')
const Dropdown = require('./components/dropdown').Dropdown
const DropdownMenuItem = require('./components/dropdown').DropdownMenuItem
const NetworkIndicator = require('./components/network')
const BuyView = require('./components/buy-button-subview')
const QrView = require('./components/qr-code')
const HDCreateVaultComplete = require('./keychains/hd/create-vault-complete')
const HDRestoreVaultScreen = require('./keychains/hd/restore-vault')
const RevealSeedConfirmation = require('./keychains/hd/recover-seed/confirmation')
const ReactCSSTransitionGroup = require('react-addons-css-transition-group')
const AccountDropdowns = require('./components/account-dropdowns').AccountDropdowns
const NetworkDropdown = require('./components/dropdowns/network-dropdown')

// Global Modals
const BuyModal = require('./components/modals/index').BuyModal

module.exports = connect(mapStateToProps, mapDispatchToProps)(App)

inherits(App, Component)
function App () { Component.call(this) }

function mapStateToProps (state) {
  const {
    identities,
    accounts,
    address,
  } = state.metamask
  const selected = address || Object.keys(accounts)[0]

  return {
    // state from plugin
    networkDropdownOpen: state.appState.networkDropdownOpen,
    sidebarOpen: state.appState.sidebarOpen,
    isLoading: state.appState.isLoading,
    loadingMessage: state.appState.loadingMessage,
    noActiveNotices: state.metamask.noActiveNotices,
    isInitialized: state.metamask.isInitialized,
    isUnlocked: state.metamask.isUnlocked,
    currentView: state.appState.currentView,
    activeAddress: state.appState.activeAddress,
    transForward: state.appState.transForward,
    seedWords: state.metamask.seedWords,
    unapprovedTxs: state.metamask.unapprovedTxs,
    unapprovedMsgs: state.metamask.unapprovedMsgs,
    menuOpen: state.appState.menuOpen,
    network: state.metamask.network,
    provider: state.metamask.provider,
    forgottenPassword: state.appState.forgottenPassword,
    lastUnreadNotice: state.metamask.lastUnreadNotice,
    lostAccounts: state.metamask.lostAccounts,
    frequentRpcList: state.metamask.frequentRpcList || [],

    // state needed to get account dropdown temporarily rendering from app bar
    identities,
    selected,
  }
}

function mapDispatchToProps (dispatch, ownProps) {
  return {
    hideSidebar: () => {dispatch(actions.hideSidebar())},
    showNetworkDropdown: () => {dispatch(actions.showNetworkDropdown())},
    hideNetworkDropdown: () => {dispatch(actions.hideNetworkDropdown())},
  }
}

App.prototype.render = function () {
  var props = this.props
  const { isLoading, loadingMessage, transForward, network, sidebarOpen } = props
  const isLoadingNetwork = network === 'loading' && props.currentView.name !== 'config'
  const loadMessage = loadingMessage || isLoadingNetwork ?
    `Connecting to ${this.getNetworkName()}` : null
  log.debug('Main ui render function')

  return (

    h('.flex-column.full-height', {
      style: {
        overflowX: 'hidden',
        position: 'relative',
        alignItems: 'center',
      },
    }, [

      // global modal
      h(BuyModal, {}, []),

      // app bar
      this.renderAppBar(),

      // sidebar
      this.renderSidebar(),

      // network dropdown
      h(NetworkDropdown, {
        provider: this.props.provider,
        frequentRpcList: this.props.frequentRpcList,
      }, []),

      h(Loading, {
        isLoading: isLoading || isLoadingNetwork,
        loadingMessage: loadMessage,
      }),

      // content
      this.renderPrimary(),
    ])
  )
}

App.prototype.renderGlobalModal = function() {
  return h(Modal, {
    ref: "modalRef",
  }, [
    h(BuyOptions, {}, []),
  ])
}

App.prototype.renderSidebar = function() {

  return h('div', {
  }, [
    h('style', `
      .sidebar-enter {
        transition: transform 300ms ease-in-out;
        transform: translateX(-100%);
      }
      .sidebar-enter.sidebar-enter-active {
        transition: transform 300ms ease-in-out;
        transform: translateX(0%);
      }
      .sidebar-leave {
        transition: transform 200ms ease-out;
        transform: translateX(0%);
      }
      .sidebar-leave.sidebar-leave-active {
        transition: transform 200ms ease-out;
        transform: translateX(-100%);
      }
    `),

    h(ReactCSSTransitionGroup, {
      transitionName: 'sidebar',
      transitionEnterTimeout: 300,
      transitionLeaveTimeout: 200,
    }, [
      // A second instance of Walletview is used for non-mobile viewports
      this.props.sidebarOpen ? h(WalletView, {
        responsiveDisplayClassname: '.sidebar',
        style: {},
      }) : undefined,

    ]),

    // overlay
    // TODO: add onClick for overlay to close sidebar
    this.props.sidebarOpen ? h('div.sidebar-overlay', {
      style: {},
      onClick: () => {
        this.props.hideSidebar()
      },
    }, []) : undefined,
  ])
}

App.prototype.renderAppBar = function () {
  if (window.METAMASK_UI_TYPE === 'notification') {
    return null
  }

  const props = this.props
  const state = this.state || {}
  const isNetworkMenuOpen = state.isNetworkMenuOpen || false

  return (

    h('.full-width', {
      style: {}
    }, [

      h('.app-header.flex-row.flex-space-between', {
        style: {},
      }, [

        h('div.left-menu-wrapper', {
          style: {},
        }, [
          // mini logo
          h('img', {
            height: 24,
            width: 24,
            src: '/images/icon-128.png',
          }),

          // metamask name
          h('h1', {
            style: {
              position: 'relative',
              left: '9px',
            },
          }, 'MetaMask'),

        ]),

        h('div.network-component-wrapper', {
          style: {},
        }, [
          // Network Indicator
          h(NetworkIndicator, {
            network: this.props.network,
            provider: this.props.provider,
            onClick: (event) => {
              event.preventDefault()
              event.stopPropagation()
              if (this.props.networkDropdownOpen === false) {
                this.props.showNetworkDropdown()
              } else {
                this.props.hideNetworkDropdown()
              }
            },
          }),

        ]),
      ]),

    ])
  )
}

App.prototype.renderBackButton = function (style, justArrow = false) {
  var props = this.props
  return (
    h('.flex-row', {
      key: 'leftArrow',
      style: style,
      onClick: () => props.dispatch(actions.goBackToInitView()),
    }, [
      h('i.fa.fa-arrow-left.cursor-pointer'),
      justArrow ? null : h('div.cursor-pointer', {
        style: {
          marginLeft: '3px',
        },
        onClick: () => props.dispatch(actions.goBackToInitView()),
      }, 'BACK'),
    ])
  )
}

App.prototype.renderPrimary = function () {
  log.debug('rendering primary')
  var props = this.props

  // notices
  if (!props.noActiveNotices) {
    log.debug('rendering notice screen for unread notices.')
    return h(NoticeScreen, {
      notice: props.lastUnreadNotice,
      key: 'NoticeScreen',
      onConfirm: () => props.dispatch(actions.markNoticeRead(props.lastUnreadNotice)),
    })
  } else if (props.lostAccounts && props.lostAccounts.length > 0) {
    log.debug('rendering notice screen for lost accounts view.')
    return h(NoticeScreen, {
      notice: generateLostAccountsNotice(props.lostAccounts),
      key: 'LostAccountsNotice',
      onConfirm: () => props.dispatch(actions.markAccountsFound()),
    })
  }

  if (props.seedWords) {
    log.debug('rendering seed words')
    return h(HDCreateVaultComplete, {key: 'HDCreateVaultComplete'})
  }

  // show initialize screen
  if (!props.isInitialized || props.forgottenPassword) {
    // show current view
    log.debug('rendering an initialize screen')
    switch (props.currentView.name) {

      case 'restoreVault':
        log.debug('rendering restore vault screen')
        return h(HDRestoreVaultScreen, {key: 'HDRestoreVaultScreen'})

      default:
        log.debug('rendering menu screen')
        return h(InitializeMenuScreen, {key: 'menuScreenInit'})
    }
  }

  // show unlock screen
  if (!props.isUnlocked) {
    return h(MainContainer, {
      currentViewName: props.currentView.name,
      isUnlocked: props.isUnlocked,
    })
  }

  // show current view
  switch (props.currentView.name) {

    case 'accountDetail':
      log.debug('rendering main container')
      return h(MainContainer, {key: 'account-detail'})

    case 'sendTransaction':
      log.debug('rendering send tx screen')
      return h(SendTransactionScreen, {key: 'send-transaction'})

    case 'newKeychain':
      log.debug('rendering new keychain screen')
      return h(NewKeyChainScreen, {key: 'new-keychain'})

    case 'confTx':
      log.debug('rendering confirm tx screen')
      return h(ConfirmTxScreen, {key: 'confirm-tx'})

    case 'add-token':
      log.debug('rendering add-token screen from unlock screen.')
      return h(AddTokenScreen, {key: 'add-token'})

    case 'config':
      log.debug('rendering config screen')
      return h(ConfigScreen, {key: 'config'})

    case 'import-menu':
      log.debug('rendering import screen')
      return h(Import, {key: 'import-menu'})

    case 'reveal-seed-conf':
      log.debug('rendering reveal seed confirmation screen')
      return h(RevealSeedConfirmation, {key: 'reveal-seed-conf'})

    case 'info':
      log.debug('rendering info screen')
      return h(InfoScreen, {key: 'info'})

    case 'buyEth':
      log.debug('rendering buy ether screen')
      return h(BuyView, {key: 'buyEthView'})

    case 'qr':
      log.debug('rendering show qr screen')
      return h('div', {
        style: {
          position: 'absolute',
          height: '100%',
          top: '0px',
          left: '0px',
        },
      }, [
        h('i.fa.fa-arrow-left.fa-lg.cursor-pointer.color-orange', {
          onClick: () => props.dispatch(actions.backToAccountDetail(props.activeAddress)),
          style: {
            marginLeft: '10px',
            marginTop: '50px',
          },
        }),
        h('div', {
          style: {
            position: 'absolute',
            left: '44px',
            width: '285px',
          },
        }, [
          h(QrView, {key: 'qr'}),
        ]),
      ])

    default:
      log.debug('rendering default, account detail screen')
      return h(MainContainer, {key: 'account-detail'})
  }
}

App.prototype.toggleMetamaskActive = function () {
  if (!this.props.isUnlocked) {
    // currently inactive: redirect to password box
    var passwordBox = document.querySelector('input[type=password]')
    if (!passwordBox) return
    passwordBox.focus()
  } else {
    // currently active: deactivate
    this.props.dispatch(actions.lockMetamask(false))
  }
}

App.prototype.getNetworkName = function () {
  const { provider } = this.props
  const providerName = provider.type

  let name

  if (providerName === 'mainnet') {
    name = 'Main Ethereum Network'
  } else if (providerName === 'ropsten') {
    name = 'Ropsten Test Network'
  } else if (providerName === 'kovan') {
    name = 'Kovan Test Network'
  } else if (providerName === 'rinkeby') {
    name = 'Rinkeby Test Network'
  } else {
    name = 'Unknown Private Network'
  }

  return name
}
