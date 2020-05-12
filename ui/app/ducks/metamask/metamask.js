import * as actionConstants from '../../store/actionConstants'
import { ALERT_TYPES } from '../../../../app/scripts/controllers/alert'

export default function reduceMetamask (state = {}, action) {
  const metamaskState = Object.assign({
    isInitialized: false,
    isUnlocked: false,
    isAccountMenuOpen: false,
    rpcTarget: 'https://rawtestrpc.metamask.io/',
    identities: {},
    unapprovedTxs: {},
    frequentRpcList: [],
    addressBook: [],
    selectedTokenAddress: null,
    contractExchangeRates: {},
    tokens: [],
    pendingTokens: {},
    customNonceValue: '',
    send: {
      gasLimit: null,
      gasPrice: null,
      gasTotal: null,
      tokenBalance: '0x0',
      from: '',
      to: '',
      amount: '0',
      memo: '',
      errors: {},
      maxModeOn: false,
      editingTransactionId: null,
      toNickname: '',
      ensResolution: null,
      ensResolutionError: '',
    },
    coinOptions: {},
    useBlockie: false,
    featureFlags: {},
    networkEndpointType: undefined,
    welcomeScreenSeen: false,
    currentLocale: '',
    preferences: {
      useNativeCurrencyAsPrimaryCurrency: true,
      showFiatInTestnets: false,
    },
    firstTimeFlowType: null,
    completedOnboarding: false,
    knownMethodData: {},
    participateInMetaMetrics: null,
    metaMetricsSendCount: 0,
    nextNonce: null,
  }, state)

  switch (action.type) {

    case actionConstants.UPDATE_METAMASK_STATE:
      return { ...metamaskState, ...action.value }

    case actionConstants.LOCK_METAMASK:
      return {
        ...metamaskState,
        isUnlocked: false,
      }

    case actionConstants.SET_RPC_TARGET:
      return {
        ...metamaskState,
        provider: {
          type: 'rpc',
          rpcTarget: action.value,
        },
      }

    case actionConstants.SET_PROVIDER_TYPE:
      return {
        ...metamaskState,
        provider: {
          type: action.value,
        },
      }

    case actionConstants.SHOW_ACCOUNT_DETAIL:
      return {
        ...metamaskState,
        isUnlocked: true,
        isInitialized: true,
        selectedAddress: action.value,
      }

    case actionConstants.SET_SELECTED_TOKEN: {
      const newState = {
        ...metamaskState,
        selectedTokenAddress: action.value,
      }
      const newSend = { ...metamaskState.send }

      if (metamaskState.send.editingTransactionId && !action.value) {
        delete newSend.token
        const unapprovedTx = newState.unapprovedTxs[newSend.editingTransactionId] || {}
        const txParams = unapprovedTx.txParams || {}
        newState.unapprovedTxs = {
          ...newState.unapprovedTxs,
          [newSend.editingTransactionId]: {
            ...unapprovedTx,
            txParams: { ...txParams, data: '' },
          },
        }
        newSend.tokenBalance = null
        newSend.balance = '0'
        newSend.from = unapprovedTx.from || ''
      }

      newState.send = newSend
      return newState
    }

    case actionConstants.SET_ACCOUNT_LABEL:
      const account = action.value.account
      const name = action.value.label
      const id = {}
      id[account] = Object.assign({}, metamaskState.identities[account], { name })
      const identities = Object.assign({}, metamaskState.identities, id)
      return Object.assign(metamaskState, { identities })

    case actionConstants.SET_CURRENT_FIAT:
      return Object.assign(metamaskState, {
        currentCurrency: action.value.currentCurrency,
        conversionRate: action.value.conversionRate,
        conversionDate: action.value.conversionDate,
      })

    case actionConstants.UPDATE_TOKENS:
      return {
        ...metamaskState,
        tokens: action.newTokens,
      }

    // metamask.send
    case actionConstants.UPDATE_GAS_LIMIT:
      return {
        ...metamaskState,
        send: {
          ...metamaskState.send,
          gasLimit: action.value,
        },
      }
    case actionConstants.UPDATE_CUSTOM_NONCE:
      return {
        ...metamaskState,
        customNonceValue: action.value,
      }
    case actionConstants.UPDATE_GAS_PRICE:
      return {
        ...metamaskState,
        send: {
          ...metamaskState.send,
          gasPrice: action.value,
        },
      }

    case actionConstants.TOGGLE_ACCOUNT_MENU:
      return {
        ...metamaskState,
        isAccountMenuOpen: !metamaskState.isAccountMenuOpen,
      }

    case actionConstants.UPDATE_GAS_TOTAL:
      return {
        ...metamaskState,
        send: {
          ...metamaskState.send,
          gasTotal: action.value,
        },
      }

    case actionConstants.UPDATE_SEND_TOKEN_BALANCE:
      return {
        ...metamaskState,
        send: {
          ...metamaskState.send,
          tokenBalance: action.value,
        },
      }

    case actionConstants.UPDATE_SEND_HEX_DATA:
      return {
        ...metamaskState,
        send: {
          ...metamaskState.send,
          data: action.value,
        },
      }

    case actionConstants.UPDATE_SEND_TO:
      return {
        ...metamaskState,
        send: {
          ...metamaskState.send,
          to: action.value.to,
          toNickname: action.value.nickname,
        },
      }

    case actionConstants.UPDATE_SEND_AMOUNT:
      return {
        ...metamaskState,
        send: {
          ...metamaskState.send,
          amount: action.value,
        },
      }

    case actionConstants.UPDATE_MAX_MODE:
      return {
        ...metamaskState,
        send: {
          ...metamaskState.send,
          maxModeOn: action.value,
        },
      }

    case actionConstants.UPDATE_SEND:
      return Object.assign(metamaskState, {
        send: {
          ...metamaskState.send,
          ...action.value,
        },
      })

    case actionConstants.UPDATE_SEND_ENS_RESOLUTION:
      return {
        ...metamaskState,
        send: {
          ...metamaskState.send,
          ensResolution: action.payload,
          ensResolutionError: '',
        },
      }

    case actionConstants.UPDATE_SEND_ENS_RESOLUTION_ERROR:
      return {
        ...metamaskState,
        send: {
          ...metamaskState.send,
          ensResolution: null,
          ensResolutionError: action.payload,
        },
      }

    case actionConstants.CLEAR_SEND:
      return {
        ...metamaskState,
        send: {
          gasLimit: null,
          gasPrice: null,
          gasTotal: null,
          tokenBalance: null,
          from: '',
          to: '',
          amount: '0x0',
          memo: '',
          errors: {},
          maxModeOn: false,
          editingTransactionId: null,
          toNickname: '',
        },
      }

    case actionConstants.UPDATE_TRANSACTION_PARAMS:
      const { id: txId, value } = action
      let { currentNetworkTxList } = metamaskState
      currentNetworkTxList = currentNetworkTxList.map((tx) => {
        if (tx.id === txId) {
          const newTx = Object.assign({}, tx)
          newTx.txParams = value
          return newTx
        }
        return tx
      })

      return {
        ...metamaskState,
        currentNetworkTxList,
      }

    case actionConstants.SET_PARTICIPATE_IN_METAMETRICS:
      return {
        ...metamaskState,
        participateInMetaMetrics: action.value,
      }

    case actionConstants.SET_METAMETRICS_SEND_COUNT:
      return {
        ...metamaskState,
        metaMetricsSendCount: action.value,
      }

    case actionConstants.SET_USE_BLOCKIE:
      return {
        ...metamaskState,
        useBlockie: action.value,
      }

    case actionConstants.UPDATE_FEATURE_FLAGS:
      return {
        ...metamaskState,
        featureFlags: action.value,
      }

    case actionConstants.CLOSE_WELCOME_SCREEN:
      return {
        ...metamaskState,
        welcomeScreenSeen: true,
      }

    case actionConstants.SET_CURRENT_LOCALE:
      return {
        ...metamaskState,
        currentLocale: action.value.locale,
      }

    case actionConstants.SET_PENDING_TOKENS:
      return {
        ...metamaskState,
        pendingTokens: { ...action.payload },
      }

    case actionConstants.CLEAR_PENDING_TOKENS: {
      return {
        ...metamaskState,
        pendingTokens: {},
      }
    }

    case actionConstants.UPDATE_PREFERENCES: {
      return {
        ...metamaskState,
        preferences: {
          ...metamaskState.preferences,
          ...action.payload,
        },
      }
    }

    case actionConstants.COMPLETE_ONBOARDING: {
      return {
        ...metamaskState,
        completedOnboarding: true,
      }
    }

    case actionConstants.SET_FIRST_TIME_FLOW_TYPE: {
      return {
        ...metamaskState,
        firstTimeFlowType: action.value,
      }
    }

    case actionConstants.SET_NEXT_NONCE: {
      return {
        ...metamaskState,
        nextNonce: action.value,
      }
    }

    default:
      return metamaskState
  }
}

export const getCurrentLocale = (state) => state.metamask.currentLocale

export const getAlertEnabledness = (state) => state.metamask.alertEnabledness

export const getSwitchToConnectedAlertEnabledness = (state) => getAlertEnabledness(state)[ALERT_TYPES.switchToConnected]

export const getUnconnectedAccountAlertEnabledness = (state) => getAlertEnabledness(state)[ALERT_TYPES.unconnectedAccount]

export const getSwitchToConnectedAlertShown = (state) => state.metamask.switchToConnectedAlertShown
