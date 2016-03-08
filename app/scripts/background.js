const Dnode = require('dnode')
const eos = require('end-of-stream')
const extend = require('xtend')
const EthStore = require('eth-store')
const PortStream = require('./lib/port-stream.js')
const MetaMaskProvider = require('web3-provider-engine/zero.js')
const IdentityStore = require('./lib/idStore')

console.log('ready to roll')

//
// connect to other contexts
//

chrome.runtime.onConnect.addListener(connectRemote)
function connectRemote(remotePort){
  var isMetaMaskInternalProcess = (remotePort.name === 'popup')
  if (isMetaMaskInternalProcess) {
    // communication with popup
    handleInternalCommunication(remotePort)
  } else {
    // communication with page
    handleExternalCommunication(remotePort)
  }
}

function handleExternalCommunication(remotePort){
  remotePort.onMessage.addListener(onRpcRequest.bind(null, remotePort))
}

//
// state and network
//

var config = getConfig()
var idStore = new IdentityStore()
var zeroClient = MetaMaskProvider({
  rpcUrl: config.rpcTarget,
  getAccounts: function(cb){
    var selectedAddress = idStore.getSelectedAddress()
    var result = selectedAddress ? [selectedAddress] : []
    cb(null, result)
  },
  approveTransaction: idStore.addUnconfirmedTransaction.bind(idStore),
  signTransaction: idStore.signTransaction.bind(idStore),
})

// log new blocks
zeroClient.on('block', function(block){
  console.log('BLOCK CHANGED:', '#'+block.number.toString('hex'), '0x'+block.hash.toString('hex'))
})

var ethStore = new EthStore(zeroClient)
idStore.setStore(ethStore)

function getState(){
  var state = extend(
    ethStore.getState(),
    idStore.getState(),
    getConfig()
  )
  return state
}

// handle rpc requests
function onRpcRequest(remotePort, payload){
  // console.log('MetaMaskPlugin - incoming payload:', payload)
  zeroClient.sendAsync(payload, function onPayloadHandled(err, response){
    // provider engine errors are included in response objects
    if (!payload.isMetamaskInternal) console.log('MetaMaskPlugin - RPC complete:', payload, '->', response)
    try {
      remotePort.postMessage(response)
    } catch (_) {
      // port disconnected
    }
  })
}


//
// popup integration
//

function handleInternalCommunication(remotePort){
  var duplex = new PortStream(remotePort)
  var connection = Dnode({
    getState:           function(cb){ cb(null, getState()) },
    setRpcTarget:       setRpcTarget,
    // forward directly to idStore
    createNewVault:     idStore.createNewVault.bind(idStore),
    submitPassword:     idStore.submitPassword.bind(idStore),
    setSelectedAddress: idStore.setSelectedAddress.bind(idStore),
    approveTransaction: idStore.approveTransaction.bind(idStore),
    cancelTransaction:  idStore.cancelTransaction.bind(idStore),
    setLocked:          idStore.setLocked.bind(idStore),
  })
  duplex.pipe(connection).pipe(duplex)
  connection.on('remote', function(remote){
    
    // push updates to popup
    ethStore.on('update', sendUpdate)
    idStore.on('update', sendUpdate)
    // teardown on disconnect
    eos(duplex, function unsubscribe(){
      ethStore.removeListener('update', sendUpdate)
    })
    function sendUpdate(){
      var state = getState()
      remote.sendUpdate(state)
    }

  })
}

//
// plugin badge text
//

idStore.on('update', updateBadge)

function updateBadge(state){
  var label = ''
  var count = Object.keys(state.unconfTxs).length
  if (count) {
    label = String(count)
  }
  chrome.browserAction.setBadgeText({ text: label })
  chrome.browserAction.setBadgeBackgroundColor({ color: '#506F8B' })
}

//
// config
//

// called from popup
function setRpcTarget(rpcTarget){
  var config = getConfig()
  config.rpcTarget = rpcTarget
  setConfig(config)
  chrome.runtime.reload()
}

function getConfig(){
  return extend({
    rpcTarget: 'https://rawtestrpc.metamask.io/',
  }, JSON.parse(localStorage['config'] || '{}'))
}

function setConfig(state){
  localStorage['config'] = JSON.stringify(state)
}