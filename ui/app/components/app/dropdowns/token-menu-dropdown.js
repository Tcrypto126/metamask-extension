import PropTypes from 'prop-types'
import React, { Component } from 'react'
const inherits = require('util').inherits
const connect = require('react-redux').connect
const actions = require('../../../store/actions')
const genAccountLink = require('etherscan-link').createAccountLink
const { Menu, Item, CloseArea } = require('./components/menu')

TokenMenuDropdown.contextTypes = {
  t: PropTypes.func,
}

module.exports = connect(mapStateToProps, mapDispatchToProps)(TokenMenuDropdown)

function mapStateToProps (state) {
  return {
    network: state.metamask.network,
  }
}

function mapDispatchToProps (dispatch) {
  return {
    showHideTokenConfirmationModal: (token) => {
      dispatch(actions.showModal({ name: 'HIDE_TOKEN_CONFIRMATION', token }))
    },
  }
}


inherits(TokenMenuDropdown, Component)
function TokenMenuDropdown () {
  Component.call(this)

  this.onClose = this.onClose.bind(this)
}

TokenMenuDropdown.prototype.onClose = function (e) {
  e.stopPropagation()
  this.props.onClose()
}

TokenMenuDropdown.prototype.render = function TokenMenuDropdown () {
  const { showHideTokenConfirmationModal } = this.props

  return (
    <Menu className="token-menu-dropdown" isShowing>
      <CloseArea onClick={this.onClose} />
      <Item
        onClick={(e) => {
          e.stopPropagation()
          showHideTokenConfirmationModal(this.props.token)
          this.props.onClose()
        }}
        text={this.context.t('hideToken')}
      />
      <Item
        onClick={(e) => {
          e.stopPropagation()
          const url = genAccountLink(this.props.token.address, this.props.network)
          global.platform.openWindow({ url })
          this.props.onClose()
        }}
        text={this.context.t('viewOnEtherscan')}
      />
    </Menu>
  )
}
