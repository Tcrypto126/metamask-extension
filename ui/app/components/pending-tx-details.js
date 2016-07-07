const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits

const MiniAccountPanel = require('./mini-account-panel')
const addressSummary = require('../util').addressSummary
const formatBalance = require('../util').formatBalance
const nameForAddress = require('../../lib/contract-namer')
const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN

const baseGasFee = new BN('21000', 10)
const gasCost = new BN('4a817c800', 16)
const baseFeeHex = baseGasFee.mul(gasCost).toString(16)

module.exports = PendingTxDetails

inherits(PendingTxDetails, Component)
function PendingTxDetails () {
  Component.call(this)
}

const PTXP = PendingTxDetails.prototype

PTXP.render = function () {
  var props = this.props
  var txData = props.txData

  var txParams = txData.txParams || {}
  var address = txParams.from || props.selectedAddress
  var identity = props.identities[address] || { address: address }
  var balance = props.accounts[address].balance

  var gasCost = ethUtil.stripHexPrefix(txParams.gas || baseFeeHex)
  var txValue = ethUtil.stripHexPrefix(txParams.value || '0x0')
  var maxCost = ((new BN(txValue, 16)).add(new BN(gasCost, 16))).toString(16)
  var dataLength = txParams.data ? (txParams.data.length - 2) / 2 : 0

  return (
    h('div', [

      h('.flex-row.flex-center', {
        style: {
          maxWidth: '100%',
        },
      }, [

        h(MiniAccountPanel, {
          imageSeed: address,
          imageifyIdenticons: props.imageifyIdenticons,
          picOrder: 'right',
        }, [
          h('span.font-small', {
            style: {
              fontFamily: 'Montserrat Light, Montserrat, sans-serif',
            },
          }, identity.name),
          h('span.font-small', {
            style: {
              fontFamily: 'Montserrat Light, Montserrat, sans-serif',
            },
          }, addressSummary(address, 6, 4, false)),

          h('span.font-small', {
            style: {
              fontFamily: 'Montserrat Light, Montserrat, sans-serif',
            },
          }, formatBalance(balance)),

        ]),

        h('img', {
          src: 'images/forward-carrat.svg',
          style: {
            padding: '5px 6px 0px 10px',
            height: '48px',
          },
        }),

        this.miniAccountPanelForRecipient(),
      ]),

      h('style', `
        .table-box {
          margin: 7px 6px 0px 6px;
        }
        .table-box .row {
          margin: 0px;
          background: rgb(236,236,236);
          display: flex;
          justify-content: space-between;
          font-family: Montserrat Light, sans-serif;
          font-size: 13px;
          padding: 5px 15px;
        }
      `),

      h('.table-box', [

        h('.row', [
          h('.cell.label', 'Amount'),
          h('.cell.value', formatBalance(txParams.value)),
        ]),

        h('.cell.row', [
          h('.cell.label', 'Max Transaction Fee'),
          h('.cell.value', formatBalance(gasCost)),
        ]),

        h('.cell.row', {
          style: {
            fontFamily: 'Montserrat Regular',
            background: 'rgb(216,216,216)',
          },
        }, [
          h('.cell.label', 'Max Total'),
          h('.cell.value', formatBalance(maxCost)),
        ]),

        h('.cell.row', {
          style: {
            background: '#f7f7f7',
            paddingBottom: '0px',
          },
        }, [
          h('.cell.label'),
          h('.cell.value', `Data included: ${dataLength} bytes`),
        ]),
      ]), // End of Table

      this.warnIfNeeded(),

    ])
  )
}

PTXP.miniAccountPanelForRecipient = function () {
  var props = this.props
  var txData = props.txData
  var txParams = txData.txParams || {}
  var isContractDeploy = !('to' in txParams)

  // If it's not a contract deploy, send to the account
  if (!isContractDeploy) {
    return h(MiniAccountPanel, {
      imageSeed: txParams.to,
      imageifyIdenticons: props.imageifyIdenticons,
      picOrder: 'left',
    }, [
      h('span.font-small', {
        style: {
          fontFamily: 'Montserrat Light, Montserrat, sans-serif',
        },
      }, nameForAddress(txParams.to)),
      h('span.font-small', {
        style: {
          fontFamily: 'Montserrat Light, Montserrat, sans-serif',
        },
      }, addressSummary(txParams.to, 6, 4, false)),
    ])

  } else {
    return h(MiniAccountPanel, {
      imageifyIdenticons: props.imageifyIdenticons,
      picOrder: 'left',
    }, [

      h('span.font-small', {
        style: {
          fontFamily: 'Montserrat Light, Montserrat, sans-serif',
        },
      }, 'New Contract'),

    ])
  }
}

// Should analyze if there is a DELEGATECALL opcode
// in the recipient contract, and show a warning if so.
PTXP.warnIfNeeded = function () {
  const containsDelegateCall = !!this.props.txData.containsDelegateCall

  if (!containsDelegateCall) {
    return null
  }

  return h('span.error', {
    style: {
      fontFamily: 'Montserrat Light',
      fontSize: '13px',
      display: 'flex',
      justifyContent: 'center',
    },
  }, [
    h('i.fa.fa-lg.fa-info-circle', { style: { margin: '5px' } }),
    h('span', ' Your identity may be used in other contracts!'),
  ])
}
