import React from 'react'
import assert from 'assert'
import shallow from '../../../../../../../lib/shallow-with-context'
import BasicTabContent from '../basic-tab-content.component'

import GasPriceButtonGroup from '../../../gas-price-button-group'
import Loading from '../../../../../ui/loading-screen'

const mockGasPriceButtonGroupProps = {
  buttonDataLoading: false,
  className: 'gas-price-button-group',
  gasButtonInfo: [
    {
      feeInPrimaryCurrency: '$0.52',
      feeInSecondaryCurrency: '0.0048 ETH',
      timeEstimate: '~ 1 min 0 sec',
      priceInHexWei: '0xa1b2c3f',
    },
    {
      feeInPrimaryCurrency: '$0.39',
      feeInSecondaryCurrency: '0.004 ETH',
      timeEstimate: '~ 1 min 30 sec',
      priceInHexWei: '0xa1b2c39',
    },
    {
      feeInPrimaryCurrency: '$0.30',
      feeInSecondaryCurrency: '0.00354 ETH',
      timeEstimate: '~ 2 min 1 sec',
      priceInHexWei: '0xa1b2c30',
    },
  ],
  handleGasPriceSelection: newPrice => console.log('NewPrice: ', newPrice),
  noButtonActiveByDefault: true,
  showCheck: true,
}

describe('BasicTabContent Component', function () {
  let wrapper

  beforeEach(() => {
    wrapper = shallow((
      <BasicTabContent
        gasPriceButtonGroupProps={mockGasPriceButtonGroupProps}
      />
    ))
  })

  describe('render', () => {
    it('should have a title', () => {
      assert(wrapper.find('.basic-tab-content').childAt(0).hasClass('basic-tab-content__title'))
    })

    it('should render a GasPriceButtonGroup compenent', () => {
      assert.equal(wrapper.find(GasPriceButtonGroup).length, 1)
    })

    it('should pass correct props to GasPriceButtonGroup', () => {
      const {
        buttonDataLoading,
        className,
        gasButtonInfo,
        handleGasPriceSelection,
        noButtonActiveByDefault,
        showCheck,
      } = wrapper.find(GasPriceButtonGroup).props()
      assert.equal(wrapper.find(GasPriceButtonGroup).length, 1)
      assert.equal(buttonDataLoading, mockGasPriceButtonGroupProps.buttonDataLoading)
      assert.equal(className, mockGasPriceButtonGroupProps.className)
      assert.equal(noButtonActiveByDefault, mockGasPriceButtonGroupProps.noButtonActiveByDefault)
      assert.equal(showCheck, mockGasPriceButtonGroupProps.showCheck)
      assert.deepEqual(gasButtonInfo, mockGasPriceButtonGroupProps.gasButtonInfo)
      assert.equal(JSON.stringify(handleGasPriceSelection), JSON.stringify(mockGasPriceButtonGroupProps.handleGasPriceSelection))
    })

    it('should render a loading component instead of the GasPriceButtonGroup if gasPriceButtonGroupProps.loading is true', () => {
      wrapper.setProps({
        gasPriceButtonGroupProps: { ...mockGasPriceButtonGroupProps, loading: true },
      })

      assert.equal(wrapper.find(GasPriceButtonGroup).length, 0)
      assert.equal(wrapper.find(Loading).length, 1)
    })
  })
})
