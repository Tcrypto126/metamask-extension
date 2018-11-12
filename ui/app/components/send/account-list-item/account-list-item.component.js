import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { checksumAddress } from '../../../util'
import Identicon from '../../identicon'
import UserPreferencedCurrencyDisplay from '../../user-preferenced-currency-display'
import { PRIMARY, SECONDARY } from '../../../constants/common'

export default class AccountListItem extends Component {

  static propTypes = {
    account: PropTypes.object,
    className: PropTypes.string,
    conversionRate: PropTypes.number,
    currentCurrency: PropTypes.string,
    displayAddress: PropTypes.bool,
    displayBalance: PropTypes.bool,
    handleClick: PropTypes.func,
    icon: PropTypes.node,
  };

  static contextTypes = {
    t: PropTypes.func,
  };

  render () {
    const {
      account,
      className,
      displayAddress = false,
      displayBalance = true,
      handleClick,
      icon = null,
    } = this.props

    const { name, address, balance } = account || {}

    return (<div
      className={`account-list-item ${className}`}
      onClick={() => handleClick({ name, address, balance })}
    >

      <div className="account-list-item__top-row">
        <Identicon
          address={address}
          className="account-list-item__identicon"
          diameter={18}
        />

        <div className="account-list-item__account-name">{ name || address }</div>

        {icon && <div className="account-list-item__icon">{ icon }</div>}

      </div>

      {displayAddress && name && <div className="account-list-item__account-address">
        { checksumAddress(address) }
      </div>}

      {
        displayBalance && (
          <div className="account-list-item__account-balances">
            <UserPreferencedCurrencyDisplay
              type={PRIMARY}
              value={balance}
            />
            <UserPreferencedCurrencyDisplay
              type={SECONDARY}
              value={balance}
            />
          </div>
        )
      }

    </div>)
  }
}
