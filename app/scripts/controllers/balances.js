const ObservableStore = require('obs-store')
const normalizeAddress = require('eth-sig-util').normalize
const extend = require('xtend')
const BalanceController = require('./balance')

class BalancesController {

  constructor (opts = {}) {
    const { ethStore, txController } = opts
    this.ethStore = ethStore
    this.txController = txController

    const initState = extend({
      computedBalances: {},
    }, opts.initState)
    this.store = new ObservableStore(initState)

    this._initBalanceUpdating()
  }

  _initBalanceUpdating () {
    const store = this.ethStore.getState()
    this.addAnyAccountsFromStore(store)
    this.ethStore.subscribe(this.addAnyAccountsFromStore.bind(this))
  }

  addAnyAccountsFromStore(store) {
    const balances = store.accounts

    for (let address in balances) {
      this.trackAddressIfNotAlready(address)
    }
  }

  trackAddressIfNotAlready (address) {
    const state = this.store.getState()
    if (!(address in state.computedBalances)) {
      this.trackAddress(address)
    }
  }

  trackAddress (address) {
    let updater = new BalanceController({
      address,
      ethStore: this.ethStore,
      txController: this.txController,
    })
    updater.store.subscribe((accountBalance) => {
      let newState = this.store.getState()
      newState.computedBalances[address] = accountBalance
      this.store.updateState(newState)
    })
    updater.updateBalance()
  }
}

module.exports = BalancesController
