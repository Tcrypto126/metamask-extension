module.exports = setupDappAutoReload

function setupDappAutoReload (web3, observable) {
  // export web3 as a global, checking for usage
  global.web3 = new Proxy(web3, {
    get: (_web3, name) => {
      // get the time of use
      if (name !== '_used') _web3._used = Date.now()
      return _web3[name]
    },
    set: (_web3, name, value) => {
      _web3[name] = value
    },
  })
  var networkVersion

  observable.subscribe(function (state) {
    // get the initial network
    const curentNetVersion = state.networkVersion
    if (!networkVersion) networkVersion = curentNetVersion

    if (curentNetVersion !== networkVersion && web3._used) {
      const timeSenseUse = Date.now() - web3._used
      // if web3 was recently used then delay the reloading of the page
      timeSenseUse > 500 ? triggerReset() : setTimeout(triggerReset, 500)
      // prevent reentry into if statement if state updates again before
      // reload
      networkVersion = curentNetVersion
    }
  })
}

// reload the page
function triggerReset () {
  global.location.reload()
}
