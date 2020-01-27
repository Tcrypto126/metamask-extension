const version = 9

/*

This migration breaks out the CurrencyController substate

*/

import { merge } from 'lodash'

import clone from 'clone'

export default {
  version,

  migrate: function (originalVersionedData) {
    const versionedData = clone(originalVersionedData)
    versionedData.meta.version = version
    try {
      const state = versionedData.data
      const newState = transformState(state)
      versionedData.data = newState
    } catch (err) {
      console.warn(`MetaMask Migration #${version}` + err.stack)
    }
    return Promise.resolve(versionedData)
  },
}

function transformState (state) {
  const newState = merge({}, state, {
    CurrencyController: {
      currentCurrency: state.currentFiat || state.fiatCurrency || 'USD',
      conversionRate: state.conversionRate,
      conversionDate: state.conversionDate,
    },
  })
  delete newState.currentFiat
  delete newState.fiatCurrency
  delete newState.conversionRate
  delete newState.conversionDate

  return newState
}
