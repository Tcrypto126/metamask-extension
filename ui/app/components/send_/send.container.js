import { connect } from 'react-redux'
import SendEther from './send.component'
import { withRouter } from 'react-router-dom'
import { compose } from 'recompose'
import {
  getAmountConversionRate,
  getBlockGasLimit,
  getConversionRate,
  getCurrentNetwork,
  getGasLimit,
  getGasPrice,
  getGasTotal,
  getPrimaryCurrency,
  getRecentBlocks,
  getSelectedAddress,
  getSelectedToken,
  getSelectedTokenContract,
  getSelectedTokenToFiatRate,
  getSendAmount,
  getSendEditingTransactionId,
  getSendFromObject,
  getTokenBalance,
} from './send.selectors'
import {
  updateSendTokenBalance,
  updateGasData,
  setGasTotal,
} from '../../actions'
import {
  updateSendErrors,
} from '../../ducks/send.duck'
import {
  calcGasTotal,
  generateTokenTransferData,
} from './send.utils.js'

module.exports = compose(
  withRouter,
  connect(mapStateToProps, mapDispatchToProps)
)(SendEther)

function mapStateToProps (state) {
  const selectedAddress = getSelectedAddress(state)
  const selectedToken = getSelectedToken(state)

  return {
    amount: getSendAmount(state),
    amountConversionRate: getAmountConversionRate(state),
    blockGasLimit: getBlockGasLimit(state),
    conversionRate: getConversionRate(state),
    data: generateTokenTransferData(selectedAddress, selectedToken),
    editingTransactionId: getSendEditingTransactionId(state),
    from: getSendFromObject(state),
    gasLimit: getGasLimit(state),
    gasPrice: getGasPrice(state),
    gasTotal: getGasTotal(state),
    network: getCurrentNetwork(state),
    primaryCurrency: getPrimaryCurrency(state),
    recentBlocks: getRecentBlocks(state),
    selectedAddress: getSelectedAddress(state),
    selectedToken: getSelectedToken(state),
    tokenBalance: getTokenBalance(state),
    tokenContract: getSelectedTokenContract(state),
    tokenToFiatRate: getSelectedTokenToFiatRate(state),
  }
}

function mapDispatchToProps (dispatch) {
  return {
    updateAndSetGasTotal: ({
      blockGasLimit,
      data,
      editingTransactionId,
      gasLimit,
      gasPrice,
      recentBlocks,
      selectedAddress,
      selectedToken,
    }) => {
      !editingTransactionId
        ? dispatch(updateGasData({ recentBlocks, selectedAddress, selectedToken, data, blockGasLimit }))
        : dispatch(setGasTotal(calcGasTotal(gasLimit, gasPrice)))
    },
    updateSendTokenBalance: ({ selectedToken, tokenContract, address }) => {
      dispatch(updateSendTokenBalance({
        selectedToken,
        tokenContract,
        address,
      }))
    },
    updateSendErrors: newError => dispatch(updateSendErrors(newError)),
  }
}
