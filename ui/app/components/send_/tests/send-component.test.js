import React from 'react'
import assert from 'assert'
import proxyquire from 'proxyquire'
import { shallow } from 'enzyme'
import sinon from 'sinon'

import SendHeader from '../send-header/send-header.container'
import SendContent from '../send-content/send-content.component'
import SendFooter from '../send-footer/send-footer.container'

const propsMethodSpies = {
  updateAndSetGasTotal: sinon.spy(),
  updateSendErrors: sinon.spy(),
  updateSendTokenBalance: sinon.spy(),
}
const utilsMethodStubs = {
  getAmountErrorObject: sinon.stub().returns({ amount: 'mockAmountError' }),
  doesAmountErrorRequireUpdate: sinon.stub().callsFake(obj => obj.balance !== obj.prevBalance),
}

const SendTransactionScreen = proxyquire('../send.component.js', {
  './send.utils': utilsMethodStubs,
}).default

sinon.spy(SendTransactionScreen.prototype, 'componentDidMount')
sinon.spy(SendTransactionScreen.prototype, 'updateGas')

describe('Send Component', function () {
  let wrapper
  let instance

  beforeEach(() => {
    wrapper = shallow(<SendTransactionScreen
      amount={'mockAmount'}
      amountConversionRate={'mockAmountConversionRate'}
      conversionRate={10}
      data={'mockData'}
      editingTransactionId={'mockEditingTransactionId'}
      from={ { address: 'mockAddress', balance: 'mockBalance' } }
      gasLimit={'mockGasLimit'}
      gasPrice={'mockGasPrice'}
      gasTotal={'mockGasTotal'}
      history={{ mockProp: 'history-abc'}}
      network={'3'}
      primaryCurrency={'mockPrimaryCurrency'}
      selectedAddress={'mockSelectedAddress'}
      selectedToken={'mockSelectedToken'}
      tokenBalance={'mockTokenBalance'}
      tokenContract={'mockTokenContract'}
      updateAndSetGasTotal={propsMethodSpies.updateAndSetGasTotal}
      updateSendErrors={propsMethodSpies.updateSendErrors}
      updateSendTokenBalance={propsMethodSpies.updateSendTokenBalance}
    />)
    instance = wrapper.instance()
  })

  afterEach(() => {
    SendTransactionScreen.prototype.componentDidMount.resetHistory()
    SendTransactionScreen.prototype.updateGas.resetHistory()
    utilsMethodStubs.doesAmountErrorRequireUpdate.resetHistory()
    utilsMethodStubs.getAmountErrorObject.resetHistory()
    propsMethodSpies.updateAndSetGasTotal.resetHistory()
    propsMethodSpies.updateSendErrors.resetHistory()
    propsMethodSpies.updateSendTokenBalance.resetHistory()
  })

  it('should call componentDidMount', () => {
    assert(SendTransactionScreen.prototype.componentDidMount.calledOnce)
  })

  describe('componentWillMount', () => {
    it('should call this.updateGas', () => {
      assert(SendTransactionScreen.prototype.updateGas.calledOnce)
      wrapper.instance().componentWillMount()
      assert(SendTransactionScreen.prototype.updateGas.calledTwice)
    })
  })

  describe('componentDidUpdate', () => {
    it('should call doesAmountErrorRequireUpdate with the expected params', () => {
      wrapper.instance().componentDidUpdate({
        from: {
          balance: '',
        },
      })
      assert(utilsMethodStubs.doesAmountErrorRequireUpdate.calledOnce)
      assert.deepEqual(
        utilsMethodStubs.doesAmountErrorRequireUpdate.getCall(0).args[0],
        {
          balance: 'mockBalance',
          gasTotal: 'mockGasTotal',
          prevBalance: '',
          prevGasTotal: undefined,
          prevTokenBalance: undefined,
          selectedToken: 'mockSelectedToken',
          tokenBalance: 'mockTokenBalance',
        }
      )
    })

    it('should not call getAmountErrorObject if doesAmountErrorRequireUpdate returns false', () => {
      wrapper.instance().componentDidUpdate({
        from: {
          balance: 'mockBalance',
        },
      })
      assert.equal(utilsMethodStubs.getAmountErrorObject.callCount, 0)
    })

    it('should call getAmountErrorObject if doesAmountErrorRequireUpdate returns true', () => {
      wrapper.instance().componentDidUpdate({
        from: {
          balance: 'balanceChanged',
        },
      })
      assert.equal(utilsMethodStubs.getAmountErrorObject.callCount, 1)
      assert.deepEqual(
        utilsMethodStubs.getAmountErrorObject.getCall(0).args[0],
        {
          amount: 'mockAmount',
          amountConversionRate: 'mockAmountConversionRate',
          balance: 'mockBalance',
          conversionRate: 10,
          gasTotal: 'mockGasTotal',
          primaryCurrency: 'mockPrimaryCurrency',
          selectedToken: 'mockSelectedToken',
          tokenBalance: 'mockTokenBalance',
        }
      )
    })

    it('should call updateSendErrors with the expected params', () => {
      wrapper.instance().componentDidUpdate({
        from: {
          balance: 'balanceChanged',
        },
      })
      assert.equal(propsMethodSpies.updateSendErrors.callCount, 1)
      assert.deepEqual(
        propsMethodSpies.updateSendErrors.getCall(0).args[0],
        { amount: 'mockAmountError'}
      )
    })

    it('should not call updateSendTokenBalance or this.updateGas if network === prevNetwork', () => {
      SendTransactionScreen.prototype.updateGas.resetHistory()
      wrapper.instance().componentDidUpdate({
        from: {
          balance: 'balanceChanged',
        },
        network: '3',
      })
      assert.equal(propsMethodSpies.updateSendTokenBalance.callCount, 0)
      assert.equal(SendTransactionScreen.prototype.updateGas.callCount, 0)
    })

    it('should not call updateSendTokenBalance or this.updateGas if network === loading', () => {
      wrapper.setProps({ network: 'loading' })
      SendTransactionScreen.prototype.updateGas.resetHistory()
      propsMethodSpies.updateSendTokenBalance.resetHistory()
      wrapper.instance().componentDidUpdate({
        from: {
          balance: 'balanceChanged',
        },
        network: '3',
      })
      assert.equal(propsMethodSpies.updateSendTokenBalance.callCount, 0)
      assert.equal(SendTransactionScreen.prototype.updateGas.callCount, 0)
    })

    it('should call updateSendTokenBalance and this.updateGas with the correct params', () => {
      SendTransactionScreen.prototype.updateGas.resetHistory()
      wrapper.instance().componentDidUpdate({
        from: {
          balance: 'balanceChanged',
        },
        network: '2',
      })
      assert.equal(propsMethodSpies.updateSendTokenBalance.callCount, 1)
      assert.deepEqual(
        propsMethodSpies.updateSendTokenBalance.getCall(0).args[0],
        {
          selectedToken: 'mockSelectedToken',
          tokenContract: 'mockTokenContract',
          address: 'mockAddress',
        }
      )
      assert.equal(SendTransactionScreen.prototype.updateGas.callCount, 1)
      assert.deepEqual(
        SendTransactionScreen.prototype.updateGas.getCall(0).args,
        []
      )
    })
  })

  describe('updateGas', () => {
    it('should call updateAndSetGasTotal with the correct params', () => {
      propsMethodSpies.updateAndSetGasTotal.resetHistory()
      wrapper.instance().updateGas()
      assert.equal(propsMethodSpies.updateAndSetGasTotal.callCount, 1)
      assert.deepEqual(
        propsMethodSpies.updateAndSetGasTotal.getCall(0).args[0],
        {
          data: 'mockData',
          editingTransactionId: 'mockEditingTransactionId',
          gasLimit: 'mockGasLimit',
          gasPrice: 'mockGasPrice',
          selectedAddress: 'mockSelectedAddress',
          selectedToken: 'mockSelectedToken',
        }
      )
    })
  })

  describe('render', () => {
    it('should render a page-container class', () => {
      assert.equal(wrapper.find('.page-container').length, 1)
    })

    it('should render SendHeader, SendContent and SendFooter', () => {
      assert.equal(wrapper.find(SendHeader).length, 1)
      assert.equal(wrapper.find(SendContent).length, 1)
      assert.equal(wrapper.find(SendFooter).length, 1)
    })

    it('should pass the history prop to SendHeader and SendFooter', () => {
      assert.deepEqual(
        wrapper.find(SendFooter).props(),
        {
          history: { mockProp: 'history-abc' },
        }
      )
    })
  })
})
