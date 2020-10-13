import { createSlice } from '@reduxjs/toolkit'
import { captureException } from '@sentry/browser'

import { ALERT_TYPES } from '../../../../app/scripts/controllers/alert'
import * as actionConstants from '../../store/actionConstants'
import {
  addPermittedAccount,
  setAlertEnabledness,
  setSelectedAddress,
} from '../../store/actions'
import {
  getOriginOfCurrentTab,
  getSelectedAddress,
} from '../../selectors'
import { ALERT_STATE } from './enums'

// Constants

const name = ALERT_TYPES.unconnectedAccount

const initialState = {
  state: ALERT_STATE.CLOSED,
}

// Slice (reducer plus auto-generated actions and action creators)

const slice = createSlice({
  name,
  initialState,
  reducers: {
    connectAccountFailed: (state) => {
      state.state = ALERT_STATE.ERROR
    },
    connectAccountRequested: (state) => {
      state.state = ALERT_STATE.LOADING
    },
    connectAccountSucceeded: (state) => {
      state.state = ALERT_STATE.CLOSED
    },
    disableAlertFailed: (state) => {
      state.state = ALERT_STATE.ERROR
    },
    disableAlertRequested: (state) => {
      state.state = ALERT_STATE.LOADING
    },
    disableAlertSucceeded: (state) => {
      state.state = ALERT_STATE.CLOSED
    },
    dismissAlert: (state) => {
      state.state = ALERT_STATE.CLOSED
    },
    switchAccountFailed: (state) => {
      state.state = ALERT_STATE.ERROR
    },
    switchAccountRequested: (state) => {
      state.state = ALERT_STATE.LOADING
    },
    switchAccountSucceeded: (state) => {
      state.state = ALERT_STATE.CLOSED
    },
    switchedToUnconnectedAccount: (state) => {
      state.state = ALERT_STATE.OPEN
    },
  },
  extraReducers: {
    [actionConstants.SELECTED_ADDRESS_CHANGED]: (state) => {
      // close the alert if the account is switched while it's open
      if (state.state === ALERT_STATE.OPEN) {
        state.state = ALERT_STATE.CLOSED
      }
    },
  },
})

const { actions, reducer } = slice

export default reducer

// Selectors

export const getAlertState = (state) => state[name].state

export const alertIsOpen = (state) => state[name].state !== ALERT_STATE.CLOSED

// Actions / action-creators

const {
  connectAccountFailed,
  connectAccountRequested,
  connectAccountSucceeded,
  disableAlertFailed,
  disableAlertRequested,
  disableAlertSucceeded,
  dismissAlert,
  switchAccountFailed,
  switchAccountRequested,
  switchAccountSucceeded,
  switchedToUnconnectedAccount,
} = actions

export { dismissAlert, switchedToUnconnectedAccount }

export const dismissAndDisableAlert = () => {
  return async (dispatch) => {
    try {
      await dispatch(disableAlertRequested())
      await dispatch(setAlertEnabledness(name, false))
      await dispatch(disableAlertSucceeded())
    } catch (error) {
      console.error(error)
      captureException(error)
      await dispatch(disableAlertFailed())
    }
  }
}

export const switchToAccount = (address) => {
  return async (dispatch) => {
    try {
      await dispatch(switchAccountRequested())
      await dispatch(setSelectedAddress(address))
      await dispatch(switchAccountSucceeded())
    } catch (error) {
      console.error(error)
      captureException(error)
      await dispatch(switchAccountFailed())
    }
  }
}

export const connectAccount = () => {
  return async (dispatch, getState) => {
    const state = getState()
    const selectedAddress = getSelectedAddress(state)
    const origin = getOriginOfCurrentTab(state)
    try {
      await dispatch(connectAccountRequested())
      await dispatch(addPermittedAccount(origin, selectedAddress))
      await dispatch(connectAccountSucceeded())
    } catch (error) {
      console.error(error)
      captureException(error)
      await dispatch(connectAccountFailed())
    }
  }
}
