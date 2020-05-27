import React from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'

const MenuItem = ({ children, className, iconClassName, onClick, subtitle }) => (
  <button className={classnames('menu-item', className)} onClick={onClick}>
    {
      iconClassName
        ? (
          <i className={classnames('menu-item__icon', iconClassName)} />
        )
        : null
    }
    <span>{children}</span>
    { subtitle }
  </button>
)

MenuItem.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  iconClassName: PropTypes.string,
  onClick: PropTypes.func,
  subtitle: PropTypes.node,
}

MenuItem.defaultProps = {
  className: undefined,
  iconClassName: undefined,
  onClick: undefined,
  subtitle: undefined,
}

export default MenuItem
