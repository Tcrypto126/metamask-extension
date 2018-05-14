const ethUtil = require('ethereumjs-util')
const { conversionUtil, multiplyCurrencies } = require('../../conversion-util')

const MIN_GAS_PRICE_DEC = '0'
const MIN_GAS_PRICE_HEX = (parseInt(MIN_GAS_PRICE_DEC)).toString(16)
const MIN_GAS_LIMIT_DEC = '21000'
const MIN_GAS_LIMIT_HEX = (parseInt(MIN_GAS_LIMIT_DEC)).toString(16)

const MIN_GAS_PRICE_GWEI = ethUtil.addHexPrefix(conversionUtil(MIN_GAS_PRICE_HEX, {
  fromDenomination: 'WEI',
  toDenomination: 'GWEI',
  fromNumericBase: 'hex',
  toNumericBase: 'hex',
  numberOfDecimals: 1,
}))

const MIN_GAS_TOTAL = multiplyCurrencies(MIN_GAS_LIMIT_HEX, MIN_GAS_PRICE_HEX, {
  toNumericBase: 'hex',
  multiplicandBase: 16,
  multiplierBase: 16,
})

const TOKEN_TRANSFER_FUNCTION_SIGNATURE = '0xa9059cbb'

const INSUFFICIENT_FUNDS_ERROR = 'insufficientFunds'
const INSUFFICIENT_TOKENS_ERROR = 'insufficientTokens'
const NEGATIVE_ETH_ERROR = 'negativeETH'
const INVALID_RECIPIENT_ADDRESS_ERROR = 'invalidAddressRecipient'
const REQUIRED_ERROR = 'required'

module.exports = {
  INSUFFICIENT_FUNDS_ERROR,
  INSUFFICIENT_TOKENS_ERROR,
  INVALID_RECIPIENT_ADDRESS_ERROR,
  MIN_GAS_LIMIT_DEC,
  MIN_GAS_LIMIT_HEX,
  MIN_GAS_PRICE_DEC,
  MIN_GAS_PRICE_GWEI,
  MIN_GAS_PRICE_HEX,
  MIN_GAS_TOTAL,
  NEGATIVE_ETH_ERROR,
  REQUIRED_ERROR,
  TOKEN_TRANSFER_FUNCTION_SIGNATURE,
}
