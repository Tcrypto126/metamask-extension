import assert from 'assert'
import { getMethodName } from '../confirm-transaction-base.component'

describe('ConfirmTransactionBase Component', () => {
  describe('getMethodName', () => {
    it('should get correct method names', () => {
      assert.equal(getMethodName(undefined), '')
      assert.equal(getMethodName({}), '')
      assert.equal(getMethodName('confirm'), 'confirm')
      assert.equal(getMethodName('balanceOf'), 'balance Of')
      assert.equal(getMethodName('ethToTokenSwapInput'), 'eth To Token Swap Input')
    })
  })
})
