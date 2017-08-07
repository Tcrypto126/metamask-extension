const Component = require('react').Component
const connect = require('react-redux').connect
const h = require('react-hyperscript')
const inherits = require('util').inherits
const actions = require('../actions')
// slideout menu
const WalletView = require('./wallet-view')

const Identicon = require('./identicon')
// const AccountDropdowns = require('./account-dropdowns').AccountDropdowns
// const Content = require('./wallet-content-display')

module.exports = connect(mapStateToProps, mapDispatchToProps)(TxView)

function mapStateToProps (state) {
  return {
    sidebarOpen: state.appState.sidebarOpen,
  }
}

function mapDispatchToProps (dispatch) {
  return {
    showSidebar: () => {dispatch(actions.showSidebar())},
    hideSidebar: () => {dispatch(actions.hideSidebar())},
  }
}

const contentDivider = h('div', {
  style: {
    marginLeft: '1.3em',
    marginRight: '1.3em',
    height:'1px',
    background:'#E7E7E7', // TODO: make custom color
  },
})

inherits(TxView, Component)
function TxView () {
  Component.call(this)
}

TxView.prototype.render = function () {
  const selected = '0x82df11beb942BEeeD58d466fCb0F0791365C7684' // TODO: remove fake address

  return h('div.tx-view.flex-column', {
    style: {
      flex: '62 0 62%',
      background: '#FFFFFF',
    }
  }, [

    h('div.flex-row.phone-visible', {
      style: {
        margin: '1em 0.9em',
        alignItems: 'center'
      },
      onClick: () => {
        this.props.sidebarOpen ? this.props.hideSidebar() : this.props.showSidebar()
      },
    }, [
      // burger
      h('div.fa.fa-bars', {
        style: {
          fontSize: '1.3em',
        },
      }, []),

      //account display
      h('.identicon-wrapper.select-none', {
        style: {
          marginLeft: '0.9em',
        },
      }, [
        h(Identicon, {
          diameter: 24,
          address: selected,
        }),
      ]),

      h('span.account-name', {
        style: {}
      }, [
        'Account 1'
      ]),

    ]),

    // laptop: flex-row, flex-center
    // mobile: flex-column
    h('div.hero-balance', {
      style: {},
    }, [

      // laptop: 50px 50px
      // mobile: 100px 100px
      h('img.hero-balance-icon', {
        src: '../images/eth_logo.svg',
        style: {}
      }),

      // laptop: 5vw?
      // phone: 50vw?
      h('div.flex-column.hero-balance-display', {}, [
        h('div.token-amount', {
          style: {}
        }, '1001.124 ETH'),

        h('div.fiat-amount', {
          style: {}
        }, '$300,000 USD'),
      ]),

      // laptop: 10vw?
      // phone: 75vw?
      h('div.flex-row.flex-center.hero-balance-buttons', {
        style: {}
      }, [
        h('button.btn-clear', {
          style: {
            textAlign: 'center',
          },
        }, 'BUY'),

        h('button.btn-clear', {
          style: {
            textAlign: 'center',
            marginLeft: '1.4em',
          },
        }, 'SEND'),

      ]),
    ]),

    h('div.flex-row', {
      style: {
        margin: '1.8em 0.9em 0.8em 0.9em',
      }
    }, [

      // tx-view-tab.js
      h('div.flex-row', {
      }, [

        h('div', {
          style: {
            borderBottom: '0.07em solid black',
            paddingBottom: '0.015em',
          }
        }, 'TRANSACTIONS'),

        h('div', {
          style: {
            marginLeft: '1.25em',
          }
        }, 'TOKENS'),

      ]),
    ]),

    contentDivider,

    this.renderTransactionListItem(),

    contentDivider,

    this.renderTransactionListItem(),

    contentDivider,

  ])
  // column
  // tab row
  // divider
  // item
}

TxView.prototype.renderTransactionListItem = function () {
  return h('div.flex-column', {
    style: {
      alignItems: 'stretch',
      margin: '0.6em 1.3em 0.6em 1.3em',
    }
  }, [

    h('div', {
      style: {
        flexGrow: 1,
        marginTop: '0.3em',
      }
    }, 'Jul 01, 2017'),

    h('div.flex-row', {
      style: {
        alignItems: 'stretch',
      }
    }, [

      h('div', {
        style: {
          flexGrow: 1,
        }
      }, 'icon'),

      h('div', {
        style: {
          flexGrow: 3,
        }
      }, 'Hash'),

      h('div', {
        style: {
          flexGrow: 5,
        }
      }, 'Status'),

      h('div', {
        style: {
          flexGrow: 2,
        }
      }, 'Details'),

    ])

  ])
}


