import { connect } from 'react-redux';
import {
  buyEth,
  hideModal,
  showModal,
  hideWarning,
} from '../../../../store/actions';
import {
  getIsTestnet,
  getIsMainnet,
  getCurrentChainId,
  getSelectedAddress,
  getIsBuyableTransakChain,
  getIsBuyableMoonPayChain,
  getIsBuyableWyreChain,
  getIsBuyableCoinbasePayChain,
} from '../../../../selectors/selectors';
import DepositEtherModal from './deposit-ether-modal.component';

function mapStateToProps(state) {
  return {
    chainId: getCurrentChainId(state),
    isTestnet: getIsTestnet(state),
    isMainnet: getIsMainnet(state),
    address: getSelectedAddress(state),
    isBuyableTransakChain: getIsBuyableTransakChain(state),
    isBuyableMoonPayChain: getIsBuyableMoonPayChain(state),
    isBuyableWyreChain: getIsBuyableWyreChain(state),
    isBuyableCoinbasePayChain: getIsBuyableCoinbasePayChain(state),
  };
}

function mapDispatchToProps(dispatch) {
  return {
    toWyre: (address, chainId) => {
      dispatch(buyEth({ service: 'wyre', address, chainId }));
    },
    toTransak: (address, chainId) => {
      dispatch(buyEth({ service: 'transak', address, chainId }));
    },
    toMoonPay: (address, chainId) => {
      dispatch(buyEth({ service: 'moonpay', address, chainId }));
    },
    toCoinbasePay: (address, chainId) => {
      dispatch(buyEth({ service: 'coinbase', address, chainId }));
    },
    hideModal: () => {
      dispatch(hideModal());
    },
    hideWarning: () => {
      dispatch(hideWarning());
    },
    showAccountDetailModal: () => {
      dispatch(showModal({ name: 'ACCOUNT_DETAILS' }));
    },
    toFaucet: (chainId) => dispatch(buyEth({ chainId })),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(DepositEtherModal);
