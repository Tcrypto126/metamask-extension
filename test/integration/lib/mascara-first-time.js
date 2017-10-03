const PASSWORD = 'password123'

window.testUtils = require('react-dom/test-utils')

async function runFirstTimeUsageTest (assert, done) {
  await timeout(4000)

  const app = $('#app-content')

  // recurse notices
  while (true) {
    const button = app.find('button')
    if (button.html() === 'Accept') {
      // still notices to accept
      const termsPage = app.find('.markdown')[0]
      termsPage.scrollTop = termsPage.scrollHeight
      await timeout()
      console.log('Clearing notice')
      button.click()
      await timeout()
    } else {
      // exit loop
      console.log('No more notices...')
      break
    }
  }

  await timeout()

  // Scroll through terms
  const title = app.find('.create-password__title').text()
  assert.equal(title, 'Create Password', 'create password screen')

  // enter password
  const pwBox = app.find('.first-time-flow__input')[0]
  const confBox = app.find('.first-time-flow__input')[1]
  pwBox.value = PASSWORD
  confBox.value = PASSWORD
  $(pwBox).change()
  $(confBox).change()


  await timeout()

  // create vault
  const createButton = app.find('button.first-time-flow__button')[0]
  createButton.click()

  await timeout(3000)

  const created = app.find('h3')[0]
  assert.equal(created.textContent, 'Vault Created', 'Vault created screen')

  // Agree button
  const button = app.find('button')[0]
  assert.ok(button, 'button present')
  button.click()

  await timeout(1000)

  const detail = app.find('.account-detail-section')[0]
  assert.ok(detail, 'Account detail section loaded.')

  const sandwich = app.find('.sandwich-expando')[0]
  sandwich.click()

  await timeout()

  const menu = app.find('.menu-droppo')[0]
  const children = menu.children
  const lock = children[children.length - 2]
  assert.ok(lock, 'Lock menu item found')
  lock.click()

  await timeout(1000)

  const pwBox2 = app.find('#password-box')[0]
  pwBox2.value = PASSWORD

  const createButton2 = app.find('button.primary')[0]
  createButton2.click()

  await timeout(1000)

  const detail2 = app.find('.account-detail-section')[0]
  assert.ok(detail2, 'Account detail section loaded again.')

  await timeout()

  // open account settings dropdown
  const qrButton = app.find('.fa.fa-ellipsis-h')[0]
  qrButton.click()

  await timeout(1000)

  // qr code item
  const qrButton2 = app.find('.dropdown-menu-item')[1]
  qrButton2.click()

  await timeout(1000)

  const qrHeader = app.find('.qr-header')[0]
  const qrContainer = app.find('#qr-container')[0]
  assert.equal(qrHeader.textContent, 'Account 1', 'Should show account label.')
  assert.ok(qrContainer, 'QR Container found')

  await timeout()

  const networkMenu = app.find('.network-indicator')[0]
  networkMenu.click()

  await timeout()

  const networkMenu2 = app.find('.network-indicator')[0]
  const children2 = networkMenu2.children
  children2.length[3]
  assert.ok(children2, 'All network options present')
}

module.exports = runFirstTimeUsageTest

function timeout (time) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, time || 1500)
  })
}
