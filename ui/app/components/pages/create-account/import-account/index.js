const inherits = require('util').inherits
const Component = require('react').Component
const h = require('react-hyperscript')
const connect = require('react-redux').connect
import Select from 'react-select'

// Subviews
const JsonImportView = require('./json.js')
const PrivateKeyImportView = require('./private-key.js')

const menuItems = [
  'Private Key',
  'JSON File',
]

module.exports = connect(mapStateToProps)(AccountImportSubview)

function mapStateToProps (state) {
  return {
    menuItems,
  }
}

inherits(AccountImportSubview, Component)
function AccountImportSubview () {
  Component.call(this)
}

AccountImportSubview.prototype.render = function () {
  const props = this.props
  const state = this.state || {}
  const { menuItems } = props
  const { type } = state

  return (
    h('div.new-account-import-form', [

      h('div.new-account-import-form__select-section', [

        h('div.new-account-import-form__select-label', 'Select Type'),

        h(Select, {
          className: 'new-account-import-form__select',
          name: 'import-type-select',
          clearable: false,
          value: type || menuItems[0],
          options: menuItems.map((type) => {
            return {
              value: type,
              label: type,
            }
          }),
          onChange: (opt) => {
            this.setState({ type: opt.value })
          },
        }),

      ]),

      this.renderImportView(),
    ])
  )
}

AccountImportSubview.prototype.renderImportView = function () {
  const props = this.props
  const state = this.state || {}
  const { type } = state
  const { menuItems } = props
  const current = type || menuItems[0]

  switch (current) {
    case 'Private Key':
      return h(PrivateKeyImportView)
    case 'JSON File':
      return h(JsonImportView)
    default:
      return h(JsonImportView)
  }
}
