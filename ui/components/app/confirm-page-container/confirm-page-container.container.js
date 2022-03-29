import { connect } from 'react-redux';
import { getAccountsWithLabels, getAddressBookEntry } from '../../../selectors';
import { showModal } from '../../../store/actions';
import ConfirmPageContainer from './confirm-page-container.component';

function mapStateToProps(state, ownProps) {
  const to = ownProps.toAddress;

  const contact = getAddressBookEntry(state, to);
  return {
    contact,
    toName: contact?.name || ownProps.toName,
    isOwnedAccount: getAccountsWithLabels(state)
      .map((accountWithLabel) => accountWithLabel.address)
      .includes(to),
    to,
  };
}

const mapDispatchToProps = (dispatch) => {
  return {
    showBuyModal: () => dispatch(showModal({ name: 'DEPOSIT_ETHER' })),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(ConfirmPageContainer);
