const { Component } = require('react')
const PropTypes = require('prop-types')
const { Provider } = require('react-redux')
const h = require('react-hyperscript')
const SelectedApp = require('./select-app')
const { HashRouter } = require('react-router-dom')

class Root extends Component {
  render () {
    const { store } = this.props

    return (
      h(Provider, { store }, [
        h(HashRouter, {
          hashType: 'noslash',
        }, [
          h(SelectedApp),
        ]),
      ])
    )
  }
}

Root.propTypes = {
  store: PropTypes.object,
}

module.exports = Root
