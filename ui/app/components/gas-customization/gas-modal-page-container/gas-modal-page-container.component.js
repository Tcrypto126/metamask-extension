import React, { Component } from 'react'
import PropTypes from 'prop-types'
import PageContainer from '../../page-container'
import { Tabs, Tab } from '../../tabs'
import AdvancedTabContent from './advanced-tab-content'
import BasicTabContent from './basic-tab-content'

export default class GasModalPageContainer extends Component {
  static contextTypes = {
    t: PropTypes.func,
  }

  static propTypes = {
    hideModal: PropTypes.func,
    hideBasic: PropTypes.bool,
    updateCustomGasPrice: PropTypes.func,
    updateCustomGasLimit: PropTypes.func,
    customGasPrice: PropTypes.number,
    customGasLimit: PropTypes.number,
    fetchBasicGasAndTimeEstimates: PropTypes.func,
    fetchGasEstimates: PropTypes.func,
    gasPriceButtonGroupProps: PropTypes.object,
    infoRowProps: PropTypes.shape({
      originalTotalFiat: PropTypes.string,
      originalTotalEth: PropTypes.string,
      newTotalFiat: PropTypes.string,
      newTotalEth: PropTypes.string,
    }),
    onSubmit: PropTypes.func,
    customModalGasPriceInHex: PropTypes.string,
    customModalGasLimitInHex: PropTypes.string,
    cancelAndClose: PropTypes.func,
    transactionFee: PropTypes.string,
    blockTime: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
  }

  state = {}

  componentDidMount () {
    const promise = this.props.hideBasic
      ? Promise.resolve(this.props.blockTime)
      : this.props.fetchBasicGasAndTimeEstimates()
          .then(basicEstimates => basicEstimates.blockTime)

    promise
      .then(blockTime => {
        this.props.fetchGasEstimates(blockTime)
      })
  }

  renderBasicTabContent (gasPriceButtonGroupProps) {
    return (
      <BasicTabContent
        gasPriceButtonGroupProps={gasPriceButtonGroupProps}
      />
    )
  }

  renderAdvancedTabContent ({
    convertThenUpdateCustomGasPrice,
    convertThenUpdateCustomGasLimit,
    customGasPrice,
    customGasLimit,
    newTotalFiat,
    gasChartProps,
    currentTimeEstimate,
    insufficientBalance,
  }) {
    const { transactionFee } = this.props
    return (
      <AdvancedTabContent
        updateCustomGasPrice={convertThenUpdateCustomGasPrice}
        updateCustomGasLimit={convertThenUpdateCustomGasLimit}
        customGasPrice={customGasPrice}
        customGasLimit={customGasLimit}
        timeRemaining={currentTimeEstimate}
        transactionFee={transactionFee}
        totalFee={newTotalFiat}
        gasChartProps={gasChartProps}
        insufficientBalance={insufficientBalance}
      />
    )
  }

  renderInfoRows (newTotalFiat, newTotalEth, sendAmount, transactionFee) {
    return (
      <div>
        <div className="gas-modal-content__info-row">
          <div className="gas-modal-content__info-row__send-info">
            <span className="gas-modal-content__info-row__send-info__label">{this.context.t('sendAmount')}</span>
            <span className="gas-modal-content__info-row__send-info__value">{sendAmount}</span>
          </div>
          <div className="gas-modal-content__info-row__transaction-info">
            <span className={'gas-modal-content__info-row__transaction-info__label'}>{this.context.t('transactionFee')}</span>
            <span className="gas-modal-content__info-row__transaction-info__value">{transactionFee}</span>
          </div>
          <div className="gas-modal-content__info-row__total-info">
            <span className="gas-modal-content__info-row__total-info__label">{this.context.t('newTotal')}</span>
            <span className="gas-modal-content__info-row__total-info__value">{newTotalEth}</span>
          </div>
          <div className="gas-modal-content__info-row__fiat-total-info">
            <span className="gas-modal-content__info-row__fiat-total-info__value">{newTotalFiat}</span>
          </div>
        </div>
      </div>
    )
  }

  renderTabs ({
    originalTotalFiat,
    originalTotalEth,
    newTotalFiat,
    newTotalEth,
    sendAmount,
    transactionFee,
  },
  {
    gasPriceButtonGroupProps,
    hideBasic,
    ...advancedTabProps
  }) {
    let tabsToRender = [
      { name: 'basic', content: this.renderBasicTabContent(gasPriceButtonGroupProps) },
      { name: 'advanced', content: this.renderAdvancedTabContent(advancedTabProps) },
    ]

    if (hideBasic) {
      tabsToRender = tabsToRender.slice(1)
    }

    return (
      <Tabs>
        {tabsToRender.map(({ name, content }, i) => <Tab name={this.context.t(name)} key={`gas-modal-tab-${i}`}>
            <div className="gas-modal-content">
              { content }
              { this.renderInfoRows(newTotalFiat, newTotalEth, sendAmount, transactionFee) }
            </div>
          </Tab>
        )}
      </Tabs>
    )
  }

  render () {
    const {
      cancelAndClose,
      infoRowProps,
      onSubmit,
      customModalGasPriceInHex,
      customModalGasLimitInHex,
      ...tabProps
    } = this.props

    return (
      <div className="gas-modal-page-container">
        <PageContainer
          title={this.context.t('customGas')}
          subtitle={this.context.t('customGasSubTitle')}
          tabsComponent={this.renderTabs(infoRowProps, tabProps)}
          disabled={tabProps.insufficientBalance}
          onCancel={() => cancelAndClose()}
          onClose={() => cancelAndClose()}
          onSubmit={() => {
            onSubmit(customModalGasLimitInHex, customModalGasPriceInHex)
            cancelAndClose()
          }}
          submitText={this.context.t('save')}
          headerCloseText={'Close'}
          hideCancel={true}
        />
      </div>
    )
  }
}
