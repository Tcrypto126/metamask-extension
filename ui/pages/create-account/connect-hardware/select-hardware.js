import classnames from 'classnames';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import {
  Text,
  Box,
  IconName,
  ButtonIconSize,
  ButtonIcon,
  Button,
  BUTTON_SIZES,
  BUTTON_VARIANT,
} from '../../../components/component-library';
import LogoLedger from '../../../components/ui/logo/logo-ledger';
import LogoQRBased from '../../../components/ui/logo/logo-qr-based';
import LogoTrezor from '../../../components/ui/logo/logo-trezor';
import LogoLattice from '../../../components/ui/logo/logo-lattice';

import {
  HardwareDeviceNames,
  LedgerTransportTypes,
  HardwareAffiliateLinks,
  HardwareAffiliateTutorialLinks,
} from '../../../../shared/constants/hardware-wallets';
import ZENDESK_URLS from '../../../helpers/constants/zendesk-url';
import { MetaMetricsEventCategory } from '../../../../shared/constants/metametrics';
import { isManifestV3 } from '../../../../shared/modules/mv3.utils';
import { openWindow } from '../../../helpers/utils/window';
import {
  AlignItems,
  Display,
  FlexDirection,
  FontWeight,
  JustifyContent,
  TextAlign,
  TextColor,
  TextVariant,
} from '../../../helpers/constants/design-system';

export default class SelectHardware extends Component {
  static contextTypes = {
    t: PropTypes.func,
    trackEvent: PropTypes.func,
  };

  static propTypes = {
    onCancel: PropTypes.func.isRequired,
    connectToHardwareWallet: PropTypes.func.isRequired,
    browserSupported: PropTypes.bool.isRequired,
    ledgerTransportType: PropTypes.oneOf(Object.values(LedgerTransportTypes)),
  };

  state = {
    selectedDevice: null,
  };

  shouldShowConnectButton() {
    return !isManifestV3 || process.env.HARDWARE_WALLETS_MV3;
  }

  connect = () => {
    if (this.state.selectedDevice) {
      this.props.connectToHardwareWallet(this.state.selectedDevice);
    }
    return null;
  };

  renderConnectToTrezorButton() {
    return (
      <button
        className={classnames('hw-connect__btn', {
          selected: this.state.selectedDevice === HardwareDeviceNames.trezor,
        })}
        onClick={(_) =>
          this.setState({ selectedDevice: HardwareDeviceNames.trezor })
        }
      >
        <LogoTrezor className="hw-connect__btn__img" ariaLabel="Trezor" />
      </button>
    );
  }

  renderConnectToLatticeButton() {
    return (
      <button
        className={classnames('hw-connect__btn', {
          selected: this.state.selectedDevice === HardwareDeviceNames.lattice,
        })}
        onClick={(_) =>
          this.setState({ selectedDevice: HardwareDeviceNames.lattice })
        }
      >
        <LogoLattice className="hw-connect__btn__img" ariaLabel="Lattice" />
      </button>
    );
  }

  renderConnectToLedgerButton() {
    return (
      <button
        className={classnames('hw-connect__btn', {
          selected: this.state.selectedDevice === HardwareDeviceNames.ledger,
        })}
        onClick={(_) =>
          this.setState({ selectedDevice: HardwareDeviceNames.ledger })
        }
      >
        <LogoLedger className="hw-connect__btn__img" ariaLabel="Ledger" />
      </button>
    );
  }

  renderConnectToQRButton() {
    return (
      <button
        className={classnames('hw-connect__btn', {
          selected: this.state.selectedDevice === HardwareDeviceNames.qr,
        })}
        onClick={(_) =>
          this.setState({ selectedDevice: HardwareDeviceNames.qr })
        }
      >
        <LogoQRBased className="hw-connect__btn__img" ariaLabel="QRCode" />
      </button>
    );
  }

  renderButtons() {
    return (
      <>
        <div className="hw-connect__btn-wrapper">
          {this.renderConnectToLedgerButton()}
          {this.renderConnectToTrezorButton()}
        </div>
        <div
          className="hw-connect__btn-wrapper"
          style={{ margin: '10px 0 0 0' }}
        >
          {this.shouldShowConnectButton() &&
            this.renderConnectToLatticeButton()}
          {this.renderConnectToQRButton()}
        </div>
      </>
    );
  }

  renderContinueButton() {
    return (
      <Button
        variant={BUTTON_VARIANT.PRIMARY}
        size={BUTTON_SIZES.LG}
        className="hw-connect__connect-btn"
        onClick={this.connect}
        disabled={!this.state.selectedDevice}
      >
        {this.context.t('continue')}
      </Button>
    );
  }

  renderFooter() {
    return (
      <Text
        color={TextColor.textAlternative}
        variant={TextVariant.bodySm}
        textAlign={TextAlign.Center}
        as="h6"
        marginTop={4}
        className="new-external-account-form footer"
      >
        {this.context.t('hardwareWalletsInfo')}
      </Text>
    );
  }

  renderUnsupportedBrowser() {
    return (
      <Box
        display={Display.Flex}
        flexDirection={FlexDirection.Column}
        justifyContent={JustifyContent.center}
        alignItems={AlignItems.center}
        className="new-external-account-form unsupported-browser"
      >
        <Box
          className="hw-connect"
          display={Display.Flex}
          flexDirection={FlexDirection.Column}
          alignItems={AlignItems.center}
        >
          <Text
            className="hw-connect__title"
            variant={TextVariant.headingMd}
            as="h3"
            fontWeight={FontWeight.Bold}
            marginTop={6}
            marginBottom={3}
          >
            {this.context.t('browserNotSupported')}
          </Text>
          <Text
            className="hw-connect__msg"
            variant={TextVariant.bodyMd}
            as="h5"
            marginTop={3}
            marginBottom={5}
          >
            {this.context.t('chromeRequiredForHardwareWallets')}
          </Text>
        </Box>
        <Button
          variant={BUTTON_VARIANT.PRIMARY}
          size={BUTTON_SIZES.LG}
          onClick={() =>
            global.platform.openTab({
              url: 'https://google.com/chrome',
            })
          }
        >
          {this.context.t('downloadGoogleChrome')}
        </Button>
      </Box>
    );
  }

  renderHeader() {
    return (
      <Box
        className="hw-connect__header"
        display={Display.Flex}
        flexDirection={FlexDirection.Column}
        alignItems={AlignItems.center}
      >
        <Box
          display={Display.Flex}
          flexDirection={FlexDirection.Row}
          justifyContent={JustifyContent.center}
          alignItems={AlignItems.center}
          className="hw-connect__header__title-wrapper"
          marginTop={6}
        >
          <Text
            variant={TextVariant.headingMd}
            as="h3"
            fontWeight={FontWeight.Bold}
            marginLeft="auto"
          >
            {this.context.t('hardwareWallets')}
          </Text>
          <ButtonIcon
            iconName={IconName.Close}
            ariaLabel={this.context.t('close')}
            onClick={this.props.onCancel}
            size={ButtonIconSize.Sm}
            marginLeft="auto"
            data-testid="hardware-connect-close-btn"
          />
        </Box>

        <Text
          className="hw-connect__header__msg"
          variant={TextVariant.bodyMd}
          as="h5"
          marginTop={5}
          marginBottom={3}
        >
          {this.context.t('hardwareWalletsMsg')}
        </Text>
      </Box>
    );
  }

  renderTutorialSteps() {
    switch (this.state.selectedDevice) {
      case HardwareDeviceNames.ledger:
        return this.renderLedgerTutorialSteps();
      case HardwareDeviceNames.trezor:
        return this.renderTrezorTutorialSteps();
      case HardwareDeviceNames.lattice:
        return this.renderLatticeTutorialSteps();
      case HardwareDeviceNames.qr:
        return this.renderQRHardwareWalletSteps();
      default:
        return '';
    }
  }

  renderLedgerTutorialSteps() {
    const steps = [];
    if (this.props.ledgerTransportType === LedgerTransportTypes.live) {
      steps.push({
        renderButtons: false,
        title: this.context.t('step1LedgerWallet'),
        message: this.context.t('step1LedgerWalletMsg', [
          <a
            className="hw-connect__msg-link"
            href="https://www.ledger.com/ledger-live"
            rel="noopener noreferrer"
            target="_blank"
            key="ledger-live-app-link"
          >
            {this.context.t('ledgerLiveApp')}
          </a>,
        ]),
      });
    }

    steps.push({
      renderButtons: true,
      asset: 'plug-in-wallet',
      dimensions: { width: '225px', height: '75px' },
      title: this.context.t('step2LedgerWallet'),
      message: this.context.t('step2LedgerWalletMsg', [
        <a
          className="hw-connect__msg-link"
          href={ZENDESK_URLS.HARDWARE_CONNECTION}
          rel="noopener noreferrer"
          target="_blank"
          key="ledger-support-link"
        >
          {this.context.t('hardwareWalletSupportLinkConversion')}
        </a>,
      ]),
    });

    return (
      <div className="hw-tutorial">
        {steps.map((step, index) => (
          <Box
            display={Display.Flex}
            flexDirection={FlexDirection.Column}
            alignItems={AlignItems.center}
            className="hw-connect"
            key={index}
          >
            <h3 className="hw-connect__title">{step.title}</h3>
            {step.renderButtons ? (
              <Box
                display={Display.Flex}
                flexDirection={FlexDirection.Row}
                justifyContent={JustifyContent.center}
                marginBottom={2}
              >
                <Button
                  className="hw-connect__external-btn-first"
                  variant={BUTTON_VARIANT.SECONDARY}
                  onClick={() => {
                    this.context.trackEvent({
                      category: MetaMetricsEventCategory.Navigation,
                      event: 'Clicked Ledger Buy Now',
                    });
                    openWindow(HardwareAffiliateLinks.ledger);
                  }}
                >
                  {this.context.t('buyNow')}
                </Button>
                <Button
                  className="hw-connect__external-btn"
                  variant={BUTTON_VARIANT.SECONDARY}
                  onClick={() => {
                    this.context.trackEvent({
                      category: MetaMetricsEventCategory.Navigation,
                      event: 'Clicked Ledger Tutorial',
                    });
                    openWindow(HardwareAffiliateTutorialLinks.ledger);
                  }}
                >
                  {this.context.t('tutorial')}
                </Button>
              </Box>
            ) : null}
            <p className="hw-connect__msg">{step.message}</p>
            {step.asset && (
              <img
                className="hw-connect__step-asset"
                src={`images/${step.asset}.svg`}
                {...step.dimensions}
                alt=""
              />
            )}
          </Box>
        ))}
      </div>
    );
  }

  renderLatticeTutorialSteps() {
    const steps = [
      {
        asset: 'connect-lattice',
        dimensions: { width: '225px', height: '75px' },
        title: this.context.t('step1LatticeWallet'),
        message: this.context.t('step1LatticeWalletMsg', [
          <a
            className="hw-connect__msg-link"
            href={ZENDESK_URLS.HARDWARE_CONNECTION}
            rel="noopener noreferrer"
            target="_blank"
            key="lattice-setup-link"
          >
            {this.context.t('hardwareWalletSupportLinkConversion')}
          </a>,
        ]),
      },
    ];

    return (
      <div className="hw-tutorial">
        {steps.map((step, index) => (
          <Box
            display={Display.Flex}
            flexDirection={FlexDirection.Column}
            alignItems={AlignItems.center}
            className="hw-connect"
            key={index}
          >
            <h3 className="hw-connect__title">{step.title}</h3>
            <Box
              display={Display.Flex}
              flexDirection={FlexDirection.Row}
              justifyContent={JustifyContent.center}
              marginBottom={2}
            >
              <Button
                className="hw-connect__external-btn-first"
                variant={BUTTON_VARIANT.SECONDARY}
                onClick={() => {
                  this.context.trackEvent({
                    category: MetaMetricsEventCategory.Navigation,
                    event: 'Clicked GridPlus Buy Now',
                  });
                  openWindow(HardwareAffiliateLinks.gridplus);
                }}
              >
                {this.context.t('buyNow')}
              </Button>
              <Button
                className="hw-connect__external-btn"
                variant={BUTTON_VARIANT.SECONDARY}
                onClick={() => {
                  this.context.trackEvent({
                    category: MetaMetricsEventCategory.Navigation,
                    event: 'Clicked GidPlus Tutorial',
                  });
                  openWindow(HardwareAffiliateTutorialLinks.gridplus);
                }}
              >
                {this.context.t('tutorial')}
              </Button>
            </Box>
            <p className="hw-connect__msg">{step.message}</p>
            {step.asset && (
              <img
                className="hw-connect__step-asset"
                src={`images/${step.asset}.svg`}
                {...step.dimensions}
                alt=""
              />
            )}
          </Box>
        ))}
      </div>
    );
  }

  renderTrezorTutorialSteps() {
    const steps = [
      {
        asset: 'plug-in-wallet',
        dimensions: { width: '225px', height: '75px' },
        title: this.context.t('step1TrezorWallet'),
        message: this.context.t('step1TrezorWalletMsg', [
          <a
            className="hw-connect__msg-link"
            href={ZENDESK_URLS.HARDWARE_CONNECTION}
            rel="noopener noreferrer"
            target="_blank"
            key="trezor-support-link"
          >
            {this.context.t('hardwareWalletSupportLinkConversion')}
          </a>,
        ]),
      },
    ];

    return (
      <div className="hw-tutorial">
        {steps.map((step, index) => (
          <Box
            display={Display.Flex}
            flexDirection={FlexDirection.Column}
            alignItems={AlignItems.center}
            className="hw-connect"
            key={index}
          >
            <h3 className="hw-connect__title">{step.title}</h3>
            <Box
              display={Display.Flex}
              flexDirection={FlexDirection.Row}
              justifyContent={JustifyContent.center}
              marginBottom={2}
            >
              <Button
                className="hw-connect__external-btn-first"
                variant={BUTTON_VARIANT.SECONDARY}
                onClick={() => {
                  this.context.trackEvent({
                    category: MetaMetricsEventCategory.Navigation,
                    event: 'Clicked Trezor Buy Now',
                  });
                  openWindow(HardwareAffiliateLinks.trezor);
                }}
              >
                {this.context.t('buyNow')}
              </Button>
              <Button
                className="hw-connect__external-btn"
                variant={BUTTON_VARIANT.SECONDARY}
                onClick={() => {
                  this.context.trackEvent({
                    category: MetaMetricsEventCategory.Navigation,
                    event: 'Clicked Trezor Tutorial',
                  });
                  openWindow(HardwareAffiliateTutorialLinks.trezor);
                }}
              >
                {this.context.t('tutorial')}
              </Button>
            </Box>

            <p className="hw-connect__msg">{step.message}</p>
            {step.asset && (
              <img
                className="hw-connect__step-asset"
                src={`images/${step.asset}.svg`}
                {...step.dimensions}
                alt=""
              />
            )}
          </Box>
        ))}
      </div>
    );
  }

  renderQRHardwareWalletSteps() {
    const steps = [];
    steps.push(
      {
        title: this.context.t('QRHardwareWalletSteps1Title'),
        message: this.context.t('QRHardwareWalletSteps1Description'),
      },
      {
        message: (
          <>
            <p className="hw-connect__QR-subtitle">
              {this.context.t('keystone')}
            </p>
            <Button
              className="hw-connect__external-btn-first"
              variant={BUTTON_VARIANT.SECONDARY}
              onClick={() => {
                this.context.trackEvent({
                  category: MetaMetricsEventCategory.Navigation,
                  event: 'Clicked Keystone Learn More',
                });
                openWindow(HardwareAffiliateLinks.keystone);
              }}
            >
              {this.context.t('learnMoreKeystone')}
            </Button>
            <Button
              className="hw-connect__external-btn"
              variant={BUTTON_VARIANT.SECONDARY}
              onClick={() => {
                this.context.trackEvent({
                  category: MetaMetricsEventCategory.Navigation,
                  event: 'Clicked Keystone Tutorial',
                });
                openWindow(HardwareAffiliateTutorialLinks.keystone);
              }}
            >
              {this.context.t('tutorial')}
            </Button>
          </>
        ),
      },
      {
        message: (
          <>
            <p className="hw-connect__QR-subtitle">
              {this.context.t('airgapVault')}
            </p>
            <Button
              className="hw-connect__external-btn-first"
              variant={BUTTON_VARIANT.SECONDARY}
              onClick={() => {
                this.context.trackEvent({
                  category: MetaMetricsEventCategory.Navigation,
                  event: 'Clicked AirGap Vault Buy Now',
                });
                openWindow(HardwareAffiliateLinks.airgap);
              }}
            >
              {this.context.t('downloadNow')}
            </Button>
            <Button
              className="hw-connect__external-btn"
              variant={BUTTON_VARIANT.SECONDARY}
              onClick={() => {
                this.context.trackEvent({
                  category: MetaMetricsEventCategory.Navigation,
                  event: 'Clicked AirGap Vault Tutorial',
                });
                openWindow(HardwareAffiliateTutorialLinks.airgap);
              }}
            >
              {this.context.t('tutorial')}
            </Button>
          </>
        ),
      },
      {
        message: (
          <>
            <p className="hw-connect__QR-subtitle">
              {this.context.t('coolWallet')}
            </p>
            <Button
              className="hw-connect__external-btn-first"
              variant={BUTTON_VARIANT.SECONDARY}
              onClick={() => {
                this.context.trackEvent({
                  category: MetaMetricsEventCategory.Navigation,
                  event: 'Clicked CoolWallet Buy Now',
                });
                openWindow(HardwareAffiliateLinks.coolwallet);
              }}
            >
              {this.context.t('buyNow')}
            </Button>
            <Button
              className="hw-connect__external-btn"
              variant={BUTTON_VARIANT.SECONDARY}
              onClick={() => {
                this.context.trackEvent({
                  category: MetaMetricsEventCategory.Navigation,
                  event: 'Clicked CoolWallet Tutorial',
                });
                openWindow(HardwareAffiliateTutorialLinks.coolwallet);
              }}
            >
              {this.context.t('tutorial')}
            </Button>
          </>
        ),
      },
      {
        message: (
          <>
            <p className="hw-connect__QR-subtitle">{this.context.t('dcent')}</p>
            <Button
              className="hw-connect__external-btn-first"
              variant={BUTTON_VARIANT.SECONDARY}
              onClick={() => {
                this.context.trackEvent({
                  category: MetaMetricsEventCategory.Navigation,
                  event: 'Clicked DCent Buy Now',
                });
                openWindow(HardwareAffiliateLinks.dcent);
              }}
            >
              {this.context.t('buyNow')}
            </Button>
            <Button
              className="hw-connect__external-btn"
              variant={BUTTON_VARIANT.SECONDARY}
              onClick={() => {
                this.context.trackEvent({
                  category: MetaMetricsEventCategory.Navigation,
                  event: 'Clicked DCent Tutorial',
                });
                openWindow(HardwareAffiliateTutorialLinks.dcent);
              }}
            >
              {this.context.t('tutorial')}
            </Button>
          </>
        ),
      },
      {
        message: this.context.t('QRHardwareWalletSteps2Description'),
      },
      {
        asset: 'qrcode-wallet-demo',
        dimensions: { width: '225px', height: '75px' },
      },
    );
    return (
      <div className="hw-tutorial">
        {steps.map((step, index) => (
          <div className="hw-connect" key={index}>
            {step.title && <h3 className="hw-connect__title">{step.title}</h3>}
            <div className="hw-connect__msg">{step.message}</div>
            {step.asset && (
              <img
                className="hw-connect__step-asset"
                src={`images/${step.asset}.svg`}
                {...step.dimensions}
                alt=""
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  renderConnectScreen() {
    return (
      <Box
        className="new-external-account-form"
        display={Display.Flex}
        flexDirection={FlexDirection.Column}
        alignItems={AlignItems.center}
        justifyContent={JustifyContent.center}
      >
        {this.renderHeader()}
        {this.renderButtons()}
        {this.state.selectedDevice ? this.renderTutorialSteps() : null}
        {this.renderContinueButton()}
        {this.renderFooter()}
      </Box>
    );
  }

  render() {
    if (this.props.browserSupported) {
      return this.renderConnectScreen();
    }
    return this.renderUnsupportedBrowser();
  }
}
