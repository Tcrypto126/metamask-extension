import React, { useState, useContext, useMemo, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useHistory } from 'react-router-dom'
import BigNumber from 'bignumber.js'
import { isEqual } from 'lodash'
import classnames from 'classnames'
import { I18nContext } from '../../../contexts/i18n'
import SelectQuotePopover from '../select-quote-popover'
import { useEqualityCheck } from '../../../hooks/useEqualityCheck'
import { useNewMetricEvent } from '../../../hooks/useMetricEvent'
import { useSwapsEthToken } from '../../../hooks/useSwapsEthToken'
import { MetaMetricsContext } from '../../../contexts/metametrics.new'
import FeeCard from '../fee-card'
import {
  FALLBACK_GAS_MULTIPLIER,
  getQuotes,
  getSelectedQuote,
  getApproveTxParams,
  getFetchParams,
  setBalanceError,
  getQuotesLastFetched,
  getBalanceError,
  getCustomSwapsGas,
  getDestinationTokenInfo,
  getUsedSwapsGasPrice,
  getTopQuote,
  navigateBackToBuildQuote,
  signAndSendTransactions,
  getBackgroundSwapRouteState,
  swapsQuoteSelected,
} from '../../../ducks/swaps/swaps'
import {
  conversionRateSelector,
  getSelectedAccount,
  getCurrentCurrency,
  getTokenExchangeRates,
} from '../../../selectors'
import { toPrecisionWithoutTrailingZeros } from '../../../helpers/utils/util'
import { getTokens } from '../../../ducks/metamask/metamask'
import {
  safeRefetchQuotes,
  setCustomApproveTxData,
  setSwapsErrorKey,
  showModal,
} from '../../../store/actions'
import {
  ASSET_ROUTE,
  BUILD_QUOTE_ROUTE,
  DEFAULT_ROUTE,
  SWAPS_ERROR_ROUTE,
  AWAITING_SWAP_ROUTE,
} from '../../../helpers/constants/routes'
import { getTokenData } from '../../../helpers/utils/transactions.util'
import {
  calcTokenAmount,
  calcTokenValue,
  getTokenValueParam,
} from '../../../helpers/utils/token-util'
import {
  decimalToHex,
  hexToDecimal,
  getValueFromWeiHex,
} from '../../../helpers/utils/conversions.util'
import MainQuoteSummary from '../main-quote-summary'
import { calcGasTotal } from '../../send/send.utils'
import { getCustomTxParamsData } from '../../confirm-approve/confirm-approve.util'
import ActionableMessage from '../actionable-message'
import {
  quotesToRenderableData,
  getRenderableNetworkFeesForQuote,
} from '../swaps.util'
import { useTokenTracker } from '../../../hooks/useTokenTracker'
import { QUOTES_EXPIRED_ERROR } from '../../../helpers/constants/swaps'
import CountdownTimer from '../countdown-timer'
import SwapsFooter from '../swaps-footer'
import InfoTooltip from '../../../components/ui/info-tooltip'
import ViewQuotePriceDifference from './view-quote-price-difference'

export default function ViewQuote() {
  const history = useHistory()
  const dispatch = useDispatch()
  const t = useContext(I18nContext)
  const metaMetricsEvent = useContext(MetaMetricsContext)

  const [dispatchedSafeRefetch, setDispatchedSafeRefetch] = useState(false)
  const [selectQuotePopoverShown, setSelectQuotePopoverShown] = useState(false)
  const [warningHidden, setWarningHidden] = useState(false)
  const [originalApproveAmount, setOriginalApproveAmount] = useState(null)

  const routeState = useSelector(getBackgroundSwapRouteState)
  const quotes = useSelector(getQuotes, isEqual)
  useEffect(() => {
    if (!Object.values(quotes).length) {
      history.push(BUILD_QUOTE_ROUTE)
    } else if (routeState === 'awaiting') {
      history.push(AWAITING_SWAP_ROUTE)
    }
  }, [history, quotes, routeState])

  const quotesLastFetched = useSelector(getQuotesLastFetched)

  // Select necessary data
  const gasPrice = useSelector(getUsedSwapsGasPrice)
  const customMaxGas = useSelector(getCustomSwapsGas)
  const tokenConversionRates = useSelector(getTokenExchangeRates)
  const memoizedTokenConversionRates = useEqualityCheck(tokenConversionRates)
  const { balance: ethBalance } = useSelector(getSelectedAccount)
  const conversionRate = useSelector(conversionRateSelector)
  const currentCurrency = useSelector(getCurrentCurrency)
  const swapsTokens = useSelector(getTokens)
  const balanceError = useSelector(getBalanceError)
  const fetchParams = useSelector(getFetchParams)
  const approveTxParams = useSelector(getApproveTxParams)
  const selectedQuote = useSelector(getSelectedQuote)
  const topQuote = useSelector(getTopQuote)
  const usedQuote = selectedQuote || topQuote
  const tradeValue = usedQuote?.trade?.value ?? '0x0'

  const { isBestQuote } = usedQuote
  const fetchParamsSourceToken = fetchParams?.sourceToken

  const usedGasLimit =
    usedQuote?.gasEstimateWithRefund ||
    `0x${decimalToHex(usedQuote?.averageGas || 0)}`

  const gasLimitForMax = usedQuote?.gasEstimate || `0x0`

  const usedGasLimitWithMultiplier = new BigNumber(gasLimitForMax, 16)
    .times(usedQuote?.gasMultiplier || FALLBACK_GAS_MULTIPLIER, 10)
    .round(0)
    .toString(16)

  const nonCustomMaxGasLimit = usedQuote?.gasEstimate
    ? usedGasLimitWithMultiplier
    : `0x${decimalToHex(usedQuote?.maxGas || 0)}`
  const maxGasLimit = customMaxGas || nonCustomMaxGasLimit

  const gasTotalInWeiHex = calcGasTotal(maxGasLimit, gasPrice)

  const { tokensWithBalances } = useTokenTracker(swapsTokens)
  const swapsEthToken = useSwapsEthToken()
  const balanceToken =
    fetchParamsSourceToken === swapsEthToken.address
      ? swapsEthToken
      : tokensWithBalances.find(
          ({ address }) => address === fetchParamsSourceToken,
        )

  const selectedFromToken = balanceToken || usedQuote.sourceTokenInfo
  const tokenBalance =
    tokensWithBalances?.length &&
    calcTokenAmount(
      selectedFromToken.balance || '0x0',
      selectedFromToken.decimals,
    ).toFixed(9)

  const approveData = getTokenData(approveTxParams?.data)
  const approveValue = approveData && getTokenValueParam(approveData)
  const approveAmount =
    approveValue &&
    selectedFromToken?.decimals !== undefined &&
    calcTokenAmount(approveValue, selectedFromToken.decimals).toFixed(9)
  const approveGas = approveTxParams?.gas

  const renderablePopoverData = useMemo(() => {
    return quotesToRenderableData(
      quotes,
      gasPrice,
      conversionRate,
      currentCurrency,
      approveGas,
      memoizedTokenConversionRates,
    )
  }, [
    quotes,
    gasPrice,
    conversionRate,
    currentCurrency,
    approveGas,
    memoizedTokenConversionRates,
  ])

  const renderableDataForUsedQuote = renderablePopoverData.find(
    (renderablePopoverDatum) =>
      renderablePopoverDatum.aggId === usedQuote.aggregator,
  )

  const {
    destinationTokenDecimals,
    destinationTokenSymbol,
    destinationTokenValue,
    sourceTokenDecimals,
    sourceTokenSymbol,
    sourceTokenValue,
  } = renderableDataForUsedQuote

  const { feeInFiat, feeInEth } = getRenderableNetworkFeesForQuote(
    usedGasLimit,
    approveGas,
    gasPrice,
    currentCurrency,
    conversionRate,
    tradeValue,
    sourceTokenSymbol,
    usedQuote.sourceAmount,
  )

  const {
    feeInFiat: maxFeeInFiat,
    feeInEth: maxFeeInEth,
    nonGasFee,
  } = getRenderableNetworkFeesForQuote(
    maxGasLimit,
    approveGas,
    gasPrice,
    currentCurrency,
    conversionRate,
    tradeValue,
    sourceTokenSymbol,
    usedQuote.sourceAmount,
  )

  const tokenCost = new BigNumber(usedQuote.sourceAmount)
  const ethCost = new BigNumber(usedQuote.trade.value || 0, 10).plus(
    new BigNumber(gasTotalInWeiHex, 16),
  )

  const insufficientTokens =
    (tokensWithBalances?.length || balanceError) &&
    tokenCost.gt(new BigNumber(selectedFromToken.balance || '0x0'))

  const insufficientEth = ethCost.gt(new BigNumber(ethBalance || '0x0'))

  const tokenBalanceNeeded = insufficientTokens
    ? toPrecisionWithoutTrailingZeros(
        calcTokenAmount(tokenCost, selectedFromToken.decimals)
          .minus(tokenBalance)
          .toString(10),
        6,
      )
    : null

  const ethBalanceNeeded = insufficientEth
    ? toPrecisionWithoutTrailingZeros(
        ethCost
          .minus(ethBalance, 16)
          .div('1000000000000000000', 10)
          .toString(10),
        6,
      )
    : null

  const destinationToken = useSelector(getDestinationTokenInfo)

  useEffect(() => {
    if (insufficientTokens || insufficientEth) {
      dispatch(setBalanceError(true))
    } else if (balanceError && !insufficientTokens && !insufficientEth) {
      dispatch(setBalanceError(false))
    }
  }, [insufficientTokens, insufficientEth, balanceError, dispatch])

  useEffect(() => {
    const currentTime = Date.now()
    const timeSinceLastFetched = currentTime - quotesLastFetched
    if (timeSinceLastFetched > 60000 && !dispatchedSafeRefetch) {
      setDispatchedSafeRefetch(true)
      dispatch(safeRefetchQuotes())
    } else if (timeSinceLastFetched > 60000) {
      dispatch(setSwapsErrorKey(QUOTES_EXPIRED_ERROR))
      history.push(SWAPS_ERROR_ROUTE)
    }
  }, [quotesLastFetched, dispatchedSafeRefetch, dispatch, history])

  useEffect(() => {
    if (!originalApproveAmount && approveAmount) {
      setOriginalApproveAmount(approveAmount)
    }
  }, [originalApproveAmount, approveAmount])

  const showInsufficientWarning =
    (balanceError || tokenBalanceNeeded || ethBalanceNeeded) && !warningHidden

  const numberOfQuotes = Object.values(quotes).length
  const bestQuoteReviewedEventSent = useRef()
  const eventObjectBase = {
    token_from: sourceTokenSymbol,
    token_from_amount: sourceTokenValue,
    token_to: destinationTokenSymbol,
    token_to_amount: destinationTokenValue,
    request_type: fetchParams?.balanceError,
    slippage: fetchParams?.slippage,
    custom_slippage: fetchParams?.slippage !== 2,
    response_time: fetchParams?.responseTime,
    best_quote_source: topQuote?.aggregator,
    available_quotes: numberOfQuotes,
  }

  const allAvailableQuotesOpened = useNewMetricEvent({
    event: 'All Available Quotes Opened',
    category: 'swaps',
    sensitiveProperties: {
      ...eventObjectBase,
      other_quote_selected: usedQuote?.aggregator !== topQuote?.aggregator,
      other_quote_selected_source:
        usedQuote?.aggregator === topQuote?.aggregator
          ? null
          : usedQuote?.aggregator,
    },
  })
  const quoteDetailsOpened = useNewMetricEvent({
    event: 'Quote Details Opened',
    category: 'swaps',
    sensitiveProperties: {
      ...eventObjectBase,
      other_quote_selected: usedQuote?.aggregator !== topQuote?.aggregator,
      other_quote_selected_source:
        usedQuote?.aggregator === topQuote?.aggregator
          ? null
          : usedQuote?.aggregator,
    },
  })
  const editSpendLimitOpened = useNewMetricEvent({
    event: 'Edit Spend Limit Opened',
    category: 'swaps',
    sensitiveProperties: {
      ...eventObjectBase,
      custom_spend_limit_set: originalApproveAmount === approveAmount,
      custom_spend_limit_amount:
        originalApproveAmount === approveAmount ? null : approveAmount,
    },
  })

  const bestQuoteReviewedEvent = useNewMetricEvent({
    event: 'Best Quote Reviewed',
    category: 'swaps',
    sensitiveProperties: { ...eventObjectBase, network_fees: feeInFiat },
  })
  useEffect(() => {
    if (
      !bestQuoteReviewedEventSent.current &&
      [
        sourceTokenSymbol,
        sourceTokenValue,
        destinationTokenSymbol,
        destinationTokenValue,
        fetchParams,
        topQuote,
        numberOfQuotes,
        feeInFiat,
      ].every((dep) => dep !== null && dep !== undefined)
    ) {
      bestQuoteReviewedEventSent.current = true
      bestQuoteReviewedEvent()
    }
  }, [
    sourceTokenSymbol,
    sourceTokenValue,
    destinationTokenSymbol,
    destinationTokenValue,
    fetchParams,
    topQuote,
    numberOfQuotes,
    feeInFiat,
    bestQuoteReviewedEvent,
  ])

  const metaMaskFee = usedQuote.fee

  const onFeeCardTokenApprovalClick = () => {
    editSpendLimitOpened()
    dispatch(
      showModal({
        name: 'EDIT_APPROVAL_PERMISSION',
        decimals: selectedFromToken.decimals,
        origin: 'MetaMask',
        setCustomAmount: (newCustomPermissionAmount) => {
          const customPermissionAmount =
            newCustomPermissionAmount === ''
              ? originalApproveAmount
              : newCustomPermissionAmount
          const newData = getCustomTxParamsData(approveTxParams.data, {
            customPermissionAmount,
            decimals: selectedFromToken.decimals,
          })

          if (
            customPermissionAmount?.length &&
            approveTxParams.data !== newData
          ) {
            dispatch(setCustomApproveTxData(newData))
          }
        },
        tokenAmount: originalApproveAmount,
        customTokenAmount:
          originalApproveAmount === approveAmount ? null : approveAmount,
        tokenBalance,
        tokenSymbol: selectedFromToken.symbol,
        requiredMinimum: calcTokenAmount(
          usedQuote.sourceAmount,
          selectedFromToken.decimals,
        ),
      }),
    )
  }

  const nonGasFeeIsPositive = new BigNumber(nonGasFee, 16).gt(0)
  const approveGasTotal = calcGasTotal(approveGas || '0x0', gasPrice)
  const extraNetworkFeeTotalInHexWEI = new BigNumber(nonGasFee, 16)
    .plus(approveGasTotal, 16)
    .toString(16)
  const extraNetworkFeeTotalInEth = getValueFromWeiHex({
    value: extraNetworkFeeTotalInHexWEI,
    toDenomination: 'ETH',
    numberOfDecimals: 4,
  })

  let extraInfoRowLabel = ''
  if (approveGas && nonGasFeeIsPositive) {
    extraInfoRowLabel = t('approvalAndAggregatorTxFeeCost')
  } else if (approveGas) {
    extraInfoRowLabel = t('approvalTxGasCost')
  } else if (nonGasFeeIsPositive) {
    extraInfoRowLabel = t('aggregatorFeeCost')
  }

  const onFeeCardMaxRowClick = () =>
    dispatch(
      showModal({
        name: 'CUSTOMIZE_METASWAP_GAS',
        value: tradeValue,
        customGasLimitMessage: approveGas
          ? t('extraApprovalGas', [hexToDecimal(approveGas)])
          : '',
        customTotalSupplement: approveGasTotal,
        extraInfoRow: extraInfoRowLabel
          ? {
              label: extraInfoRowLabel,
              value: t('amountInEth', [extraNetworkFeeTotalInEth]),
            }
          : null,
        initialGasPrice: gasPrice,
        initialGasLimit: maxGasLimit,
        minimumGasLimit: new BigNumber(nonCustomMaxGasLimit, 16).toNumber(),
      }),
    )

  const tokenApprovalTextComponent = (
    <span key="swaps-view-quote-approve-symbol-1" className="view-quote__bold">
      {sourceTokenSymbol}
    </span>
  )

  const actionableInsufficientMessage = t('swapApproveNeedMoreTokens', [
    <span key="swapApproveNeedMoreTokens-1" className="view-quote__bold">
      {tokenBalanceNeeded || ethBalanceNeeded}
    </span>,
    tokenBalanceNeeded && !(sourceTokenSymbol === 'ETH')
      ? sourceTokenSymbol
      : 'ETH',
  ])

  const viewQuotePriceDifferenceComponent = (
    <ViewQuotePriceDifference
      usedQuote={usedQuote}
      sourceTokenValue={sourceTokenValue}
      destinationTokenValue={destinationTokenValue}
    />
  )

  const isShowingWarning =
    showInsufficientWarning || viewQuotePriceDifferenceComponent !== null

  return (
    <div className="view-quote">
      <div className="view-quote__content">
        {selectQuotePopoverShown && (
          <SelectQuotePopover
            quoteDataRows={renderablePopoverData}
            onClose={() => setSelectQuotePopoverShown(false)}
            onSubmit={(aggId) => dispatch(swapsQuoteSelected(aggId))}
            swapToSymbol={destinationTokenSymbol}
            initialAggId={usedQuote.aggregator}
            onQuoteDetailsIsOpened={quoteDetailsOpened}
          />
        )}
        <div
          className={classnames('view-quote__warning-wrapper', {
            'view-quote__warning-wrapper--thin': !isShowingWarning,
          })}
        >
          {!showInsufficientWarning && viewQuotePriceDifferenceComponent}
          {showInsufficientWarning && (
            <ActionableMessage
              message={actionableInsufficientMessage}
              onClose={() => setWarningHidden(true)}
            />
          )}
        </div>
        <div
          className={classnames('view-quote__countdown-timer-container', {
            'view-quote__countdown-timer-container--thin': isShowingWarning,
          })}
        >
          <CountdownTimer
            timeStarted={quotesLastFetched}
            warningTime="0:30"
            infoTooltipLabelKey="swapQuotesAreRefreshed"
            labelKey="swapNewQuoteIn"
          />
        </div>
        <div
          className={classnames('view-quote__main-quote-summary-container', {
            'view-quote__main-quote-summary-container--thin': isShowingWarning,
          })}
        >
          <MainQuoteSummary
            sourceValue={calcTokenValue(sourceTokenValue, sourceTokenDecimals)}
            sourceDecimals={sourceTokenDecimals}
            sourceSymbol={sourceTokenSymbol}
            destinationValue={calcTokenValue(
              destinationTokenValue,
              destinationTokenDecimals,
            )}
            destinationDecimals={destinationTokenDecimals}
            destinationSymbol={destinationTokenSymbol}
            isBestQuote={isBestQuote}
          />
        </div>
        <div className="view-quote__view-other-button-container">
          <div className="view-quote__view-other-button">
            {t('swapNQuotesAvailable', [Object.values(quotes).length])}
            <i className="fa fa-arrow-right" />
          </div>
          <div
            className="view-quote__view-other-button-fade"
            onClick={() => {
              allAvailableQuotesOpened()
              setSelectQuotePopoverShown(true)
            }}
          >
            {t('swapNQuotesAvailable', [Object.values(quotes).length])}
            <i className="fa fa-arrow-right" />
          </div>
        </div>
        <div className="view-quote__metamask-rate">
          <p className="view-quote__metamask-rate-text">
            {t('swapQuoteIncludesRate', [metaMaskFee])}
          </p>
          <InfoTooltip
            position="top"
            contentText={t('swapMetaMaskFeeDescription', [metaMaskFee])}
            wrapperClassName="view-quote__metamask-rate-info-icon"
          />
        </div>
        <div
          className={classnames('view-quote__fee-card-container', {
            'view-quote__fee-card-container--thin': isShowingWarning,
            'view-quote__fee-card-container--three-rows':
              approveTxParams && (!balanceError || warningHidden),
          })}
        >
          <FeeCard
            primaryFee={{
              fee: feeInEth,
              maxFee: maxFeeInEth,
            }}
            secondaryFee={{
              fee: feeInFiat,
              maxFee: maxFeeInFiat,
            }}
            onFeeCardMaxRowClick={onFeeCardMaxRowClick}
            hideTokenApprovalRow={
              !approveTxParams || (balanceError && !warningHidden)
            }
            tokenApprovalTextComponent={tokenApprovalTextComponent}
            tokenApprovalSourceTokenSymbol={sourceTokenSymbol}
            onTokenApprovalClick={onFeeCardTokenApprovalClick}
          />
        </div>
      </div>
      <SwapsFooter
        onSubmit={() => {
          if (!balanceError) {
            dispatch(signAndSendTransactions(history, metaMetricsEvent))
          } else if (destinationToken.symbol === 'ETH') {
            history.push(DEFAULT_ROUTE)
          } else {
            history.push(`${ASSET_ROUTE}/${destinationToken.address}`)
          }
        }}
        submitText={t('swap')}
        onCancel={async () => await dispatch(navigateBackToBuildQuote(history))}
        disabled={balanceError || gasPrice === null || gasPrice === undefined}
        className={isShowingWarning && 'view-quote__thin-swaps-footer'}
        showTermsOfService
        showTopBorder
      />
    </div>
  )
}
