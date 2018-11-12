const clone = require('clone')
const extend = require('xtend')
const copyToClipboard = require('copy-to-clipboard')

//
// Sub-Reducers take in the complete state and return their sub-state
//
const reduceMetamask = require('./reducers/metamask')
const reduceApp = require('./reducers/app')
const reduceLocale = require('./reducers/locale')
const reduceSend = require('./ducks/send.duck').default
import reduceConfirmTransaction from './ducks/confirm-transaction.duck'

window.METAMASK_CACHED_LOG_STATE = null

module.exports = rootReducer

function rootReducer (state, action) {
  // clone
  state = extend(state)

  if (action.type === 'GLOBAL_FORCE_UPDATE') {
    return action.value
  }

  //
  // MetaMask
  //

  state.metamask = reduceMetamask(state, action)

  //
  // AppState
  //

  state.appState = reduceApp(state, action)

  //
  // LocaleMessages
  //

  state.localeMessages = reduceLocale(state, action)

  //
  // Send
  //

  state.send = reduceSend(state, action)

  state.confirmTransaction = reduceConfirmTransaction(state, action)

  window.METAMASK_CACHED_LOG_STATE = state
  return state
}

window.getCleanAppState = function () {
  const state = clone(window.METAMASK_CACHED_LOG_STATE)
  // append additional information
  state.version = global.platform.getVersion()
  state.browser = window.navigator.userAgent
  // ensure seedWords are not included
  if (state.metamask) delete state.metamask.seedWords
  if (state.appState.currentView) delete state.appState.currentView.seedWords
  return state
}

window.logStateString = function (cb) {
  const state = window.getCleanAppState()
  global.platform.getPlatformInfo((err, platform) => {
    if (err) return cb(err)
    state.platform = platform
    const stateString = JSON.stringify(state, removeSeedWords, 2)
    cb(null, stateString)
  })
}

window.logState = function (toClipboard) {
  return window.logStateString((err, result) => {
    if (err) {
      console.error(err.message)
    } else if (toClipboard) {
      copyToClipboard(result)
      console.log('State log copied')
    } else {
      console.log(result)
    }
  })
}

function removeSeedWords (key, value) {
  return key === 'seedWords' ? undefined : value
}
