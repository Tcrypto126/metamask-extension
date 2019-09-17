const { Component } = require('react')
const connect = require('react-redux').connect
const PropTypes = require('prop-types')
const { withRouter } = require('react-router-dom')
const { compose } = require('recompose')
const t = require('../utils/i18n-helper').getMessage

class I18nProvider extends Component {
  tOrDefault = (key, defaultValue, ...args) => {
    const { localeMessages: { current, en } = {}, currentLocale } = this.props
    return t(currentLocale, current, key, ...args) || t(currentLocale, en, key, ...args) || defaultValue
  }

  getChildContext () {
    const { localeMessages, currentLocale } = this.props
    const { current, en } = localeMessages
    return {
      /**
       * Returns a localized message for the given key
       * @param {string} key The message key
       * @param {string[]} args A list of message substitution replacements
       * @return {string|undefined|null} The localized message if available
       */
      t (key, ...args) {
        if (key === undefined || key === null) {
          return key
        }

        return t(currentLocale, current, key, ...args) || t(currentLocale, en, key, ...args) || `[${key}]`
      },
      tOrDefault: this.tOrDefault,
      tOrKey: (key, ...args) => {
        return this.tOrDefault(key, key, ...args)
      },
    }
  }

  render () {
    return this.props.children
  }
}

I18nProvider.propTypes = {
  localeMessages: PropTypes.object,
  currentLocale: PropTypes.string,
  children: PropTypes.object,
}

I18nProvider.childContextTypes = {
  t: PropTypes.func,
  tOrDefault: PropTypes.func,
  tOrKey: PropTypes.func,
}

const mapStateToProps = state => {
  const { localeMessages, metamask: { currentLocale } } = state
  return {
    currentLocale,
    localeMessages,
  }
}

module.exports = compose(
  withRouter,
  connect(mapStateToProps)
)(I18nProvider)

