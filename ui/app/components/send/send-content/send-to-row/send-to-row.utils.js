const {
  REQUIRED_ERROR,
  INVALID_RECIPIENT_ADDRESS_ERROR,
} = require('../../send.constants')
const { isValidAddress } = require('../../../../util')

function getToErrorObject (to, toError = null, hasHexData = false) {
  if (!to) {
    if (!hasHexData) {
      toError = REQUIRED_ERROR
    }
  } else if (!isValidAddress(to) && !toError) {
    toError = INVALID_RECIPIENT_ADDRESS_ERROR
  }

  return { to: toError }
}

module.exports = {
  getToErrorObject,
}
