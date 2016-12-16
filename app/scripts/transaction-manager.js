const EventEmitter = require('events')
const extend = require('xtend')
const ethUtil = require('ethereumjs-util')
const TxProviderUtil = require('./lib/tx-utils')
const createId = require('./lib/random-id')

module.exports = class TransactionManager extends EventEmitter {
  constructor (opts) {
    super()
    this.txList = opts.txList || []
    this._setTxList = opts.setTxList
    this._unconfTxCbs = {}
    this.txHistoryLimit = opts.txHistoryLimit
  // txManager :: tx approvals and rejection cb's

    this.provider = opts.provider
    this.blockTracker = opts.blockTracker
    this.txProviderUtils = new TxProviderUtil(this.provider)
    this.blockTracker.on('block', this.checkForTxInBlock.bind(this))
    this.getGasMultiplier = opts.getGasMultiplier
    this.getNetwork = opts.getNetwork
  }

  getState () {
    return {
      transactions: this.getTxList(),
      unconfTxs: this.getUnapprovedTxList(),
    }
  }

//   Returns the tx list
  getTxList () {
    return this.txList
  }

  // Adds a tx to the txlist
  addTx (txMeta, onTxDoneCb = noop) {
    var txList = this.getTxList()
    var txHistoryLimit = this.txHistoryLimit
    if (txList.length > txHistoryLimit - 1) {
      var index = txList.findIndex((metaTx) => metaTx.status === 'confirmed' || metaTx.status === 'rejected')
      index ? txList.splice(index, index) : txList.shift()
    }
    txList.push(txMeta)
    this._saveTxList(txList)
    // keep the onTxDoneCb around in a listener
    // for after approval/denial (requires user interaction)
    // This onTxDoneCb fires completion to the Dapp's write operation.
    this.once(`${txMeta.id}:signed`, function (txId) {
      this.removeAllListeners(`${txMeta.id}:rejected`)
      onTxDoneCb(null, true)
    })
    this.once(`${txMeta.id}:rejected`, function (txId) {
      this.removeAllListeners(`${txMeta.id}:signed`)
      onTxDoneCb(null, false)
    })

    this.emit('update')
    this.emit(`${txMeta.id}:unapproved`, txMeta)
  }

  // gets tx by Id and returns it
  getTx (txId, cb) {
    var txList = this.getTxList()
    var txMeta = txList.find((txData) => txData.id === txId)
    return cb ? cb(txMeta) : txMeta
  }

  //
  updateTx (txMeta) {
    var txId = txMeta.id
    var txList = this.getTxList()
    var index = txList.findIndex((txData) => txData.id === txId)
    txList[index] = txMeta
    this._saveTxList(txList)
  }

  get unconfTxCount () {
    return Object.keys(this.getUnapprovedTxList()).length
  }

  get pendingTxCount () {
    return this.getTxsByMetaData('status', 'signed').length
  }

  addUnapprovedTransaction (txParams, onTxDoneCb, cb) {
    // create txData obj with parameters and meta data
    var time = (new Date()).getTime()
    var txId = createId()
    txParams.metamaskId = txId
    txParams.metamaskNetworkId = this.getNetwork()
    var txData = {
      id: txId,
      txParams: txParams,
      time: time,
      status: 'unapproved',
      gasMultiplier: this.getGasMultiplier() || 1,
      metamaskNetworkId: this.getNetwork(),
    }
    this.txProviderUtils.analyzeGasUsage(txData, this.txDidComplete.bind(this, txData, onTxDoneCb, cb))
    // calculate metadata for tx
  }

  txDidComplete (txMeta, onTxDoneCb, cb, err) {
    if (err) return cb(err)
    this.addTx(txMeta, onTxDoneCb)
    cb(null, txMeta)
  }

  getUnapprovedTxList () {
    var txList = this.getTxList()
    return txList.filter((txMeta) => txMeta.status === 'unapproved')
    .reduce((result, tx) => {
      result[tx.id] = tx
      return result
    }, {})
  }

  approveTransaction (txId, cb) {
    this.setTxStatusSigned(txId)
    cb()
  }

  cancelTransaction (txId, cb) {
    this.setTxStatusRejected(txId)
    if (cb && typeof cb === 'function') {
      cb()
    }
  }

  resolveSignedTransaction (txPromise) {
    const self = this

    txPromise.then(({tx, txParams, cb}) => {
      // Add the tx hash to the persisted meta-tx object
      var txHash = ethUtil.bufferToHex(tx.hash())

      var metaTx = self.getTx(txParams.metamaskId)
      metaTx.hash = txHash
      // return raw serialized tx
      var rawTx = ethUtil.bufferToHex(tx.serialize())
      cb(null, rawTx)
    })
  }

  /*
  Takes an object of fields to search for eg:
  var thingsToLookFor = {
    to: '0x0..',
    from: '0x0..',
    status: 'signed',
  }
  and returns a list of tx with all
  options matching

  this is for things like filtering a the tx list
  for only tx's from 1 account
  or for filltering for all txs from one account
  and that have been 'confirmed'
  */
  getFilteredTxList (opts) {
    var filteredTxList
    Object.keys(opts).forEach((key) => {
      filteredTxList = this.getTxsByMetaData(key, opts[key], filteredTxList)
    })
    return filteredTxList
  }

  getTxsByMetaData (key, value, txList = this.getTxList()) {
    return txList.filter((txMeta) => {
      if (key in txMeta.txParams) {
        return txMeta.txParams[key] === value
      } else {
        return txMeta[key] === value
      }
    })
  }

  //   should return the status of the tx.
  getTxStatus (txId, cb) {
    const txMeta = this.getTx(txId)
    return cb ? cb(txMeta.staus) : txMeta.status
  }


  //   should update the status of the tx to 'signed'.
  setTxStatusSigned (txId) {
    this._setTxStatus(txId, 'signed')
    this.emit('update')
  }

  //     should update the status of the tx to 'rejected'.
  setTxStatusRejected (txId) {
    this._setTxStatus(txId, 'rejected')
    this.emit('update')
  }

  setTxStatusConfirmed (txId) {
    this._setTxStatus(txId, 'confirmed')
  }

  // merges txParams obj onto txData.txParams
  // use extend to ensure that all fields are filled
  updateTxParams (txId, txParams) {
    var txMeta = this.getTx(txId)
    txMeta.txParams = extend(txMeta, txParams)
    this.updateTx(txMeta)
  }

  //  checks if a signed tx is in a block and
  // if included sets the tx status as 'confirmed'
  checkForTxInBlock () {
    var signedTxList = this.getFilteredTxList({status: 'signed', err: undefined})
    if (!signedTxList.length) return
    signedTxList.forEach((tx) => {
      var txHash = tx.hash
      var txId = tx.id
      if (!txHash) return
      this.txProviderUtils.query.getTransactionByHash(txHash, (err, txMeta) => {
        if (err || !txMeta) {
          tx.err = err || 'Tx could possibly have not submitted'
          this.updateTx(tx)
          return txMeta ? console.error(err) : console.debug(`txMeta is ${txMeta} for:`, tx)
        }
        if (txMeta.blockNumber) {
          this.setTxStatusConfirmed(txId)
        }
      })
    })
  }

  // Private functions

  // Saves the new/updated txList.
  // Function is intended only for internal use
  _saveTxList (txList) {
    this.txList = txList
    this._setTxList(txList)
  }

    //   should return the tx

  //  Should find the tx in the tx list and
  //  update it.
  //  should set the status in txData
  //    - `'unapproved'` the user has not responded
  //    - `'rejected'` the user has responded no!
  //    - `'signed'` the tx is signed
  //    - `'submitted'` the tx is sent to a server
  //    - `'confirmed'` the tx has been included in a block.
  _setTxStatus (txId, status) {
    var txMeta = this.getTx(txId)
    txMeta.status = status
    this.emit(`${txMeta.id}:${status}`, txId)
    this.updateTx(txMeta)
  }


}


const noop = () => console.warn('noop was used no cb provided')
