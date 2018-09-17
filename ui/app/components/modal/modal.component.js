import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import Button from '../button'

export default class Modal extends PureComponent {
  static propTypes = {
    children: PropTypes.node,
    // Header text
    headerText: PropTypes.string,
    // Submit button (right button)
    onSubmit: PropTypes.func,
    submitType: PropTypes.string,
    submitText: PropTypes.string,
    // Cancel button (left button)
    onCancel: PropTypes.func,
    cancelType: PropTypes.string,
    cancelText: PropTypes.string,
  }

  static defaultProps = {
    submitType: 'primary',
    cancelType: 'default',
  }

  render () {
    const {
      children,
      headerText,
      onSubmit,
      submitType,
      submitText,
      onCancel,
      cancelType,
      cancelText,
    } = this.props

    return (
      <div className="modal-container">
        {
          headerText && (
            <div className="modal-container__header">
              <div className="modal-container__header-text">
                { headerText }
              </div>
              <div
                className="modal-container__header-close"
                onClick={() => onCancel()}
              />
            </div>
          )
        }
        <div className="modal-container__content">
          { children }
        </div>
        <div className="modal-container__footer">
          {
            onCancel && (
              <Button
                type={cancelType}
                onClick={onCancel}
                className="modal-container__footer-button"
              >
                { cancelText }
              </Button>
            )
          }
          <Button
            type={submitType}
            onClick={onSubmit}
            className="modal-container__footer-button"
          >
            { submitText }
          </Button>
        </div>
      </div>
    )
  }
}
