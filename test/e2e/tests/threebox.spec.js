const { convertToHexValue, withFixtures, largeDelayMs } = require('../helpers');
const ThreeboxMockServer = require('../mock-3box/threebox-mock-server');
const FixtureBuilder = require('../fixture-builder');

describe('Threebox', function () {
  const ganacheOptions = {
    accounts: [
      {
        secretKey:
          '0x7C9529A67102755B7E6102D6D950AC5D5863C98713805CEC576B945B15B71EAC',
        balance: convertToHexValue(25000000000000000000),
      },
    ],
  };
  let threeboxServer;
  before(async function () {
    threeboxServer = new ThreeboxMockServer();
    await threeboxServer.start();
  });
  after(async function () {
    await threeboxServer.stop();
  });

  it('Set up data to be restored by 3box', async function () {
    await withFixtures(
      {
        fixtures: new FixtureBuilder().build(),
        ganacheOptions,
        title: this.test.title,
      },
      async ({ driver }) => {
        await driver.navigate();
        await driver.fill('#password', 'correct horse battery staple');
        await driver.press('#password', driver.Key.ENTER);

        // turns on threebox syncing
        await driver.clickElement('.account-menu__icon');
        await driver.clickElement({ text: 'Settings', tag: 'div' });

        // turns on threebox syncing
        await driver.clickElement({ text: 'Advanced', tag: 'div' });
        await driver.clickElement(
          '[data-testid="advanced-setting-3box"] .toggle-button div',
        );

        // updates settings and address book
        // navigates to General settings
        await driver.clickElement({ text: 'General', tag: 'div' });

        // turns on use of blockies
        await driver.clickElement('.toggle-button > div');

        // adds an address to the contact list
        await driver.clickElement({ text: 'Contacts', tag: 'div' });

        await driver.clickElement('.address-book__link');
        await driver.fill('#nickname', 'Test User Name 11');
        await driver.fill(
          'input[placeholder="Search, public address (0x), or ENS"]',
          '0x2f318C334780961FB129D2a6c30D0763d9a5C970',
        );
        await driver.delay(largeDelayMs * 2);
        await driver.clickElement({ text: 'Save', tag: 'button' });
        await driver.findElement({ text: 'Test User Name 11', tag: 'div' });
      },
    );
  });
  it('Restore from 3box', async function () {
    await withFixtures(
      {
        fixtures: new FixtureBuilder()
          .withThreeBoxController({
            threeBoxSyncingAllowed: true,
            showRestorePrompt: true,
            threeBoxLastUpdated: 0,
            threeBoxAddress: '0x64480aa2768ef12f3f19c5a01206ceb0f82d06b9',
            threeBoxSynced: true,
            threeBoxDisabled: false,
          })
          .build(),
        ganacheOptions,
        title: this.test.title,
      },
      async ({ driver }) => {
        await driver.navigate();
        await driver.fill('#password', 'correct horse battery staple');
        await driver.press('#password', driver.Key.ENTER);

        // confirms the 3box restore notification
        await driver.clickElement('.home-notification__accept-button');

        // goes to the settings screen
        await driver.clickElement('.account-menu__icon');
        await driver.clickElement({ text: 'Settings', tag: 'div' });

        // finds the restored address in the contact list
        await driver.clickElement({ text: 'Contacts', tag: 'div' });
        await driver.findElement({ text: 'Test User Name 11', tag: 'div' });
      },
    );
  });
});
