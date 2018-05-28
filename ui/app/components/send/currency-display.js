const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
const { conversionUtil, multiplyCurrencies } = require('../../conversion-util')
const currencyFormatter = require('currency-formatter')
const currencies = require('currency-formatter/currencies')
const NumericInput = require('react-numeric-input')

module.exports = CurrencyDisplay

inherits(CurrencyDisplay, Component)
function CurrencyDisplay () {
  Component.call(this)
}

function toHexWei (value) {
  return conversionUtil(value, {
    fromNumericBase: 'dec',
    toNumericBase: 'hex',
    toDenomination: 'WEI',
  })
}

CurrencyDisplay.prototype.componentWillMount = function () {
  this.setState({
    valueToRender: this.getValueToRender(this.props),
  })
}

CurrencyDisplay.prototype.componentWillReceiveProps = function (nextProps) {
  const currentValueToRender = this.getValueToRender(this.props)
  const newValueToRender = this.getValueToRender(nextProps)
  if (currentValueToRender !== newValueToRender) {
    this.setState({
      valueToRender: newValueToRender,
    })
  }
}

CurrencyDisplay.prototype.getAmount = function (value) {
  const { selectedToken } = this.props
  const { decimals } = selectedToken || {}
  const multiplier = Math.pow(10, Number(decimals || 0))

  const sendAmount = multiplyCurrencies(value || '0', multiplier, {toNumericBase: 'hex'})

  return selectedToken
    ? sendAmount
    : toHexWei(value)
}

CurrencyDisplay.prototype.getValueToRender = function ({ selectedToken, conversionRate, value }) {
  if (value === '0x0') return ''
  const { decimals, symbol } = selectedToken || {}
  const multiplier = Math.pow(10, Number(decimals || 0))

  return selectedToken
    ? conversionUtil(value, {
      fromNumericBase: 'hex',
      toCurrency: symbol,
      conversionRate: multiplier,
      invertConversionRate: true,
    })
    : conversionUtil(value, {
      fromNumericBase: 'hex',
      toNumericBase: 'dec',
      fromDenomination: 'WEI',
      numberOfDecimals: 6,
      conversionRate,
    })
}

CurrencyDisplay.prototype.getConvertedValueToRender = function (nonFormattedValue) {
  const { primaryCurrency, convertedCurrency, conversionRate } = this.props

  let convertedValue = conversionUtil(nonFormattedValue, {
    fromNumericBase: 'dec',
    fromCurrency: primaryCurrency,
    toCurrency: convertedCurrency,
    numberOfDecimals: 2,
    conversionRate,
  })
  convertedValue = Number(convertedValue).toFixed(2)

  const upperCaseCurrencyCode = convertedCurrency.toUpperCase()

  return currencies.find(currency => currency.code === upperCaseCurrencyCode)
    ? currencyFormatter.format(Number(convertedValue), {
      code: upperCaseCurrencyCode,
    })
    : convertedValue
}

CurrencyDisplay.prototype.handleChange = function (newVal) {
  this.setState({ valueToRender: newVal })
  this.props.onChange(this.getAmount(newVal))
}

CurrencyDisplay.prototype.getInputWidth = function (valueToRender, readOnly) {
  const valueString = String(valueToRender)
  const valueLength = valueString.length || 1
  const dynamicBuffer = readOnly ? 0 : 1
  const decimalPointDeficit = !readOnly && valueString.match(/\./) ? -0.5 : 0
  return (valueLength + dynamicBuffer + decimalPointDeficit) + 'ch'
}

CurrencyDisplay.prototype.render = function () {
  const {
    className = 'currency-display',
    primaryBalanceClassName = 'currency-display__input',
    convertedBalanceClassName = 'currency-display__converted-value',
    primaryCurrency,
    convertedCurrency,
    readOnly = false,
    inError = false,
    onBlur,
  } = this.props
  const { valueToRender } = this.state

  const convertedValueToRender = this.getConvertedValueToRender(valueToRender)

  return h('div', {
    className,
    style: {
      borderColor: inError ? 'red' : null,
    },
    onClick: () => this.currencyInput && this.currencyInput.focus(),
  }, [

    h('div.currency-display__primary-row', [

      h('div.currency-display__input-wrapper', [

        h(NumericInput, {
          className: primaryBalanceClassName,
          value: `${valueToRender}`,
          placeholder: `0 ${primaryCurrency}`,
          readOnly,
          ...(!readOnly ? {
            onChange: e => this.handleChange(e),
            onBlur: () => onBlur(this.getAmount(valueToRender)),
          } : {}),
          style: false,
          format: num => `${num} ${primaryCurrency}`,
          parse: stringWithCurrency => stringWithCurrency && stringWithCurrency.match(/^([.\d]+)/)[1],
        }),

      ]),

    ]),

    h('div', {
      className: convertedBalanceClassName,
    }, `${convertedValueToRender} ${convertedCurrency.toUpperCase()}`),

  ])

}

