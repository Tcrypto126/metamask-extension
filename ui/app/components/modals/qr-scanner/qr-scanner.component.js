import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { BrowserQRCodeReader } from '@zxing/library'
import adapter from 'webrtc-adapter' // eslint-disable-line import/no-nodejs-modules, no-unused-vars
import Spinner from '../../spinner'
import WebcamUtils from '../../../../lib/webcam-utils'

export default class QrScanner extends Component {
  static propTypes = {
    hideModal: PropTypes.func.isRequired,
    qrCodeDetected: PropTypes.func,
    scanQrCode: PropTypes.func,
    error: PropTypes.bool,
    errorType: PropTypes.string,
  }

  static contextTypes = {
    t: PropTypes.func,
  }

  constructor (props, context) {
    super(props)

    this.state = {
      ready: false,
      msg: context.t('accessingYourCamera'),
    }
    this.codeReader = null
    this.permissionChecker = null
    this.needsToReinit = false

    // Clear pre-existing qr code data before scanning
    this.props.qrCodeDetected(null)
  }

  componentDidMount () {
    this.initCamera()
  }

  async checkPermisisions () {
    const { permissions } = await WebcamUtils.checkStatus()
    if (permissions) {
      clearTimeout(this.permissionChecker)
      // Let the video stream load first...
      setTimeout(_ => {
        this.setState({
          ready: true,
          msg: this.context.t('scanInstructions'),
        })
        if (this.needsToReinit) {
          this.initCamera()
          this.needsToReinit = false
        }
      }, 2000)
    } else {
      // Keep checking for permissions
      this.permissionChecker = setTimeout(_ => {
        this.checkPermisisions()
      }, 1000)
    }
  }

  componentWillUnmount () {
    clearTimeout(this.permissionChecker)
    if (this.codeReader) {
      this.codeReader.reset()
    }
  }

  initCamera () {
    this.codeReader = new BrowserQRCodeReader()
    this.codeReader.getVideoInputDevices()
      .then(videoInputDevices => {
        clearTimeout(this.permissionChecker)
        this.checkPermisisions()
        this.codeReader.decodeFromInputVideoDevice(undefined, 'video')
        .then(content => {
          const result = this.parseContent(content.text)
          if (result.type !== 'unknown') {
            this.props.qrCodeDetected(result)
            this.stopAndClose()
          } else {
            this.setState({msg: this.context.t('unknownQrCode')})
          }
        })
        .catch(err => {
          if (err && err.name === 'NotAllowedError') {
            this.setState({msg: this.context.t('youNeedToAllowCameraAccess')})
            clearTimeout(this.permissionChecker)
            this.needsToReinit = true
            this.checkPermisisions()
          }
        })
      }).catch(err => {
        console.error('[QR-SCANNER]: getVideoInputDevices threw an exception: ', err)
      })
  }

  parseContent (content) {
    let type = 'unknown'
    let values = {}

    // Here we could add more cases
    // To parse other type of links
    // For ex. EIP-681 (https://eips.ethereum.org/EIPS/eip-681)

    if (content.split('ethereum:').length > 1) {
      type = 'address'
      values = {'address': content.split('ethereum:')[1] }
    }
    return {type, values}
  }


  stopAndClose = () => {
    if (this.codeReader) {
      this.codeReader.reset()
    }
    this.setState({ ready: false })
    this.props.hideModal()
  }

  tryAgain = () => {
    // close the modal
    this.stopAndClose()
    // wait for the animation and try again
    setTimeout(_ => {
      this.props.scanQrCode()
    }, 1000)
  }

  renderVideo () {
    return (
      <div className={'qr-scanner__content__video-wrapper'}>
        <video
          id="video"
          style={{
            display: this.state.ready ? 'block' : 'none',
          }}
        />
        { !this.state.ready ? <Spinner color={'#F7C06C'} /> : null}
      </div>
    )
  }

  renderErrorModal () {
    let title, msg

    if (this.props.error) {
      if (this.props.errorType === 'NO_WEBCAM_FOUND') {
        title = this.context.t('noWebcamFoundTitle')
        msg = this.context.t('noWebcamFound')
      } else {
        title = this.context.t('unknownCameraErrorTitle')
        msg = this.context.t('unknownCameraError')
      }
    }

    return (
      <div className="qr-scanner">
        <div className="qr-scanner__close" onClick={this.stopAndClose}></div>

        <div className="qr-scanner__image">
          <img src={'images/webcam.svg'} width={70} height={70} />
        </div>
        <div className="qr-scanner__title">
          { title }
        </div>
        <div className={'qr-scanner__error'}>
          {msg}
        </div>
        <div className={'qr-scanner__footer'}>
          <button className="btn-default btn--large" onClick={this.stopAndClose}>
            CANCEL
          </button>
          <button className="btn-primary btn--large" onClick={this.tryAgain}>
            TRY AGAIN
          </button>
        </div>
      </div>
    )
  }

  render () {
    const { t } = this.context

    if (this.props.error) {
      return this.renderErrorModal()
    }

    return (
      <div className="qr-scanner">
        <div className="qr-scanner__close" onClick={this.stopAndClose}></div>
        <div className="qr-scanner__title">
          { `${t('scanQrCode')}` }
        </div>
        <div className="qr-scanner__content">
          { this.renderVideo() }
        </div>
        <div className={'qr-scanner__status'}>
          {this.state.msg}
        </div>
      </div>
    )
  }
}
