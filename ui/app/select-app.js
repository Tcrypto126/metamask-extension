const inherits = require('util').inherits
const Component = require('react').Component
const connect = require('react-redux').connect
const h = require('react-hyperscript')
const App = require('./app')
const OldApp = require('../../old-ui/app/app')
const { autoAddToBetaUI } = require('./selectors')
const { setFeatureFlag } = require('./actions')

function mapStateToProps (state) {
	return {
		betaUI: state.metamask.featureFlags.betaUI,
		autoAdd: autoAddToBetaUI(state),
		isUnlocked: state.metamask.isUnlocked,
		isMascara: state.metamask.isMascara,
		firstTime: Object.keys(state.metamask.identities).length === 0,
	}
}

function mapDispatchToProps (dispatch) {
  return {
    setFeatureFlagWithModal: () => dispatch(setFeatureFlag('betaUI', true, 'BETA_UI_NOTIFICATION_MODAL')),
    setFeatureFlagWithoutModal: () => dispatch(setFeatureFlag('betaUI', true)),
  }
}
module.exports = connect(mapStateToProps, mapDispatchToProps)(SelectedApp)

inherits(SelectedApp, Component)
function SelectedApp () {
	Component.call(this)
}

SelectedApp.prototype.componentWillReceiveProps = function (nextProps) {
	const {
		isUnlocked,
		setFeatureFlagWithModal,
		setFeatureFlagWithoutModal,
		isMascara,
		firstTime,
	} = this.props

	if (isMascara || firstTime) {
		setFeatureFlagWithoutModal()
	} else if (!isUnlocked && nextProps.isUnlocked && (nextProps.autoAdd)) {
		setFeatureFlagWithModal()
	}
}

SelectedApp.prototype.render = function () {
  const { betaUI, isMascara, firstTime } = this.props

  const Selected = betaUI || isMascara || firstTime ? App : OldApp
  return h(Selected)
}
