import { strict as assert } from 'assert'
import {
  getEnvironmentType,
  sufficientBalance,
  isPrefixedFormattedHexString,
} from '../../../app/scripts/lib/util'

import {
  ENVIRONMENT_TYPE_POPUP,
  ENVIRONMENT_TYPE_NOTIFICATION,
  ENVIRONMENT_TYPE_FULLSCREEN,
  ENVIRONMENT_TYPE_BACKGROUND,
} from '../../../shared/constants/app'

describe('app utils', function () {
  describe('getEnvironmentType', function () {
    it('should return popup type', function () {
      const environmentType = getEnvironmentType(
        'http://extension-id/popup.html',
      )
      assert.equal(environmentType, ENVIRONMENT_TYPE_POPUP)
    })

    it('should return notification type', function () {
      const environmentType = getEnvironmentType(
        'http://extension-id/notification.html',
      )
      assert.equal(environmentType, ENVIRONMENT_TYPE_NOTIFICATION)
    })

    it('should return fullscreen type for home.html', function () {
      const environmentType = getEnvironmentType(
        'http://extension-id/home.html',
      )
      assert.equal(environmentType, ENVIRONMENT_TYPE_FULLSCREEN)
    })

    it('should return fullscreen type for phishing.html', function () {
      const environmentType = getEnvironmentType(
        'http://extension-id/phishing.html',
      )
      assert.equal(environmentType, ENVIRONMENT_TYPE_FULLSCREEN)
    })

    it('should return background type', function () {
      const environmentType = getEnvironmentType(
        'http://extension-id/_generated_background_page.html',
      )
      assert.equal(environmentType, ENVIRONMENT_TYPE_BACKGROUND)
    })

    it('should return the correct type for a URL with a hash fragment', function () {
      const environmentType = getEnvironmentType(
        'http://extension-id/popup.html#hash',
      )
      assert.equal(environmentType, ENVIRONMENT_TYPE_POPUP)
    })

    it('should return the correct type for a URL with query parameters', function () {
      const environmentType = getEnvironmentType(
        'http://extension-id/popup.html?param=foo',
      )
      assert.equal(environmentType, ENVIRONMENT_TYPE_POPUP)
    })

    it('should return the correct type for a URL with query parameters and a hash fragment', function () {
      const environmentType = getEnvironmentType(
        'http://extension-id/popup.html?param=foo#hash',
      )
      assert.equal(environmentType, ENVIRONMENT_TYPE_POPUP)
    })
  })

  describe('SufficientBalance', function () {
    it('returns true if max tx cost is equal to balance.', function () {
      const tx = {
        value: '0x1',
        gas: '0x2',
        gasPrice: '0x3',
      }
      const balance = '0x8'

      const result = sufficientBalance(tx, balance)
      assert.ok(result, 'sufficient balance found.')
    })

    it('returns true if max tx cost is less than balance.', function () {
      const tx = {
        value: '0x1',
        gas: '0x2',
        gasPrice: '0x3',
      }
      const balance = '0x9'

      const result = sufficientBalance(tx, balance)
      assert.ok(result, 'sufficient balance found.')
    })

    it('returns false if max tx cost is more than balance.', function () {
      const tx = {
        value: '0x1',
        gas: '0x2',
        gasPrice: '0x3',
      }
      const balance = '0x6'

      const result = sufficientBalance(tx, balance)
      assert.ok(!result, 'insufficient balance found.')
    })
  })

  describe('isPrefixedFormattedHexString', function () {
    it('should return true for valid hex strings', function () {
      assert.equal(
        isPrefixedFormattedHexString('0x1'),
        true,
        'should return true',
      )

      assert.equal(
        isPrefixedFormattedHexString('0xa'),
        true,
        'should return true',
      )

      assert.equal(
        isPrefixedFormattedHexString('0xabcd1123fae909aad87452'),
        true,
        'should return true',
      )
    })

    it('should return false for invalid hex strings', function () {
      assert.equal(
        isPrefixedFormattedHexString('0x'),
        false,
        'should return false',
      )

      assert.equal(
        isPrefixedFormattedHexString('0x0'),
        false,
        'should return false',
      )

      assert.equal(
        isPrefixedFormattedHexString('0x01'),
        false,
        'should return false',
      )

      assert.equal(
        isPrefixedFormattedHexString(' 0x1'),
        false,
        'should return false',
      )

      assert.equal(
        isPrefixedFormattedHexString('0x1 '),
        false,
        'should return false',
      )

      assert.equal(
        isPrefixedFormattedHexString('0x1afz'),
        false,
        'should return false',
      )

      assert.equal(
        isPrefixedFormattedHexString('z'),
        false,
        'should return false',
      )

      assert.equal(
        isPrefixedFormattedHexString(2),
        false,
        'should return false',
      )

      assert.equal(
        isPrefixedFormattedHexString(['0x1']),
        false,
        'should return false',
      )

      assert.equal(isPrefixedFormattedHexString(), false, 'should return false')
    })
  })
})
