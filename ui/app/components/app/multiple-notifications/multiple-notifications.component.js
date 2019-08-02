import React, { PureComponent } from 'react'
import classnames from 'classnames'
import PropTypes from 'prop-types'

export default class MultipleNotifications extends PureComponent {
  static propTypes = {
    notifications: PropTypes.array,
    classNames: PropTypes.array,
  }

  state = {
    showAll: false,
  }

  render () {
    const { showAll } = this.state
    const { notifications, classNames = [] } = this.props

    return (<div
      className={classnames(...classNames, {
        'home-notification-wrapper--show-all': showAll,
        'home-notification-wrapper--show-first': !showAll,
      })}
    >
      {notifications
        .filter(notificationConfig => notificationConfig.shouldBeRendered)
        .map(notificationConfig => notificationConfig.component)
      }
      <div
        className="home-notification-wrapper__i-container"
        onClick={() => this.setState({ showAll: !showAll })}
      >
        {notifications.length > 1 ? <i className={classnames('fa fa-sm fa-sort-amount-asc', {
          'flipped': !showAll,
        })} /> : null}
      </div>
    </div>)
  }
}
