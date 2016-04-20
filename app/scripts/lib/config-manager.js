const Migrator = require('pojo-migrator')
const extend = require('xtend')

const STORAGE_KEY = 'metamask-config'
const DEFAULT_RPC = 'https://testrpc.metamask.io/'

const migrations = require('./migrations')

/* The config-manager is a convenience object
 * wrapping a pojo-migrator.
 *
 * It exists mostly to allow the creation of
 * convenience methods to access and persist
 * particular portions of the state.
 */
module.exports = ConfigManager
function ConfigManager() {
  // ConfigManager is observable and will emit updates
  this._subs = []

  /* The migrator exported on the config-manager
   * has two methods the user should be concerned with:
   *
   * getData(), which returns the app-consumable data object
   * saveData(), which persists the app-consumable data object.
   */
  this.migrator =  new Migrator({

    // Migrations must start at version 1 or later.
    // They are objects with a `version` number
    // and a `migrate` function.
    //
    // The `migrate` function receives the previous
    // config data format, and returns the new one.
    migrations: migrations,

    // How to load initial config.
    // Includes step on migrating pre-pojo-migrator data.
    loadData: loadData,

    // How to persist migrated config.
    setData: function(data) {
      window.localStorage[STORAGE_KEY] = JSON.stringify(data)
    },
  })
}

ConfigManager.prototype.setConfig = function(config) {
  var data = this.migrator.getData()
  data.config = config
  this.setData(data)
  this._emitUpdates(config)
}

ConfigManager.prototype.getConfig = function() {
  var data = this.migrator.getData()
  if ('config' in data) {
    return data.config
  } else {
    return {
      provider: {
        type: 'rpc',
        rpcTarget: DEFAULT_RPC,
      }
    }
  }
}

ConfigManager.prototype.setRpcTarget = function(rpcUrl) {
  var config = this.getConfig()
  config.provider = {
    type: 'rpc',
    rpcTarget: rpcUrl,
  }
  this.setConfig(config)
}

ConfigManager.prototype.useEtherscanProvider = function() {
  var config = this.getConfig()
  config.provider = {
    type: 'etherscan',
  }
  this.setConfig(config)
}

ConfigManager.prototype.getProvider = function() {
  var config = this.getConfig()
  return config.provider
}

ConfigManager.prototype.setData = function(data) {
  this.migrator.saveData(data)
}

ConfigManager.prototype.getData = function() {
  return this.migrator.getData()
}

ConfigManager.prototype.setWallet = function(wallet) {
  var data = this.migrator.getData()
  data.wallet = wallet
  this.setData(data)
}

ConfigManager.prototype.getWallet = function() {
  return this.migrator.getData().wallet
}

// Takes a boolean
ConfigManager.prototype.setShowSeedWords = function(should) {
  var data = this.migrator.getData()
  data.showSeedWords = should
  this.setData(data)
}

ConfigManager.prototype.getShouldShowSeedWords = function() {
  var data = this.migrator.getData()
  return data.showSeedWords
}

ConfigManager.prototype.getCurrentRpcAddress = function() {
  var config = this.getConfig()
  if (!config) return null
  return config.provider && config.provider.rpcTarget ? config.provider.rpcTarget : DEFAULT_RPC
}

ConfigManager.prototype.clearWallet = function() {
  var data = this.getConfig()
  delete data.wallet
  this.setData(data)
}

ConfigManager.prototype.setData = function(data) {
  this.migrator.saveData(data)
}

ConfigManager.prototype.getTxList = function() {
  var data = this.migrator.getData()
  if ('transactions' in data) {
    return data.transactions
  } else {
    return []
  }
}

ConfigManager.prototype._saveTxList = function(txList) {
  var data = this.migrator.getData()
  data.transactions = txList
  this.setData(data)
}

ConfigManager.prototype.addTx = function(tx) {
  var transactions = this.getTxList()
  transactions.push(tx)
  this._saveTxList(transactions)
}

ConfigManager.prototype.getTx = function(txId) {
  var transactions = this.getTxList()
  var matching = transactions.filter(tx => tx.id === txId)
  return matching.length > 0 ? matching[0] : null
}

ConfigManager.prototype.getTxWithParams = function(params) {
  var transactions = this.getTxList()
  var matching = transactions.filter((tx) => {
    return Object.keys(tx.txParams).reduce((result, key) => {
      return ('params' in tx) ? tx.params[key] === params[key] && result : result
    }, true)
  })
  return matching.length > 0 ? matching[0] : null
}

ConfigManager.prototype.confirmTx = function(txId) {
  this._setTxStatus(txId, 'confirmed')
}

ConfigManager.prototype.rejectTx = function(txId) {
  this._setTxStatus(txId, 'rejected')
}

ConfigManager.prototype._setTxStatus = function(txId, status) {
  var tx = this.getTx(txId)
  tx.status = status
  this.updateTx(tx)
}

ConfigManager.prototype.updateTx = function(tx) {
  var transactions = this.getTxList()
  var found, index
  transactions.forEach((otherTx, i) => {
    if (otherTx.id === tx.id) {
      found = true
      index = i
    }
  })
  if (found) {
    transactions[index] = tx
  }
  this._saveTxList(transactions)
}

ConfigManager.prototype.unconfirmedTxs = function() {
  var transactions = this.getTxList()
  return transactions.filter(tx => tx.status === 'unconfirmed')
  .reduce((result, tx) => { result[tx.id] = tx; return result }, {})
}

// observable

ConfigManager.prototype.subscribe = function(fn){
  this._subs.push(fn)
  var unsubscribe = this.unsubscribe.bind(this, fn)
  return unsubscribe
}

ConfigManager.prototype.unsubscribe = function(fn){
  var index = this._subs.indexOf(fn)
  if (index !== -1) this._subs.splice(index, 1)
}

ConfigManager.prototype._emitUpdates = function(state){
  this._subs.forEach(function(handler){
    handler(state)
  })
}


function loadData() {

  var oldData = getOldStyleData()
  var newData
  try {
    newData = JSON.parse(window.localStorage[STORAGE_KEY])
  } catch (e) {}

  var data = extend({
    meta: {
      version: 0,
    },
    data: {
      config: {
        rpcTarget: DEFAULT_RPC,
      }
    }
  }, oldData ? oldData : null, newData ? newData : null)
  return data
}

function getOldStyleData() {
  var config, wallet, seedWords

  var result = {
    meta: { version: 0 },
    data: {},
  }

  try {
    config = JSON.parse(window.localStorage['config'])
    result.data.config = config
  } catch (e) {}
  try {
    wallet = JSON.parse(window.localStorage['lightwallet'])
    result.data.wallet = wallet
  } catch (e) {}
  try {
    seedWords = window.localStorage['seedWords']
    result.data.seedWords = seedWords
  } catch (e) {}

  return result
}

