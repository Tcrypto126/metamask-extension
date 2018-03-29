const { Component } = require('react')
const PropTypes = require('prop-types')
const h = require('react-hyperscript')
const connect = require('../../../metamask-connect')

class Info extends Component {
  renderLogo () {
    return (
      h('div.settings__info-logo-wrapper', [
        h('img.settings__info-logo', { src: 'images/info-logo.png' }),
      ])
    )
  }

  renderInfoLinks () {
    return (
      h('div.settings__content-item.settings__content-item--without-height', [
        h('div.settings__info-link-header', this.props.t('links')),
        h('div.settings__info-link-item', [
          h('a', {
            href: 'https://metamask.io/privacy.html',
            target: '_blank',
          }, [
            h('span.settings__info-link', this.props.t('privacyMsg')),
          ]),
        ]),
        h('div.settings__info-link-item', [
          h('a', {
            href: 'https://metamask.io/terms.html',
            target: '_blank',
          }, [
            h('span.settings__info-link', this.props.t('terms')),
          ]),
        ]),
        h('div.settings__info-link-item', [
          h('a', {
            href: 'https://metamask.io/attributions.html',
            target: '_blank',
          }, [
            h('span.settings__info-link', this.props.t('attributions')),
          ]),
        ]),
        h('hr.settings__info-separator'),
        h('div.settings__info-link-item', [
          h('a', {
            href: 'https://support.metamask.io',
            target: '_blank',
          }, [
            h('span.settings__info-link', this.props.t('supportCenter')),
          ]),
        ]),
        h('div.settings__info-link-item', [
          h('a', {
            href: 'https://metamask.io/',
            target: '_blank',
          }, [
            h('span.settings__info-link', this.props.t('visitWebSite')),
          ]),
        ]),
        h('div.settings__info-link-item', [
          h('a', {
            target: '_blank',
            href: 'mailto:help@metamask.io?subject=Feedback',
          }, [
            h('span.settings__info-link', this.props.t('emailUs')),
          ]),
        ]),
      ])
    )
  }

  render () {
    return (
      h('div.settings__content', [
        h('div.settings__content-row', [
          h('div.settings__content-item.settings__content-item--without-height', [
            this.renderLogo(),
            h('div.settings__info-item', [
              h('div.settings__info-version-header', 'MetaMask Version'),
              h('div.settings__info-version-number', '4.0.0'),
            ]),
            h('div.settings__info-item', [
              h(
                'div.settings__info-about',
                this.props.t('builtInCalifornia')
              ),
            ]),
          ]),
          this.renderInfoLinks(),
        ]),
      ])
    )
  }
}

Info.propTypes = {
  tab: PropTypes.string,
  metamask: PropTypes.object,
  setCurrentCurrency: PropTypes.func,
  setRpcTarget: PropTypes.func,
  displayWarning: PropTypes.func,
  revealSeedConfirmation: PropTypes.func,
  warning: PropTypes.string,
  location: PropTypes.object,
  history: PropTypes.object,
  t: PropTypes.func,
}

module.exports = connect()(Info)
