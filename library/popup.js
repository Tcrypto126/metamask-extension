const injectCss = require('inject-css')
const MetaMaskUiCss = require('../ui/css')
const setupIframe = require('./lib/setup-iframe.js')
const MetamaskInpageProvider = require('../app/scripts/lib/inpage-provider.js')
const SWcontroller = require('./sw-controller')
const SwStream = require('sw-stream/lib/sw-stream.js')
const startPopup = require('../app/scripts/popup-core')


var css = MetaMaskUiCss()
injectCss(css)

var name = 'popup'
window.METAMASK_UI_TYPE = name

var iframeStream = setupIframe({
  zeroClientProvider: 'http://localhost:9001',
  sandboxAttributes: ['allow-scripts', 'allow-popups', 'allow-same-origin'],
  container: document.body,
})
console.log('outside:open')

const background = new SWcontroller({
  fileName: '/popup/sw-build.js',
})
background.on('ready', (readSw) => {
  // var inpageProvider = new MetamaskInpageProvider(SwStream(background.controller))
  // startPopup(inpageProvider)
  startPopup(SwStream(background.controller))
})
background.on('message', (messageEvent) => {debugger})
background.startWorker()
console.log('hello from /library/popup.js')
