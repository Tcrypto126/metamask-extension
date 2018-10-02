const assert = require('assert')
const BlacklistController = require('../../../../app/scripts/controllers/blacklist')

describe('blacklist controller', function () {
  let blacklistController

  before(() => {
    blacklistController = new BlacklistController()
  })

  describe('whitelistDomain', function () {
    it('should add hostname to the runtime whitelist', function () {
      blacklistController.whitelistDomain('foo.com')
      assert.deepEqual(blacklistController.store.getState().whitelist, ['foo.com'])

      blacklistController.whitelistDomain('bar.com')
      assert.deepEqual(blacklistController.store.getState().whitelist, ['bar.com', 'foo.com'])
    })
  })

  describe('checkForPhishing', function () {
    it('should not flag whitelisted values', function () {
      const result = blacklistController.checkForPhishing('www.metamask.io')
      assert.equal(result, false)
    })
    it('should flag explicit values', function () {
      const result = blacklistController.checkForPhishing('metamask.com')
      assert.equal(result, true)
    })
    it('should flag levenshtein values', function () {
      const result = blacklistController.checkForPhishing('metmask.io')
      assert.equal(result, true)
    })
    it('should not flag not-even-close values', function () {
      const result = blacklistController.checkForPhishing('example.com')
      assert.equal(result, false)
    })
    it('should not flag the ropsten faucet domains', function () {
      const result = blacklistController.checkForPhishing('faucet.metamask.io')
      assert.equal(result, false)
    })
    it('should not flag the mascara domain', function () {
      const result = blacklistController.checkForPhishing('zero.metamask.io')
      assert.equal(result, false)
    })
    it('should not flag the mascara-faucet domain', function () {
      const result = blacklistController.checkForPhishing('zero-faucet.metamask.io')
      assert.equal(result, false)
    })
    it('should not flag whitelisted domain', function () {
      blacklistController.whitelistDomain('metamask.com')
      const result = blacklistController.checkForPhishing('metamask.com')
      assert.equal(result, false)
    })
  })
})
