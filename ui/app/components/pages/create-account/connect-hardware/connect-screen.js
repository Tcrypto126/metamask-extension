const { Component } = require('react')
const PropTypes = require('prop-types')
const h = require('react-hyperscript')

class ConnectScreen extends Component {
    constructor (props, context) {
        super(props)
    }

    renderUnsupportedBrowser () {
        return (
            h('div', {}, [
                h('div.hw-connect', [
                    h('h3.hw-connect__title', {}, this.context.t('browserNotSupported')),
                    h('p.hw-connect__msg', {}, this.context.t('chromeRequiredForTrezor')),
                ]),
                h(
                    'button.btn-primary.btn--large',
                    { onClick: () => global.platform.openWindow({
                    url: 'https://google.com/chrome',
                    }), style: { margin: 12 } },
                    this.context.t('downloadGoogleChrome')
                ),
            ])
        )
    }

    renderConnectScreen () {
        return (
            h('div', {}, [
                h('div.hw-connect', [
                    h('h3.hw-connect__title', {}, this.context.t('trezorHardwareWallet')),
                    h('p.hw-connect__msg', {}, this.context.t('connectToTrezorHelp')),
                    h('p.hw-connect__msg', {}, [
                        this.context.t('connectToTrezorTrouble'),
                        h('a.___info-link', { url: 'https://support.metamask.io/', target: '_blank'}, this.context.t('learnMore')),
                    ]),
                ]),
                h(
                    'button.btn-primary.btn--large',
                    { onClick: this.props.connectToTrezor.bind(this) },
                    this.props.btnText
                ),
            ])
        )
      }

    render () {
        const isChrome = window.navigator.userAgent.search('Chrome') !== -1
        if (isChrome) {
            return this.renderConnectScreen()
        }
        return this.renderUnsupportedBrowser()
    }
}

ConnectScreen.propTypes = {
    connectToTrezor: PropTypes.func.isRequired,
    btnText: PropTypes.string,
}

ConnectScreen.contextTypes = {
    t: PropTypes.func,
}

module.exports = ConnectScreen

