const EventEmitter = require('events')
const extend = require('xtend')
const clone = require('clone')
const ObservableStore = require('obs-store')
const ethUtil = require('ethereumjs-util')
const EthQuery = require('ethjs-query')
const TxProviderUtil = require('../lib/tx-utils')
const getStack = require('../lib/util').getStack
const createId = require('../lib/random-id')
const NonceTracker = require('../lib/nonce-tracker')

module.exports = class TransactionController extends EventEmitter {
  constructor (opts) {
    super()
    this.store = new ObservableStore(extend({
      transactions: [],
    }, opts.initState))
    this.memStore = new ObservableStore({})
    this.networkStore = opts.networkStore || new ObservableStore({})
    this.preferencesStore = opts.preferencesStore || new ObservableStore({})
    this.txHistoryLimit = opts.txHistoryLimit
    this.provider = opts.provider
    this.blockTracker = opts.blockTracker
    this.nonceTracker = new NonceTracker({
      provider: this.provider,
      getPendingTransactions: (address) => {
        return this.getFilteredTxList({
          from: address,
          status: 'submitted',
          err: undefined,
        })
      },
    })
    this.query = new EthQuery(this.provider)
    this.txProviderUtils = new TxProviderUtil(this.query)
    this.blockTracker.on('rawBlock', this.checkForTxInBlock.bind(this))
    // this is a little messy but until ethstore has been either
    // removed or redone this is to guard against the race condition
    // where ethStore hasent been populated by the results yet
    this.blockTracker.once('latest', () => this.blockTracker.on('latest', this.resubmitPendingTxs.bind(this)))
    this.blockTracker.on('sync', this.queryPendingTxs.bind(this))
    this.signEthTx = opts.signTransaction
    this.ethStore = opts.ethStore
    // memstore is computed from a few different stores
    this._updateMemstore()
    this.store.subscribe(() => this._updateMemstore())
    this.networkStore.subscribe(() => this._updateMemstore())
    this.preferencesStore.subscribe(() => this._updateMemstore())
  }

  getState () {
    return this.memStore.getState()
  }

  getNetwork () {
    return this.networkStore.getState()
  }

  getSelectedAddress () {
    return this.preferencesStore.getState().selectedAddress
  }

  // Returns the number of txs for the current network.
  getTxCount () {
    return this.getTxList().length
  }

  // Returns the full tx list across all networks
  getFullTxList () {
    return this.store.getState().transactions
  }

  get unapprovedTxCount () {
    return Object.keys(this.getUnapprovedTxList()).length
  }

  get pendingTxCount () {
    return this.getTxsByMetaData('status', 'signed').length
  }

  // Returns the tx list
  getTxList () {
    const network = this.getNetwork()
    const fullTxList = this.getFullTxList()
    return this.getTxsByMetaData('metamaskNetworkId', network, fullTxList)
  }

  // gets tx by Id and returns it
  getTx (txId) {
    const txList = this.getTxList()
    const txMeta = txList.find(txData => txData.id === txId)
    return txMeta
  }
  getUnapprovedTxList () {
    let txList = this.getTxList()
    return txList.filter((txMeta) => txMeta.status === 'unapproved')
    .reduce((result, tx) => {
      result[tx.id] = tx
      return result
    }, {})
  }

  updateTx (txMeta) {
    // create txMeta snapshot for history
    const txMetaForHistory = clone(txMeta)
    // dont include previous history in this snapshot
    delete txMetaForHistory.history
    // add stack to help understand why tx was updated
    txMetaForHistory.stack = getStack()
    // add snapshot to tx history
    if (!txMeta.history) txMeta.history = []
    txMeta.history.push(txMetaForHistory)

    const txId = txMeta.id
    const txList = this.getFullTxList()
    const index = txList.findIndex(txData => txData.id === txId)
    if (!txMeta.history) txMeta.history = []
    txMeta.history.push(txMetaForHistory)

    txList[index] = txMeta
    this._saveTxList(txList)
    this.emit('update')
  }

  // Adds a tx to the txlist
  addTx (txMeta) {
    const txCount = this.getTxCount()
    const network = this.getNetwork()
    const fullTxList = this.getFullTxList()
    const txHistoryLimit = this.txHistoryLimit

    // checks if the length of the tx history is
    // longer then desired persistence limit
    // and then if it is removes only confirmed
    // or rejected tx's.
    // not tx's that are pending or unapproved
    if (txCount > txHistoryLimit - 1) {
      let index = fullTxList.findIndex((metaTx) => ((metaTx.status === 'confirmed' || metaTx.status === 'rejected') && network === txMeta.metamaskNetworkId))
      fullTxList.splice(index, 1)
    }
    fullTxList.push(txMeta)
    this._saveTxList(fullTxList)
    this.emit('update')

    this.once(`${txMeta.id}:signed`, function (txId) {
      this.removeAllListeners(`${txMeta.id}:rejected`)
    })
    this.once(`${txMeta.id}:rejected`, function (txId) {
      this.removeAllListeners(`${txMeta.id}:signed`)
    })

    this.emit('updateBadge')
    this.emit(`${txMeta.id}:unapproved`, txMeta)
  }

  async addUnapprovedTransaction (txParams) {
    // validate
    await this.txProviderUtils.validateTxParams(txParams)
    // construct txMeta
    const txMeta = {
      id: createId(),
      time: (new Date()).getTime(),
      status: 'unapproved',
      metamaskNetworkId: this.getNetwork(),
      txParams: txParams,
      history: [],
    }
    // add default tx params
    await this.addTxDefaults(txMeta)
    // save txMeta
    this.addTx(txMeta)
    return txMeta
  }

  async addTxDefaults (txMeta) {
    const txParams = txMeta.txParams
    // ensure value
    txParams.value = txParams.value || '0x0'
    if (!txParams.gasPrice) {
      const gasPrice = await this.query.gasPrice()
      txParams.gasPrice = gasPrice
    }
    // set gasLimit
    return await this.txProviderUtils.analyzeGasUsage(txMeta)
  }

  async updateAndApproveTransaction (txMeta) {
    this.updateTx(txMeta)
    await this.approveTransaction(txMeta.id)
  }

  async approveTransaction (txId) {
    let nonceLock
    try {
      // approve
      this.setTxStatusApproved(txId)
      // get next nonce
      const txMeta = this.getTx(txId)
      const fromAddress = txMeta.txParams.from
      // wait for a nonce
      nonceLock = await this.nonceTracker.getNonceLock(fromAddress)
      // add nonce to txParams
      txMeta.txParams.nonce = nonceLock.nextNonce
      // add nonce debugging information to txMeta
      txMeta.nonceDetails = nonceLock.nonceDetails
      this.updateTx(txMeta)
      // sign transaction
      const rawTx = await this.signTransaction(txId)
      await this.publishTransaction(txId, rawTx)
      // must set transaction to submitted/failed before releasing lock
      nonceLock.releaseLock()
    } catch (err) {
      this.setTxStatusFailed(txId, {
        stack: err.stack || err.message,
        errCode: err.errCode || err,
        message: err.message || 'Transaction failed during approval',
      })
      // must set transaction to submitted/failed before releasing lock
      if (nonceLock) nonceLock.releaseLock()
      // continue with error chain
      throw err
    }
  }

  async signTransaction (txId) {
    const txMeta = this.getTx(txId)
    const txParams = txMeta.txParams
    const fromAddress = txParams.from
    // add network/chain id
    txParams.chainId = this.getChainId()
    const ethTx = this.txProviderUtils.buildEthTxFromParams(txParams)
    const rawTx = await this.signEthTx(ethTx, fromAddress).then(() => {
      this.setTxStatusSigned(txMeta.id)
      return ethUtil.bufferToHex(ethTx.serialize())
    })
    return rawTx
  }

  async publishTransaction (txId, rawTx) {
    const txMeta = this.getTx(txId)
    txMeta.rawTx = rawTx
    this.updateTx(txMeta)
    await this.txProviderUtils.publishTransaction(rawTx).then((txHash) => {
      this.setTxHash(txId, txHash)
      this.setTxStatusSubmitted(txId)
    })
  }

  cancelTransaction (txId) {
    this.setTxStatusRejected(txId)
    return Promise.resolve()
  }


  getChainId () {
    const networkState = this.networkStore.getState()
    const getChainId = parseInt(networkState)
    if (Number.isNaN(getChainId)) {
      return 0
    } else {
      return getChainId
    }
  }

  // receives a txHash records the tx as signed
  setTxHash (txId, txHash) {
    // Add the tx hash to the persisted meta-tx object
    const txMeta = this.getTx(txId)
    txMeta.hash = txHash
    this.updateTx(txMeta)
  }

  /*
  Takes an object of fields to search for eg:
  let thingsToLookFor = {
    to: '0x0..',
    from: '0x0..',
    status: 'signed',
    err: undefined,
  }
  and returns a list of tx with all
  options matching

  ****************HINT****************
  | `err: undefined` is like looking |
  | for a tx with no err             |
  | so you can also search txs that  |
  | dont have something as well by   |
  | setting the value as undefined   |
  ************************************

  this is for things like filtering a the tx list
  for only tx's from 1 account
  or for filltering for all txs from one account
  and that have been 'confirmed'
  */
  getFilteredTxList (opts) {
    let filteredTxList
    Object.keys(opts).forEach((key) => {
      filteredTxList = this.getTxsByMetaData(key, opts[key], filteredTxList)
    })
    return filteredTxList
  }

  getTxsByMetaData (key, value, txList = this.getTxList()) {
    return txList.filter((txMeta) => {
      if (txMeta.txParams[key]) {
        return txMeta.txParams[key] === value
      } else {
        return txMeta[key] === value
      }
    })
  }

  // STATUS METHODS
  // get::set status

  // should return the status of the tx.
  getTxStatus (txId) {
    const txMeta = this.getTx(txId)
    return txMeta.status
  }

  // should update the status of the tx to 'rejected'.
  setTxStatusRejected (txId) {
    this._setTxStatus(txId, 'rejected')
  }

  // should update the status of the tx to 'approved'.
  setTxStatusApproved (txId) {
    this._setTxStatus(txId, 'approved')
  }

  // should update the status of the tx to 'signed'.
  setTxStatusSigned (txId) {
    this._setTxStatus(txId, 'signed')
  }

  // should update the status of the tx to 'submitted'.
  setTxStatusSubmitted (txId) {
    this._setTxStatus(txId, 'submitted')
  }

  // should update the status of the tx to 'confirmed'.
  setTxStatusConfirmed (txId) {
    this._setTxStatus(txId, 'confirmed')
  }

  setTxStatusFailed (txId, reason) {
    const txMeta = this.getTx(txId)
    txMeta.err = reason
    this.updateTx(txMeta)
    this._setTxStatus(txId, 'failed')
  }

  // merges txParams obj onto txData.txParams
  // use extend to ensure that all fields are filled
  updateTxParams (txId, txParams) {
    const txMeta = this.getTx(txId)
    txMeta.txParams = extend(txMeta.txParams, txParams)
    this.updateTx(txMeta)
  }

  //  checks if a signed tx is in a block and
  // if included sets the tx status as 'confirmed'
  checkForTxInBlock (block) {
    const signedTxList = this.getFilteredTxList({status: 'submitted'})
    if (!signedTxList.length) return
    signedTxList.forEach((txMeta) => {
      const txHash = txMeta.hash
      const txId = txMeta.id

      if (!txHash) {
        const noTxHash = new Error('We had an error while submitting this transaction, please try again.')
        noTxHash.name = 'NoTxHashError'
        this.setTxStatusFailed(noTxHash)
      }


      block.transactions.forEach((tx) => {
        if (tx.hash === txHash) this.setTxStatusConfirmed(txId)
      })
    })
  }

  queryPendingTxs ({oldBlock, newBlock}) {
    // check pending transactions on start
    if (!oldBlock) {
      this._checkPendingTxs()
      return
    }
    // if we synced by more than one block, check for missed pending transactions
    const diff = Number.parseInt(newBlock.number) - Number.parseInt(oldBlock.number)
    if (diff > 1) this._checkPendingTxs()
  }

  resubmitPendingTxs () {
    const pending = this.getTxsByMetaData('status', 'submitted')
    // only try resubmitting if their are transactions to resubmit
    if (!pending.length) return
    pending.forEach((txMeta) => this._resubmitTx(txMeta).catch((err) => {
      /*
      Dont marked as failed if the error is a "known" transaction warning
      "there is already a transaction with the same sender-nonce
      but higher/same gas price"
      */
      const errorMessage = err.message.toLowerCase()
      const isKnownTx = (
        // geth
        errorMessage.includes('replacement transaction underpriced')
        || errorMessage.includes('known transaction')
        // parity
        || errorMessage.includes('gas price too low to replace')
        || errorMessage.includes('transaction with the same hash was already imported')
        // other
        || errorMessage.includes('gateway timeout')
        || errorMessage.includes('nonce too low')
      )
      // ignore resubmit warnings, return early
      if (isKnownTx) return
      // encountered real error - transition to error state
      this.setTxStatusFailed(txMeta.id, {
        stack: err.stack || err.message,
        errCode: err.errCode || err,
        message: err.message,
      })
    }))
  }

  // PRIVATE METHODS

  //  Should find the tx in the tx list and
  //  update it.
  //  should set the status in txData
  //    - `'unapproved'` the user has not responded
  //    - `'rejected'` the user has responded no!
  //    - `'approved'` the user has approved the tx
  //    - `'signed'` the tx is signed
  //    - `'submitted'` the tx is sent to a server
  //    - `'confirmed'` the tx has been included in a block.
  //    - `'failed'` the tx failed for some reason, included on tx data.
  _setTxStatus (txId, status) {
    const txMeta = this.getTx(txId)
    txMeta.status = status
    this.emit(`${txMeta.id}:${status}`, txId)
    if (status === 'submitted' || status === 'rejected') {
      this.emit(`${txMeta.id}:finished`, txMeta)
    }
    this.updateTx(txMeta)
    this.emit('updateBadge')
  }

  // Saves the new/updated txList.
  // Function is intended only for internal use
  _saveTxList (transactions) {
    this.store.updateState({ transactions })
  }

  _updateMemstore () {
    const unapprovedTxs = this.getUnapprovedTxList()
    const selectedAddressTxList = this.getFilteredTxList({
      from: this.getSelectedAddress(),
      metamaskNetworkId: this.getNetwork(),
    })
    this.memStore.updateState({ unapprovedTxs, selectedAddressTxList })
  }

  async _resubmitTx (txMeta) {
    const address = txMeta.txParams.from
    const balance = this.ethStore.getState().accounts[address].balance
    if (!('retryCount' in txMeta)) txMeta.retryCount = 0

    // if the value of the transaction is greater then the balance, fail.
    if (!this.txProviderUtils.sufficientBalance(txMeta.txParams, balance)) {
      const message = 'Insufficient balance.'
      this.setTxStatusFailed(txMeta.id, {
        stack: '_resubmitTx: custom tx-controller error',
        message,
      })
      log.error(message)
      return
    }

    // Only auto-submit already-signed txs:
    if (!('rawTx' in txMeta)) return

    // Increment a try counter.
    txMeta.retryCount++
    const rawTx = txMeta.rawTx
    return await this.txProviderUtils.publishTransaction(rawTx)
  }

  // checks the network for signed txs and
  // if confirmed sets the tx status as 'confirmed'
  async _checkPendingTxs () {
    const signedTxList = this.getFilteredTxList({status: 'submitted'})
    // in order to keep the nonceTracker accurate we block it while updating pending transactions
    const nonceGlobalLock = await this.nonceTracker.getGlobalLock()
    try {
      await Promise.all(signedTxList.map((txMeta) => this._checkPendingTx(txMeta)))
    } catch (err) {
      console.error('TransactionController - Error updating pending transactions')
      console.error(err)
    }
    nonceGlobalLock.releaseLock()
  }

  async _checkPendingTx (txMeta) {
    const txHash = txMeta.hash
    const txId = txMeta.id
    // extra check in case there was an uncaught error during the
    // signature and submission process
    if (!txHash) {
      const noTxHash = new Error('We had an error while submitting this transaction, please try again.')
      noTxHash.name = 'NoTxHashError'
      this.setTxStatusFailed(noTxHash)
    }
    // get latest transaction status
    let txParams
    try {
      txParams = await this.query.getTransactionByHash(txHash)
      if (!txParams) return
      if (txParams.blockNumber) {
        this.setTxStatusConfirmed(txId)
      }
    } catch (err) {
      if (err || !txParams) {
        txMeta.err = {
          isWarning: true,
          errorCode: err,
          message: 'There was a problem loading this transaction.',
        }
        this.updateTx(txMeta)
        throw err
      }
    }
  }
}