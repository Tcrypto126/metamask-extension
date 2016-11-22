const EventEmitter = require('events').EventEmitter
const hdkey = require('ethereumjs-wallet/hdkey')
const bip39 = require('bip39')
const ethUtil = require('ethereumjs-util')

// *Internal Deps
const sigUtil = require('../lib/sig-util')

// Options:
const hdPathString = `m/44'/60'/0'/0`
const type = 'HD Key Tree'

class HdKeyring extends EventEmitter {

  /* PUBLIC METHODS */

  constructor (opts = {}) {
    super()
    this.type = type
    this.deserialize(opts)
  }

  serialize () {
    return {
      mnemonic: this.mnemonic,
      numberOfAccounts: this.wallets.length,
    }
  }

  deserialize (opts = {}) {
    this.opts = opts || {}
    this.wallets = []
    this.mnemonic = null
    this.root = null

    if ('mnemonic' in opts) {
      this._initFromMnemonic(opts.mnemonic)
    }

    if ('numberOfAccounts' in opts) {
      this.addAccounts(opts.numberOfAccounts)
    }
  }

  addAccounts (numberOfAccounts = 1) {
    if (!this.root) {
      this._initFromMnemonic(bip39.generateMnemonic())
    }

    const oldLen = this.wallets.length
    const newWallets = []
    for (let i = oldLen; i < numberOfAccounts + oldLen; i++) {
      const child = this.root.deriveChild(i)
      const wallet = child.getWallet()
      newWallets.push(wallet)
      this.wallets.push(wallet)
    }
    return newWallets.map(w => w.getAddress().toString('hex'))
  }

  getAccounts () {
    return this.wallets.map(w => w.getAddress().toString('hex'))
  }

  // tx is an instance of the ethereumjs-transaction class.
  signTransaction (address, tx) {
    const wallet = this._getWalletForAccount(address)
    var privKey = wallet.getPrivateKey()
    tx.sign(privKey)
    return tx
  }

  // For eth_sign, we need to sign transactions:
  signMessage (withAccount, data) {
    const wallet = this._getWalletForAccount(withAccount)
    const message = ethUtil.removeHexPrefix(data)
    var privKey = wallet.getPrivateKey()
    var msgSig = ethUtil.ecsign(new Buffer(message, 'hex'), privKey)
    var rawMsgSig = ethUtil.bufferToHex(sigUtil.concatSig(msgSig.v, msgSig.r, msgSig.s))
    return rawMsgSig
  }

  exportAccount (address) {
    const wallet = this._getWalletForAccount(address)
    return wallet.getPrivateKey().toString('hex')
  }


  /* PRIVATE METHODS */

  _initFromMnemonic (mnemonic) {
    this.mnemonic = mnemonic
    const seed = bip39.mnemonicToSeed(mnemonic)
    this.hdWallet = hdkey.fromMasterSeed(seed)
    this.root = this.hdWallet.derivePath(hdPathString)
  }


  _getWalletForAccount (account) {
    return this.wallets.find((w) => {
      const address = w.getAddress().toString('hex')
      return ((address === account) || (sigUtil.normalize(address) === account))
    })
  }
}

HdKeyring.type = type
module.exports = HdKeyring
