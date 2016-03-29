const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const Transaction = require('ethereumjs-tx')
const LightwalletKeyStore = require('eth-lightwallet').keystore
const LightwalletSigner = require('eth-lightwallet').signing
const async = require('async')
const clone = require('clone')
const extend = require('xtend')
const createId = require('web3-provider-engine/util/random-id')
const autoFaucet = require('./auto-faucet')


module.exports = IdentityStore


inherits(IdentityStore, EventEmitter)
function IdentityStore(ethStore) {
  EventEmitter.call(this)

  // we just use the ethStore to auto-add accounts
  this._ethStore = ethStore
  // lightwallet key store
  this._keyStore = null
  // lightwallet wrapper
  this._idmgmt = null

  this.hdPathString = "m/44'/60'/0'/0"

  this._currentState = {
    selectedAddress: null,
    identities: {},
    unconfTxs: {},
  }
  // not part of serilized metamask state - only kept in memory
  this._unconfTxCbs = {}
}

//
// public
//

IdentityStore.prototype.createNewVault = function(password, entropy, cb){
  delete this._keyStore
  delete window.localStorage['lightwallet']
  this._createIdmgmt(password, null, entropy, (err) => {
    if (err) return cb(err)
    var seedWords = this._idmgmt.getSeed()
    this._cacheSeedWordsUntilConfirmed(seedWords)
    this._loadIdentities()
    this._didUpdate()
    this._autoFaucet()
    cb(null, seedWords)
  })
}

IdentityStore.prototype.recoverFromSeed = function(password, seed, cb){
  this._createIdmgmt(password, seed, null, (err) => {
    if (err) return cb(err)

    this._loadIdentities()
    this._didUpdate()
    cb(null, this.getState())
  })
}

IdentityStore.prototype.setStore = function(store){
  this._ethStore = store
}

IdentityStore.prototype.clearSeedWordCache = function(cb) {
  delete window.localStorage['seedWords']
  cb()
}

IdentityStore.prototype.getState = function(){
  const cachedSeeds = window.localStorage['seedWords']
  return clone(extend(this._currentState, {
    isInitialized: !!window.localStorage['lightwallet'] && !cachedSeeds,
    isUnlocked: this._isUnlocked(),
    seedWords: cachedSeeds,
  }))
}

IdentityStore.prototype.getSelectedAddress = function(){
  return this._currentState.selectedAddress
}

IdentityStore.prototype.setSelectedAddress = function(address){
  this._currentState.selectedAddress = address
  this._didUpdate()
}

IdentityStore.prototype.setLocked = function(cb){
  delete this._keyStore
  delete this._idmgmt
  cb()
}

IdentityStore.prototype.submitPassword = function(password, cb){
  this._tryPassword(password, (err) => {
    if (err) return cb(err)
    // load identities before returning...
    this._loadIdentities()
    cb()
  })
}

// comes from dapp via zero-client hooked-wallet provider
IdentityStore.prototype.addUnconfirmedTransaction = function(txParams, cb){

  // create txData obj with parameters and meta data
  var time = (new Date()).getTime()
  var txId = createId()
  var txData = {
    id: txId,
    txParams: txParams,
    time: time,
    status: 'unconfirmed',
  }
  this._currentState.unconfTxs[txId] = txData
  console.log('addUnconfirmedTransaction:', txData)

  // keep the cb around for after approval (requires user interaction)
  this._unconfTxCbs[txId] = cb

  // signal update
  this._didUpdate()

  return txId
}

// comes from metamask ui
IdentityStore.prototype.approveTransaction = function(txId, cb){
  var txData = this._currentState.unconfTxs[txId]
  var txParams = txData.txParams
  var approvalCb = this._unconfTxCbs[txId] || noop

  // accept tx
  cb()
  approvalCb(null, true)
  // clean up
  delete this._currentState.unconfTxs[txId]
  delete this._unconfTxCbs[txId]
  this._didUpdate()
}

// comes from metamask ui
IdentityStore.prototype.cancelTransaction = function(txId){
  var txData = this._currentState.unconfTxs[txId]
  var approvalCb = this._unconfTxCbs[txId] || noop

  // reject tx
  approvalCb(null, false)
  // clean up
  delete this._currentState.unconfTxs[txId]
  delete this._unconfTxCbs[txId]
  this._didUpdate()
}

// performs the actual signing, no autofill of params
IdentityStore.prototype.signTransaction = function(txParams, cb){
  try {
    console.log('signing tx...', txParams)
    var rawTx = this._idmgmt.signTx(txParams)
    cb(null, rawTx)
  } catch (err) {
    cb(err)
  }
}

//
// private
//

IdentityStore.prototype._didUpdate = function(){
  this.emit('update', this.getState())
}

IdentityStore.prototype._isUnlocked = function(){
  var result = Boolean(this._keyStore) && Boolean(this._idmgmt)
  return result
}

IdentityStore.prototype._cacheSeedWordsUntilConfirmed = function(seedWords) {
  window.localStorage['seedWords'] = seedWords
}

// load identities from keyStoreet
IdentityStore.prototype._loadIdentities = function(){
  if (!this._isUnlocked()) throw new Error('not unlocked')

  var addresses = this._getAddresses()
  addresses.forEach((address, i) => {
    // // add to ethStore
    this._ethStore.addAccount(address)
    // add to identities
    var identity = {
      name: 'Wallet ' + (i+1),
      img: 'QmW6hcwYzXrNkuHrpvo58YeZvbZxUddv69ATSHY3BHpPdd',
      address: address,
    }
    this._currentState.identities[address] = identity
  })
  this._didUpdate()
}

//
// keyStore managment - unlocking + deserialization
//

IdentityStore.prototype._tryPassword = function(password, cb){
  this._createIdmgmt(password, null, null, cb)
}

IdentityStore.prototype._createIdmgmt = function(password, seed, entropy, cb){
  var keyStore = null
  LightwalletKeyStore.deriveKeyFromPassword(password, (err, derivedKey) => {
    if (err) return cb(err)
    var serializedKeystore = window.localStorage['lightwallet']

    if (seed) {
      keyStore = this._restoreFromSeed(password, seed, derivedKey)

    // returning user, recovering from localStorage
    } else if (serializedKeystore) {
      keyStore = this._loadFromLocalStorage(serializedKeystore, derivedKey, cb)
      var isCorrect = keyStore.isDerivedKeyCorrect(derivedKey)
      if (!isCorrect) return cb(new Error('Lightwallet - password incorrect'))

   // first time here
    } else {
      keyStore = this._createFirstWallet(entropy, derivedKey)
    }

    this._keyStore = keyStore
    this._idmgmt = new IdManagement({
      keyStore: keyStore,
      derivedKey: derivedKey,
      hdPathSTring: this.hdPathString,
    })

    cb()
  })
}

IdentityStore.prototype._restoreFromSeed = function(password, seed, derivedKey) {
  var keyStore = new LightwalletKeyStore(seed, derivedKey, this.hdPathString)
  keyStore.addHdDerivationPath(this.hdPathString, derivedKey, {curve: 'secp256k1', purpose: 'sign'});
  keyStore.setDefaultHdDerivationPath(this.hdPathString)

  keyStore.generateNewAddress(derivedKey, 3)
  window.localStorage['lightwallet'] = keyStore.serialize()
  console.log('restored from seed. saved to keystore localStorage')
  return keyStore
}

IdentityStore.prototype._loadFromLocalStorage = function(serializedKeystore, derivedKey) {
  return LightwalletKeyStore.deserialize(serializedKeystore)
}

IdentityStore.prototype._createFirstWallet = function(entropy, derivedKey) {
  var secretSeed = LightwalletKeyStore.generateRandomSeed(entropy)
  var keyStore = new LightwalletKeyStore(secretSeed, derivedKey, this.hdPathString)
  keyStore.addHdDerivationPath(this.hdPathString, derivedKey, {curve: 'secp256k1', purpose: 'sign'});
  keyStore.setDefaultHdDerivationPath(this.hdPathString)

  keyStore.generateNewAddress(derivedKey, 3)
  window.localStorage['lightwallet'] = keyStore.serialize()
  console.log('saved to keystore localStorage')
  return keyStore
}

// get addresses and normalize address hexString
IdentityStore.prototype._getAddresses = function() {
  return this._keyStore.getAddresses(this.hdPathString).map((address) => { return '0x'+address })
}

IdentityStore.prototype._autoFaucet = function() {
  var addresses = this._getAddresses()
  autoFaucet(addresses[0])
}

function IdManagement(opts) {
  if (!opts) opts = {}

  this.keyStore = opts.keyStore
  this.derivedKey = opts.derivedKey
  this.hdPathString = opts.hdPathString

  this.getAddresses =  function(){
    return keyStore.getAddresses(this.hdPathString).map(function(address){ return '0x'+address })
  }

  this.signTx = function(txParams){
    // normalize values
    txParams.to = ethUtil.addHexPrefix(txParams.to)
    txParams.from = ethUtil.addHexPrefix(txParams.from)
    txParams.value = ethUtil.addHexPrefix(txParams.value)
    txParams.data = ethUtil.addHexPrefix(txParams.data)
    txParams.gasLimit = ethUtil.addHexPrefix(txParams.gasLimit || txParams.gas)
    txParams.nonce = ethUtil.addHexPrefix(txParams.nonce)
    var tx = new Transaction(txParams)
    var rawTx = '0x'+tx.serialize().toString('hex')
    return '0x'+LightwalletSigner.signTx(this.keyStore, this.derivedKey, rawTx, txParams.from)
  }

  this.getSeed = function(){
    return this.keyStore.getSeed(this.derivedKey)
  }
}


// util

function noop(){}
