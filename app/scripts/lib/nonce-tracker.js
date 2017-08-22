const EthQuery = require('eth-query')
const assert = require('assert')
const Mutex = require('await-semaphore').Mutex

class NonceTracker {

  constructor ({ provider, getPendingTransactions, getConfirmedTransactions }) {
    this.provider = provider
    this.ethQuery = new EthQuery(provider)
    this.getPendingTransactions = getPendingTransactions
    this.getConfirmedTransactions = getConfirmedTransactions
    this.lockMap = {}
  }

  async getGlobalLock () {
    const globalMutex = this._lookupMutex('global')
    // await global mutex free
    const releaseLock = await globalMutex.acquire()
    return { releaseLock }
  }

  // releaseLock must be called
  // releaseLock must be called after adding signed tx to pending transactions (or discarding)
  async getNonceLock (address) {
    // await global mutex free
    await this._globalMutexFree()
    // await lock free, then take lock
    const releaseLock = await this._takeMutex(address)
    // evaluate multiple nextNonce strategies
    const nonceDetails = {}
    const localNonceResult = await this._getlocalNextNonce(address)
    nonceDetails.local = localNonceResult.details
    const networkNonceResult = await this._getNetworkNextNonce(address)
    nonceDetails.network = networkNonceResult.details
    const nextNonce = Math.max(networkNonceResult.nonce, localNonceResult.nonce)
    assert(Number.isInteger(nextNonce), `nonce-tracker - nextNonce is not an integer - got: (${typeof nextNonce}) "${nextNonce}"`)
    // collect the numbers used to calculate the nonce for debugging
    const currentPendingNonce = this._getLocalPendingNonce(address)
    nonceDetails.currentPendingNonce = currentPendingNonce
    // return nonce and release cb
    return { nextNonce, nonceDetails, releaseLock }
  }

  async _getCurrentBlock () {
    const blockTracker = this._getBlockTracker()
    const currentBlock = blockTracker.getCurrentBlock()
    if (currentBlock) return currentBlock
    return await Promise((reject, resolve) => {
      blockTracker.once('latest', resolve)
    })
  }

  async _getTxCount (address, currentBlock) {
    const blockNumber = currentBlock.number
    return new Promise((resolve, reject) => {
      this.ethQuery.getTransactionCount(address, blockNumber, (err, result) => {
        err ? reject(err) : resolve(result)
      })
    })
  }

  async _globalMutexFree () {
    const globalMutex = this._lookupMutex('global')
    const release = await globalMutex.acquire()
    release()
  }

  async _takeMutex (lockId) {
    const mutex = this._lookupMutex(lockId)
    const releaseLock = await mutex.acquire()
    return releaseLock
  }

  _lookupMutex (lockId) {
    let mutex = this.lockMap[lockId]
    if (!mutex) {
      mutex = new Mutex()
      this.lockMap[lockId] = mutex
    }
    return mutex
  }

  async _getNetworkNextNonce (address) {
    // calculate next nonce
    // we need to make sure our base count
    // and pending count are from the same block
    const currentBlock = await this._getCurrentBlock()
    const blockNumber = currentBlock.blockNumber
    const baseCountHex = await this._getTxCount(address, currentBlock)
    const baseCount = parseInt(baseCountHex, 16)
    assert(Number.isInteger(baseCount), `nonce-tracker - baseCount is not an integer - got: (${typeof baseCount}) "${baseCount}"`)
    const nonceDetails = { blockNumber, baseCountHex, baseCount }
    return { name: 'network', nonce: baseCount, details: nonceDetails }
  }

  async _getlocalNextNonce (address) {
    let nextNonce
    // check our local tx history for the highest nonce (if any)
    const highestNonce = this._getLocalHighestNonce(address)
    const haveHighestNonce = Number.isInteger(highestNonce)
    if (haveHighestNonce) {
      // next nonce is the nonce after our last
      nextNonce = highestNonce + 1
    } else {
      // no local tx history so next must be first (zero)
      nextNonce = 0
    }
    const nonceDetails = { highestNonce }
    return { name: 'local', nonce: nextNonce, details: nonceDetails }
  }

  _getLocalPendingNonce (address) {
    const pendingTransactions = this.getPendingTransactions(address)
    const highestNonce = this._getHighestNonce(pendingTransactions)
    return highestNonce
  }

  _getLocalConfirmedNonce (address) {
    const pendingTransactions = this.getConfirmedTransactions(address)
    const highestNonce = this._getHighestNonce(pendingTransactions)
    return highestNonce
  }

  _getLocalHighestNonce (address) {
    const confirmedTransactions = this.getConfirmedTransactions(address)
    const pendingTransactions = this.getPendingTransactions(address)
    const transactions = confirmedTransactions.concat(pendingTransactions)
    const highestNonce = this._getHighestNonce(transactions)
    return highestNonce
  }

  _getPendingTransactionCount (address) {
    const pendingTransactions = this.getPendingTransactions(address)
    return this._reduceTxListToUniqueNonces(pendingTransactions).length
  }

  _reduceTxListToUniqueNonces (txList) {
    const reducedTxList = txList.reduce((reducedList, txMeta, index) => {
      if (!index) return [txMeta]
      const nonceMatches = txList.filter((txData) => {
        return txMeta.txParams.nonce === txData.txParams.nonce
      })
      if (nonceMatches.length > 1) return reducedList
      reducedList.push(txMeta)
      return reducedList
    }, [])
    return reducedTxList
  }

  _getHighestNonce (txList) {
    const nonces = txList.map((txMeta) => parseInt(txMeta.txParams.nonce, 16))
    const highestNonce = Math.max.apply(null, nonces)
    return highestNonce
  }

  // this is a hotfix for the fact that the blockTracker will
  // change when the network changes
  _getBlockTracker () {
    return this.provider._blockTracker
  }
}

module.exports = NonceTracker
