const render = require('react-dom').render
const h = require('react-hyperscript')
const Root = require('../ui/app/root')
const configureStore = require('./mockStore')
const states = require('./states')
const Selector = require('./selector')

// Query String
const qs = require('qs')
let queryString = qs.parse(window.location.href.split('#')[1])
let selectedView = queryString.view || 'account detail'

// CSS
const MetaMaskUiCss = require('../ui/css')
const injectCss = require('inject-css')

const firstState = states[selectedView]
updateQueryParams()

function updateQueryParams(newView) {
  queryString.view = newView
  const params = qs.stringify(queryString)
  window.location.href = window.location.href.split('#')[0] + `#${params}`
}

const actions = {
  _setAccountManager(){},
  update: function(stateName) {
    selectedView = stateName
    updateQueryParams(stateName)
    const newState = states[selectedView]
    return {
      type: 'GLOBAL_FORCE_UPDATE',
      value: newState,
    }
  },
}

var css = MetaMaskUiCss()
injectCss(css)

const container = document.querySelector('#app-content')

// parse opts
var store = configureStore(states[selectedView])

// start app
render(
  h('.super-dev-container', [

    h(Selector, { actions, selectedKey: selectedView, states, store }),

    h(Root, {
      store: store,
    }),

  ]
), container)

