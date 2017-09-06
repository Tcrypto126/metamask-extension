const assert = require('assert')
const PendingBalanceCalculator = require('../../app/scripts/lib/pending-balance-calculator')
const MockTxGen = require('../lib/mock-tx-gen')
const BN = require('ethereumjs-util').BN
let providerResultStub = {}

describe('PendingBalanceCalculator', function () {
  let nonceTracker

  describe('if you have no pending txs and one ether', function () {
    const ether = '0x' + (new BN(String(1e18))).toString(16)

    beforeEach(function () {
      nonceTracker = generateBalaneCalcWith([], ether)
    })

    it('returns the network balance', async function () {
      const result = await nonceTracker.getBalance()
      assert.equal(result, ether, `gave ${result} needed ${ether}`)
    })
  })
})

function generateBalaneCalcWith (transactions, providerStub = '0x0') {
  const getPendingTransactions = () => Promise.resolve(transactions)
  const getBalance = () => Promise.resolve(providerStub)
  providerResultStub.result = providerStub
  const provider = {
    sendAsync: (_, cb) => { cb(undefined, providerResultStub) },
    _blockTracker: {
      getCurrentBlock: () => '0x11b568',
    },
  }
  return new PendingBalanceCalculator({
    getBalance,
    getPendingTransactions,
  })
}
