import EventEmitter from 'events';
import { pipeline } from 'readable-stream';
import {
  AssetsContractController,
  CurrencyRateController,
  NftController,
  NftDetectionController,
  TokenDetectionController,
  TokenListController,
  TokenRatesController,
  TokensController,
  CodefiTokenPricesServiceV2,
  RatesController,
  fetchMultiExchangeRate,
} from '@metamask/assets-controllers';
import { ObservableStore } from '@metamask/obs-store';
import { storeAsStream } from '@metamask/obs-store/dist/asStream';
import { JsonRpcEngine } from 'json-rpc-engine';
import { createEngineStream } from 'json-rpc-middleware-stream';
import { providerAsMiddleware } from '@metamask/eth-json-rpc-middleware';
import { debounce, throttle, memoize, wrap } from 'lodash';
import {
  KeyringController,
  keyringBuilderFactory,
} from '@metamask/keyring-controller';
import createFilterMiddleware from '@metamask/eth-json-rpc-filters';
import createSubscriptionManager from '@metamask/eth-json-rpc-filters/subscriptionManager';
import {
  errorCodes as rpcErrorCodes,
  EthereumRpcError,
  ethErrors,
} from 'eth-rpc-errors';

import { Mutex } from 'await-semaphore';
import log from 'loglevel';
import {
  TrezorConnectBridge,
  TrezorKeyring,
} from '@metamask/eth-trezor-keyring';
import {
  LedgerKeyring,
  LedgerIframeBridge,
} from '@metamask/eth-ledger-bridge-keyring';
import LatticeKeyring from 'eth-lattice-keyring';
import { MetaMaskKeyring as QRHardwareKeyring } from '@keystonehq/metamask-airgapped-keyring';
import EthQuery from '@metamask/eth-query';
import EthJSQuery from '@metamask/ethjs-query';
import nanoid from 'nanoid';
import { captureException } from '@sentry/browser';
import { AddressBookController } from '@metamask/address-book-controller';
import {
  ApprovalController,
  ApprovalRequestNotFoundError,
} from '@metamask/approval-controller';
import { ControllerMessenger } from '@metamask/base-controller';
import { EnsController } from '@metamask/ens-controller';
import { PhishingController } from '@metamask/phishing-controller';
import { AnnouncementController } from '@metamask/announcement-controller';
import { NetworkController } from '@metamask/network-controller';
import { GasFeeController } from '@metamask/gas-fee-controller';
import {
  PermissionController,
  PermissionDoesNotExistError,
  PermissionsRequestNotFoundError,
  SubjectMetadataController,
  SubjectType,
} from '@metamask/permission-controller';
import SmartTransactionsController from '@metamask/smart-transactions-controller';
import {
  METAMASK_DOMAIN,
  SelectedNetworkController,
  createSelectedNetworkMiddleware,
} from '@metamask/selected-network-controller';
import { LoggingController, LogType } from '@metamask/logging-controller';
import { PermissionLogController } from '@metamask/permission-log-controller';

import { RateLimitController } from '@metamask/rate-limit-controller';
import { NotificationController } from '@metamask/notification-controller';
import {
  CronjobController,
  JsonSnapsRegistry,
  SnapController,
  IframeExecutionService,
  SnapInterfaceController,
  OffscreenExecutionService,
} from '@metamask/snaps-controllers';
import {
  createSnapsMethodMiddleware,
  buildSnapEndowmentSpecifications,
  buildSnapRestrictedMethodSpecifications,
} from '@metamask/snaps-rpc-methods';

import { AccountsController } from '@metamask/accounts-controller';

///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
import {
  CUSTODIAN_TYPES,
  MmiConfigurationController,
} from '@metamask-institutional/custody-keyring';
import { InstitutionalFeaturesController } from '@metamask-institutional/institutional-features';
import { CustodyController } from '@metamask-institutional/custody-controller';
import { TransactionUpdateController } from '@metamask-institutional/transaction-update';
///: END:ONLY_INCLUDE_IF
import { SignatureController } from '@metamask/signature-controller';
import { PPOMController } from '@metamask/ppom-validator';
import {
  ApprovalType,
  ERC1155,
  ERC20,
  ERC721,
} from '@metamask/controller-utils';
import { wordlist } from '@metamask/scure-bip39/dist/wordlists/english';

import {
  NameController,
  ENSNameProvider,
  EtherscanNameProvider,
  TokenNameProvider,
  LensNameProvider,
} from '@metamask/name-controller';

import {
  QueuedRequestController,
  createQueuedRequestMiddleware,
} from '@metamask/queued-request-controller';

import { UserOperationController } from '@metamask/user-operation-controller';

import {
  TransactionController,
  TransactionStatus,
  TransactionType,
} from '@metamask/transaction-controller';

///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
import {
  getLocalizedSnapManifest,
  stripSnapPrefix,
} from '@metamask/snaps-utils';
///: END:ONLY_INCLUDE_IF

import { Interface } from '@ethersproject/abi';
import { abiERC1155, abiERC721 } from '@metamask/metamask-eth-abis';
import { isEvmAccountType } from '@metamask/keyring-api';
import {
  methodsRequiringNetworkSwitch,
  methodsWithConfirmation,
} from '../../shared/constants/methods-tags';

///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
import { toChecksumHexAddress } from '../../shared/modules/hexstring-utils';
///: END:ONLY_INCLUDE_IF

import { AssetType, TokenStandard } from '../../shared/constants/transaction';
import {
  GAS_API_BASE_URL,
  GAS_DEV_API_BASE_URL,
  SWAPS_CLIENT_ID,
} from '../../shared/constants/swaps';
import {
  CHAIN_IDS,
  NETWORK_TYPES,
  TEST_NETWORK_TICKER_MAP,
  NetworkStatus,
} from '../../shared/constants/network';
import { getAllowedSmartTransactionsChainIds } from '../../shared/constants/smartTransactions';

import {
  HardwareDeviceNames,
  LedgerTransportTypes,
} from '../../shared/constants/hardware-wallets';
import { KeyringType } from '../../shared/constants/keyring';
import {
  CaveatTypes,
  RestrictedMethods,
  EndowmentPermissions,
  ExcludedSnapPermissions,
  ExcludedSnapEndowments,
} from '../../shared/constants/permissions';
import { UI_NOTIFICATIONS } from '../../shared/notifications';
import { MILLISECOND, SECOND } from '../../shared/constants/time';
import {
  ORIGIN_METAMASK,
  SNAP_DIALOG_TYPES,
  POLLING_TOKEN_ENVIRONMENT_TYPES,
} from '../../shared/constants/app';
import {
  MetaMetricsEventCategory,
  MetaMetricsEventName,
} from '../../shared/constants/metametrics';
import { LOG_EVENT } from '../../shared/constants/logs';

import {
  getTokenIdParam,
  fetchTokenBalance,
  fetchERC1155Balance,
} from '../../shared/lib/token-util';
import { isEqualCaseInsensitive } from '../../shared/modules/string-utils';
import { parseStandardTokenTransactionData } from '../../shared/modules/transaction.utils';
import { STATIC_MAINNET_TOKEN_LIST } from '../../shared/constants/tokens';
import { getTokenValueParam } from '../../shared/lib/metamask-controller-utils';
import { isManifestV3 } from '../../shared/modules/mv3.utils';
import { convertNetworkId } from '../../shared/modules/network.utils';
import {
  getIsSmartTransaction,
  getFeatureFlagsByChainId,
  getSmartTransactionsOptInStatus,
  getCurrentChainSupportsSmartTransactions,
} from '../../shared/modules/selectors';
import { createCaipStream } from '../../shared/modules/caip-stream';
import { BaseUrl } from '../../shared/constants/urls';
import {
  TOKEN_TRANSFER_LOG_TOPIC_HASH,
  TRANSFER_SINFLE_LOG_TOPIC_HASH,
} from '../../shared/lib/transactions-controller-utils';
import { BalancesController as MultichainBalancesController } from './lib/accounts/BalancesController';
import {
  ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
  handleMMITransactionUpdate,
  ///: END:ONLY_INCLUDE_IF
  handleTransactionAdded,
  handleTransactionApproved,
  handleTransactionFailed,
  handleTransactionConfirmed,
  handleTransactionDropped,
  handleTransactionRejected,
  handleTransactionSubmitted,
  handlePostTransactionBalanceUpdate,
  createTransactionEventFragmentWithTxId,
} from './lib/transaction/metrics';
///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
import {
  afterTransactionSign as afterTransactionSignMMI,
  beforeCheckPendingTransaction as beforeCheckPendingTransactionMMI,
  beforeTransactionPublish as beforeTransactionPublishMMI,
  beforeTransactionApproveOnInit as beforeApproveOnInitMMI,
  getAdditionalSignArguments as getAdditionalSignArgumentsMMI,
} from './lib/transaction/mmi-hooks';
///: END:ONLY_INCLUDE_IF
import { submitSmartTransactionHook } from './lib/transaction/smart-transactions';
///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
import { keyringSnapPermissionsBuilder } from './lib/snap-keyring/keyring-snaps-permissions';
///: END:ONLY_INCLUDE_IF

import { SnapsNameProvider } from './lib/SnapsNameProvider';
import { AddressBookPetnamesBridge } from './lib/AddressBookPetnamesBridge';
import { AccountIdentitiesPetnamesBridge } from './lib/AccountIdentitiesPetnamesBridge';
import { createPPOMMiddleware } from './lib/ppom/ppom-middleware';
import * as PPOMModule from './lib/ppom/ppom';
import {
  onMessageReceived,
  checkForMultipleVersionsRunning,
} from './detect-multiple-instances';
///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
import MMIController from './controllers/mmi-controller';
import { mmiKeyringBuilderFactory } from './mmi-keyring-builder-factory';
///: END:ONLY_INCLUDE_IF
import ComposableObservableStore from './lib/ComposableObservableStore';
import AccountTracker from './lib/account-tracker';
import createDupeReqFilterStream from './lib/createDupeReqFilterStream';
import createLoggerMiddleware from './lib/createLoggerMiddleware';
import {
  createLegacyMethodMiddleware,
  createMethodMiddleware,
  createUnsupportedMethodMiddleware,
} from './lib/rpc-method-middleware';
import createOriginMiddleware from './lib/createOriginMiddleware';
import createTabIdMiddleware from './lib/createTabIdMiddleware';
import { NetworkOrderController } from './controllers/network-order';
import { AccountOrderController } from './controllers/account-order';
import createOnboardingMiddleware from './lib/createOnboardingMiddleware';
import { isStreamWritable, setupMultiplex } from './lib/stream-utils';
import PreferencesController from './controllers/preferences';
import AppStateController from './controllers/app-state';
import AlertController from './controllers/alert';
import OnboardingController from './controllers/onboarding';
import Backup from './lib/backup';
import DecryptMessageController from './controllers/decrypt-message';
import SwapsController from './controllers/swaps';
import MetaMetricsController from './controllers/metametrics';
import { segment } from './lib/segment';
import createMetaRPCHandler from './lib/createMetaRPCHandler';
import { previousValueComparator } from './lib/util';
import createMetamaskMiddleware from './lib/createMetamaskMiddleware';
import { hardwareKeyringBuilderFactory } from './lib/hardware-keyring-builder-factory';
import EncryptionPublicKeyController from './controllers/encryption-public-key';
import AppMetadataController from './controllers/app-metadata';

import {
  CaveatFactories,
  CaveatMutatorFactories,
  getCaveatSpecifications,
  getChangedAccounts,
  getPermissionBackgroundApiMethods,
  getPermissionSpecifications,
  getPermittedAccountsByOrigin,
  NOTIFICATION_NAMES,
  PermissionNames,
  unrestrictedMethods,
} from './controllers/permissions';
import createRPCMethodTrackingMiddleware from './lib/createRPCMethodTrackingMiddleware';
import { IndexedDBPPOMStorage } from './lib/ppom/indexed-db-backend';
import { updateCurrentLocale } from './translate';
import { TrezorOffscreenBridge } from './lib/offscreen-bridge/trezor-offscreen-bridge';
import { LedgerOffscreenBridge } from './lib/offscreen-bridge/ledger-offscreen-bridge';
///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
import { snapKeyringBuilder, getAccountsBySnapId } from './lib/snap-keyring';
///: END:ONLY_INCLUDE_IF
import { encryptorFactory } from './lib/encryptor-factory';
import { addDappTransaction, addTransaction } from './lib/transaction/util';
import { LatticeKeyringOffscreen } from './lib/offscreen-bridge/lattice-offscreen-keyring';
import PREINSTALLED_SNAPS from './snaps/preinstalled-snaps';
import { WeakRefObjectMap } from './lib/WeakRefObjectMap';

// Notification controllers
import AuthenticationController from './controllers/authentication/authentication-controller';
import UserStorageController from './controllers/user-storage/user-storage-controller';
import { PushPlatformNotificationsController } from './controllers/push-platform-notifications/push-platform-notifications';
import { MetamaskNotificationsController } from './controllers/metamask-notifications/metamask-notifications';
import { createTxVerificationMiddleware } from './lib/tx-verification/tx-verification-middleware';
import { updateSecurityAlertResponse } from './lib/ppom/ppom-util';
import createEvmMethodsToNonEvmAccountReqFilterMiddleware from './lib/createEvmMethodsToNonEvmAccountReqFilterMiddleware';
import { isEthAddress } from './lib/multichain/address';
import BridgeController from './controllers/bridge';

export const METAMASK_CONTROLLER_EVENTS = {
  // Fired after state changes that impact the extension badge (unapproved msg count)
  // The process of updating the badge happens in app/scripts/background.js.
  UPDATE_BADGE: 'updateBadge',
  // TODO: Add this and similar enums to the `controllers` repo and export them
  APPROVAL_STATE_CHANGE: 'ApprovalController:stateChange',
  QUEUED_REQUEST_STATE_CHANGE: 'QueuedRequestController:stateChange',
  METAMASK_NOTIFICATIONS_LIST_UPDATED:
    'MetamaskNotificationsController:notificationsListUpdated',
  METAMASK_NOTIFICATIONS_MARK_AS_READ:
    'MetamaskNotificationsController:markNotificationsAsRead',
  NOTIFICATIONS_STATE_CHANGE: 'NotificationController:stateChange',
};

// stream channels
const PHISHING_SAFELIST = 'metamask-phishing-safelist';

export default class MetamaskController extends EventEmitter {
  /**
   * @param {object} opts
   */
  constructor(opts) {
    super();

    const { isFirstMetaMaskControllerSetup } = opts;

    this.defaultMaxListeners = 20;

    this.sendUpdate = debounce(
      this.privateSendUpdate.bind(this),
      MILLISECOND * 200,
    );
    this.opts = opts;
    this.extension = opts.browser;
    this.platform = opts.platform;
    this.notificationManager = opts.notificationManager;
    const initState = opts.initState || {};
    const version = this.platform.getVersion();
    this.recordFirstTimeInfo(initState);
    this.featureFlags = opts.featureFlags;

    // this keeps track of how many "controllerStream" connections are open
    // the only thing that uses controller connections are open metamask UI instances
    this.activeControllerConnections = 0;

    this.offscreenPromise = opts.offscreenPromise ?? Promise.resolve();

    this.getRequestAccountTabIds = opts.getRequestAccountTabIds;
    this.getOpenMetamaskTabsIds = opts.getOpenMetamaskTabsIds;

    this.controllerMessenger = new ControllerMessenger();

    this.loggingController = new LoggingController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'LoggingController',
      }),
      state: initState.LoggingController,
    });

    // instance of a class that wraps the extension's storage local API.
    this.localStoreApiWrapper = opts.localStore;

    this.currentMigrationVersion = opts.currentMigrationVersion;

    // observable state store
    this.store = new ComposableObservableStore({
      state: initState,
      controllerMessenger: this.controllerMessenger,
      persist: true,
    });

    // external connections by origin
    // Do not modify directly. Use the associated methods.
    this.connections = {};

    // lock to ensure only one vault created at once
    this.createVaultMutex = new Mutex();

    this.extension.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'update') {
        if (version === '8.1.0') {
          this.platform.openExtensionInBrowser();
        }
        this.loggingController.add({
          type: LogType.GenericLog,
          data: {
            event: LOG_EVENT.VERSION_UPDATE,
            previousVersion: details.previousVersion,
            version,
          },
        });
      }
    });

    this.appMetadataController = new AppMetadataController({
      state: initState.AppMetadataController,
      currentMigrationVersion: this.currentMigrationVersion,
      currentAppVersion: version,
    });

    // next, we will initialize the controllers
    // controller initialization order matters
    const clearPendingConfirmations = () => {
      this.encryptionPublicKeyController.clearUnapproved();
      this.decryptMessageController.clearUnapproved();
      this.signatureController.clearUnapproved();
      this.approvalController.clear(ethErrors.provider.userRejectedRequest());
    };

    this.queuedRequestController = new QueuedRequestController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'QueuedRequestController',
        allowedActions: [
          'NetworkController:getState',
          'NetworkController:setActiveNetwork',
          'SelectedNetworkController:getNetworkClientIdForDomain',
        ],
        allowedEvents: ['SelectedNetworkController:stateChange'],
      }),
      shouldRequestSwitchNetwork: ({ method }) =>
        methodsRequiringNetworkSwitch.includes(method),
      clearPendingConfirmations,
      showApprovalRequest: opts.showUserConfirmation,
    });

    this.approvalController = new ApprovalController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'ApprovalController',
      }),
      showApprovalRequest: opts.showUserConfirmation,
      typesExcludedFromRateLimiting: [
        ApprovalType.EthSign,
        ApprovalType.PersonalSign,
        ApprovalType.EthSignTypedData,
        ApprovalType.Transaction,
        ApprovalType.WatchAsset,
        ApprovalType.EthGetEncryptionPublicKey,
        ApprovalType.EthDecrypt,
      ],
    });

    ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
    this.mmiConfigurationController = new MmiConfigurationController({
      initState: initState.MmiConfigurationController,
      mmiConfigurationServiceUrl: process.env.MMI_CONFIGURATION_SERVICE_URL,
    });
    ///: END:ONLY_INCLUDE_IF

    const networkControllerMessenger = this.controllerMessenger.getRestricted({
      name: 'NetworkController',
    });

    let initialNetworkControllerState = {};
    if (initState.NetworkController) {
      initialNetworkControllerState = initState.NetworkController;
    } else if (process.env.IN_TEST) {
      const networkConfig = {
        chainId: CHAIN_IDS.LOCALHOST,
        nickname: 'Localhost 8545',
        rpcPrefs: {},
        rpcUrl: 'http://localhost:8545',
        ticker: 'ETH',
        id: 'networkConfigurationId',
      };
      initialNetworkControllerState = {
        providerConfig: {
          ...networkConfig,
          type: 'rpc',
        },
        networkConfigurations: {
          networkConfigurationId: {
            ...networkConfig,
          },
        },
      };
    } else if (
      process.env.METAMASK_DEBUG ||
      process.env.METAMASK_ENVIRONMENT === 'test'
    ) {
      initialNetworkControllerState = {
        providerConfig: {
          type: NETWORK_TYPES.SEPOLIA,
          chainId: CHAIN_IDS.SEPOLIA,
          ticker: TEST_NETWORK_TICKER_MAP[NETWORK_TYPES.SEPOLIA],
        },
      };
    }
    this.networkController = new NetworkController({
      messenger: networkControllerMessenger,
      state: initialNetworkControllerState,
      infuraProjectId: opts.infuraProjectId,
      trackMetaMetricsEvent: (...args) =>
        this.metaMetricsController.trackEvent(...args),
    });
    this.networkController.initializeProvider();
    this.provider =
      this.networkController.getProviderAndBlockTracker().provider;
    this.blockTracker =
      this.networkController.getProviderAndBlockTracker().blockTracker;
    this.deprecatedNetworkVersions = {};

    const accountsControllerMessenger = this.controllerMessenger.getRestricted({
      name: 'AccountsController',
      allowedEvents: [
        'SnapController:stateChange',
        'KeyringController:accountRemoved',
        'KeyringController:stateChange',
      ],
      allowedActions: [
        'KeyringController:getAccounts',
        'KeyringController:getKeyringsByType',
        'KeyringController:getKeyringForAccount',
      ],
    });

    this.accountsController = new AccountsController({
      messenger: accountsControllerMessenger,
      state: initState.AccountsController,
    });

    const preferencesMessenger = this.controllerMessenger.getRestricted({
      name: 'PreferencesController',
      allowedActions: [
        'AccountsController:setSelectedAccount',
        'AccountsController:getAccountByAddress',
        'AccountsController:setAccountName',
      ],
      allowedEvents: ['AccountsController:stateChange'],
    });

    this.preferencesController = new PreferencesController({
      initState: initState.PreferencesController,
      initLangCode: opts.initLangCode,
      messenger: preferencesMessenger,
      provider: this.provider,
      networkConfigurations: this.networkController.state.networkConfigurations,
    });

    const tokenListMessenger = this.controllerMessenger.getRestricted({
      name: 'TokenListController',
      allowedActions: ['NetworkController:getNetworkClientById'],
      allowedEvents: ['NetworkController:stateChange'],
    });

    this.tokenListController = new TokenListController({
      chainId: this.networkController.state.providerConfig.chainId,
      preventPollingOnNetworkRestart: !this.#isTokenListPollingRequired(
        this.preferencesController.store.getState(),
      ),
      messenger: tokenListMessenger,
      state: initState.TokenListController,
    });

    this.assetsContractController = new AssetsContractController(
      {
        chainId: this.networkController.state.providerConfig.chainId,
        onPreferencesStateChange: (listener) =>
          this.preferencesController.store.subscribe(listener),
        onNetworkDidChange: (cb) =>
          networkControllerMessenger.subscribe(
            'NetworkController:networkDidChange',
            () => {
              const networkState = this.networkController.state;
              return cb(networkState);
            },
          ),
        getNetworkClientById: this.networkController.getNetworkClientById.bind(
          this.networkController,
        ),
      },
      {
        provider: this.provider,
      },
      initState.AssetsContractController,
    );

    const tokensControllerMessenger = this.controllerMessenger.getRestricted({
      name: 'TokensController',
      allowedActions: [
        'ApprovalController:addRequest',
        'NetworkController:getNetworkClientById',
        'AccountsController:getSelectedAccount',
        'AccountsController:getAccount',
      ],
      allowedEvents: [
        'NetworkController:networkDidChange',
        'AccountsController:selectedEvmAccountChange',
        'PreferencesController:stateChange',
        'TokenListController:stateChange',
      ],
    });
    this.tokensController = new TokensController({
      state: initState.TokensController,
      provider: this.provider,
      messenger: tokensControllerMessenger,
      chainId: this.networkController.state.providerConfig.chainId,
    });

    const nftControllerMessenger = this.controllerMessenger.getRestricted({
      name: 'NftController',
      allowedEvents: [
        'PreferencesController:stateChange',
        'NetworkController:networkDidChange',
        'AccountsController:selectedEvmAccountChange',
      ],
      allowedActions: [
        `${this.approvalController.name}:addRequest`,
        `${this.networkController.name}:getNetworkClientById`,
        'AccountsController:getSelectedAccount',
        'AccountsController:getAccount',
      ],
    });
    this.nftController = new NftController({
      state: initState.NftController,
      messenger: nftControllerMessenger,
      chainId: this.networkController.state.providerConfig.chainId,
      getERC721AssetName: this.assetsContractController.getERC721AssetName.bind(
        this.assetsContractController,
      ),
      getERC721AssetSymbol:
        this.assetsContractController.getERC721AssetSymbol.bind(
          this.assetsContractController,
        ),
      getERC721TokenURI: this.assetsContractController.getERC721TokenURI.bind(
        this.assetsContractController,
      ),
      getERC721OwnerOf: this.assetsContractController.getERC721OwnerOf.bind(
        this.assetsContractController,
      ),
      getERC1155BalanceOf:
        this.assetsContractController.getERC1155BalanceOf.bind(
          this.assetsContractController,
        ),
      getERC1155TokenURI: this.assetsContractController.getERC1155TokenURI.bind(
        this.assetsContractController,
      ),
      onNftAdded: ({ address, symbol, tokenId, standard, source }) =>
        this.metaMetricsController.trackEvent({
          event: MetaMetricsEventName.NftAdded,
          category: MetaMetricsEventCategory.Wallet,
          sensitiveProperties: {
            token_contract_address: address,
            token_symbol: symbol,
            token_id: tokenId,
            token_standard: standard,
            asset_type: AssetType.NFT,
            source,
          },
        }),
    });

    this.nftController.setApiKey(process.env.OPENSEA_KEY);

    const nftDetectionControllerMessenger =
      this.controllerMessenger.getRestricted({
        name: 'NftDetectionController',
        allowedEvents: [
          'NetworkController:stateChange',
          'PreferencesController:stateChange',
        ],
        allowedActions: [
          'ApprovalController:addRequest',
          'NetworkController:getState',
          'NetworkController:getNetworkClientById',
          'AccountsController:getSelectedAccount',
        ],
      });

    this.nftDetectionController = new NftDetectionController({
      messenger: nftDetectionControllerMessenger,
      chainId: this.networkController.state.providerConfig.chainId,
      getOpenSeaApiKey: () => this.nftController.openSeaApiKey,
      getBalancesInSingleCall:
        this.assetsContractController.getBalancesInSingleCall.bind(
          this.assetsContractController,
        ),
      addNft: this.nftController.addNft.bind(this.nftController),
      getNftState: () => this.nftController.state,
      // added this to track previous value of useNftDetection, should be true on very first initializing of controller[]
      disabled:
        this.preferencesController.store.getState().useNftDetection ===
        undefined
          ? false // the detection is enabled by default
          : !this.preferencesController.store.getState().useNftDetection,
    });

    this.metaMetricsController = new MetaMetricsController({
      segment,
      preferencesStore: this.preferencesController.store,
      onNetworkDidChange: networkControllerMessenger.subscribe.bind(
        networkControllerMessenger,
        'NetworkController:networkDidChange',
      ),
      getNetworkIdentifier: () => {
        const { type, rpcUrl } = this.networkController.state.providerConfig;
        return type === NETWORK_TYPES.RPC ? rpcUrl : type;
      },
      getCurrentChainId: () =>
        this.networkController.state.providerConfig.chainId,
      version: this.platform.getVersion(),
      environment: process.env.METAMASK_ENVIRONMENT,
      extension: this.extension,
      initState: initState.MetaMetricsController,
      captureException,
    });

    this.on('update', (update) => {
      this.metaMetricsController.handleMetaMaskStateUpdate(update);
    });

    const gasFeeMessenger = this.controllerMessenger.getRestricted({
      name: 'GasFeeController',
      allowedActions: [
        'NetworkController:getEIP1559Compatibility',
        'NetworkController:getNetworkClientById',
        'NetworkController:getState',
      ],
      allowedEvents: ['NetworkController:stateChange'],
    });

    const gasApiBaseUrl = process.env.SWAPS_USE_DEV_APIS
      ? GAS_DEV_API_BASE_URL
      : GAS_API_BASE_URL;

    this.gasFeeController = new GasFeeController({
      state: initState.GasFeeController,
      interval: 10000,
      messenger: gasFeeMessenger,
      clientId: SWAPS_CLIENT_ID,
      getProvider: () =>
        this.networkController.getProviderAndBlockTracker().provider,
      onNetworkDidChange: (eventHandler) => {
        networkControllerMessenger.subscribe(
          'NetworkController:networkDidChange',
          () => eventHandler(this.networkController.state),
        );
      },
      getCurrentNetworkEIP1559Compatibility:
        this.networkController.getEIP1559Compatibility.bind(
          this.networkController,
        ),
      getCurrentAccountEIP1559Compatibility:
        this.getCurrentAccountEIP1559Compatibility.bind(this),
      legacyAPIEndpoint: `${gasApiBaseUrl}/networks/<chain_id>/gasPrices`,
      EIP1559APIEndpoint: `${gasApiBaseUrl}/networks/<chain_id>/suggestedGasFees`,
      getCurrentNetworkLegacyGasAPICompatibility: () => {
        const { chainId } = this.networkController.state.providerConfig;
        return chainId === CHAIN_IDS.BSC;
      },
      getChainId: () => this.networkController.state.providerConfig.chainId,
    });

    this.appStateController = new AppStateController({
      addUnlockListener: this.on.bind(this, 'unlock'),
      isUnlocked: this.isUnlocked.bind(this),
      initState: initState.AppStateController,
      onInactiveTimeout: () => this.setLocked(),
      preferencesStore: this.preferencesController.store,
      messenger: this.controllerMessenger.getRestricted({
        name: 'AppStateController',
        allowedActions: [
          `${this.approvalController.name}:addRequest`,
          `${this.approvalController.name}:acceptRequest`,
        ],
        allowedEvents: [`KeyringController:qrKeyringStateChange`],
      }),
      extension: this.extension,
    });

    const currencyRateMessenger = this.controllerMessenger.getRestricted({
      name: 'CurrencyRateController',
      allowedActions: [`${this.networkController.name}:getNetworkClientById`],
    });
    this.currencyRateController = new CurrencyRateController({
      includeUsdRate: true,
      messenger: currencyRateMessenger,
      state: initState.CurrencyController,
    });
    const initialFetchExchangeRate =
      this.currencyRateController.fetchExchangeRate.bind(
        this.currencyRateController,
      );
    this.currencyRateController.fetchExchangeRate = (...args) => {
      if (this.preferencesController.store.getState().useCurrencyRateCheck) {
        return initialFetchExchangeRate(...args);
      }
      return {
        conversionRate: null,
        usdConversionRate: null,
      };
    };

    const phishingControllerMessenger = this.controllerMessenger.getRestricted({
      name: 'PhishingController',
    });

    this.phishingController = new PhishingController({
      messenger: phishingControllerMessenger,
      state: initState.PhishingController,
      hotlistRefreshInterval: process.env.IN_TEST ? 5 * SECOND : undefined,
      stalelistRefreshInterval: process.env.IN_TEST ? 30 * SECOND : undefined,
    });

    this.ppomController = new PPOMController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'PPOMController',
        allowedEvents: ['NetworkController:stateChange'],
      }),
      storageBackend: new IndexedDBPPOMStorage('PPOMDB', 1),
      provider: this.provider,
      ppomProvider: { PPOM: PPOMModule.PPOM, ppomInit: PPOMModule.default },
      state: initState.PPOMController,
      chainId: this.networkController.state.providerConfig.chainId,
      securityAlertsEnabled:
        this.preferencesController.store.getState().securityAlertsEnabled,
      onPreferencesChange: this.preferencesController.store.subscribe.bind(
        this.preferencesController.store,
      ),
      cdnBaseUrl: process.env.BLOCKAID_FILE_CDN,
      blockaidPublicKey: process.env.BLOCKAID_PUBLIC_KEY,
    });

    const announcementMessenger = this.controllerMessenger.getRestricted({
      name: 'AnnouncementController',
    });

    this.announcementController = new AnnouncementController({
      messenger: announcementMessenger,
      allAnnouncements: UI_NOTIFICATIONS,
      state: initState.AnnouncementController,
    });

    const networkOrderMessenger = this.controllerMessenger.getRestricted({
      name: 'NetworkOrderController',
      allowedEvents: ['NetworkController:stateChange'],
    });
    this.networkOrderController = new NetworkOrderController({
      messenger: networkOrderMessenger,
      state: initState.NetworkOrderController,
    });

    const accountOrderMessenger = this.controllerMessenger.getRestricted({
      name: 'AccountOrderController',
    });
    this.accountOrderController = new AccountOrderController({
      messenger: accountOrderMessenger,
      state: initState.AccountOrderController,
    });

    const multichainBalancesControllerMessenger =
      this.controllerMessenger.getRestricted({
        name: 'BalancesController',
        allowedEvents: ['AccountsController:stateChange'],
        allowedActions: ['SnapController:handleRequest'],
      });

    this.multichainBalancesController = new MultichainBalancesController({
      messenger: multichainBalancesControllerMessenger,
      state: {},
      // TODO: remove when listMultichainAccounts action is available
      listMultichainAccounts:
        this.accountsController.listMultichainAccounts.bind(
          this.accountsController,
        ),
    });

    const multichainRatesControllerMessenger =
      this.controllerMessenger.getRestricted({
        name: 'RatesController',
      });
    this.multichainRatesController = new RatesController({
      state: initState.MultichainRatesController,
      messenger: multichainRatesControllerMessenger,
      includeUsdRate: true,
      fetchMultiExchangeRate,
    });

    const tokenRatesMessenger = this.controllerMessenger.getRestricted({
      name: 'TokenRatesController',
      allowedActions: [
        'TokensController:getState',
        'NetworkController:getNetworkClientById',
        'NetworkController:getState',
        'AccountsController:getAccount',
        'AccountsController:getSelectedAccount',
      ],
      allowedEvents: [
        'NetworkController:stateChange',
        'AccountsController:selectedEvmAccountChange',
        'PreferencesController:stateChange',
        'TokensController:stateChange',
      ],
    });

    // token exchange rate tracker
    this.tokenRatesController = new TokenRatesController({
      state: initState.TokenRatesController,
      messenger: tokenRatesMessenger,
      tokenPricesService: new CodefiTokenPricesServiceV2(),
    });

    this.preferencesController.store.subscribe(
      previousValueComparator((prevState, currState) => {
        const { useCurrencyRateCheck: prevUseCurrencyRateCheck } = prevState;
        const { useCurrencyRateCheck: currUseCurrencyRateCheck } = currState;
        if (currUseCurrencyRateCheck && !prevUseCurrencyRateCheck) {
          this.tokenRatesController.start();
        } else if (!currUseCurrencyRateCheck && prevUseCurrencyRateCheck) {
          this.tokenRatesController.stop();
        }
      }, this.preferencesController.store.getState()),
    );

    this.ensController = new EnsController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'EnsController',
      }),
      provider: this.provider,
      onNetworkDidChange: networkControllerMessenger.subscribe.bind(
        networkControllerMessenger,
        'NetworkController:networkDidChange',
      ),
    });

    this.onboardingController = new OnboardingController({
      initState: initState.OnboardingController,
    });

    let additionalKeyrings = [keyringBuilderFactory(QRHardwareKeyring)];

    if (isManifestV3 === false) {
      const keyringOverrides = this.opts.overrides?.keyrings;

      const additionalKeyringTypes = [
        keyringOverrides?.lattice || LatticeKeyring,
        QRHardwareKeyring,
      ];

      const additionalBridgedKeyringTypes = [
        {
          keyring: keyringOverrides?.trezor || TrezorKeyring,
          bridge: keyringOverrides?.trezorBridge || TrezorConnectBridge,
        },
        {
          keyring: keyringOverrides?.ledger || LedgerKeyring,
          bridge: keyringOverrides?.ledgerBridge || LedgerIframeBridge,
        },
      ];

      additionalKeyrings = additionalKeyringTypes.map((keyringType) =>
        keyringBuilderFactory(keyringType),
      );

      additionalBridgedKeyringTypes.forEach((keyringType) =>
        additionalKeyrings.push(
          hardwareKeyringBuilderFactory(
            keyringType.keyring,
            keyringType.bridge,
          ),
        ),
      );
    } else {
      additionalKeyrings.push(
        hardwareKeyringBuilderFactory(TrezorKeyring, TrezorOffscreenBridge),
        hardwareKeyringBuilderFactory(LedgerKeyring, LedgerOffscreenBridge),
        keyringBuilderFactory(LatticeKeyringOffscreen),
      );
    }

    ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
    for (const custodianType of Object.keys(CUSTODIAN_TYPES)) {
      additionalKeyrings.push(
        mmiKeyringBuilderFactory(CUSTODIAN_TYPES[custodianType].keyringClass, {
          mmiConfigurationController: this.mmiConfigurationController,
          captureException,
        }),
      );
    }
    ///: END:ONLY_INCLUDE_IF

    ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
    const snapKeyringBuildMessenger = this.controllerMessenger.getRestricted({
      name: 'SnapKeyringBuilder',
      allowedActions: [
        'ApprovalController:addRequest',
        'ApprovalController:acceptRequest',
        'ApprovalController:rejectRequest',
        'ApprovalController:startFlow',
        'ApprovalController:endFlow',
        'ApprovalController:showSuccess',
        'ApprovalController:showError',
        'PhishingController:test',
        'PhishingController:maybeUpdateState',
        'KeyringController:getAccounts',
        'AccountsController:setSelectedAccount',
        'AccountsController:getAccountByAddress',
      ],
    });

    const getSnapController = () => this.snapController;

    // Necessary to persist the keyrings and update the accounts both within the keyring controller and accounts controller
    const persistAndUpdateAccounts = async () => {
      await this.keyringController.persistAllKeyrings();
      await this.accountsController.updateAccounts();
    };

    const getSnapName = (id) => {
      if (!id) {
        return null;
      }

      const currentLocale = this.getLocale();
      const { snaps } = this.snapController.state;
      const snap = snaps[id];

      if (!snap) {
        return stripSnapPrefix(id);
      }

      if (snap.localizationFiles) {
        const localizedManifest = getLocalizedSnapManifest(
          snap.manifest,
          currentLocale,
          snap.localizationFiles,
        );
        return localizedManifest.proposedName;
      }

      return snap.manifest.proposedName;
    };

    const isSnapPreinstalled = (id) => {
      return PREINSTALLED_SNAPS.some((snap) => snap.snapId === id);
    };

    additionalKeyrings.push(
      snapKeyringBuilder(
        snapKeyringBuildMessenger,
        getSnapController,
        persistAndUpdateAccounts,
        (address) => this.preferencesController.setSelectedAddress(address),
        (address) => this.removeAccount(address),
        this.metaMetricsController.trackEvent.bind(this.metaMetricsController),
        getSnapName,
        isSnapPreinstalled,
      ),
    );

    ///: END:ONLY_INCLUDE_IF

    const keyringControllerMessenger = this.controllerMessenger.getRestricted({
      name: 'KeyringController',
    });

    this.keyringController = new KeyringController({
      cacheEncryptionKey: true,
      keyringBuilders: additionalKeyrings,
      state: initState.KeyringController,
      encryptor: opts.encryptor || encryptorFactory(600_000),
      messenger: keyringControllerMessenger,
    });

    this.controllerMessenger.subscribe('KeyringController:unlock', () =>
      this._onUnlock(),
    );
    this.controllerMessenger.subscribe('KeyringController:lock', () =>
      this._onLock(),
    );

    this.controllerMessenger.subscribe(
      'KeyringController:stateChange',
      (state) => {
        this._onKeyringControllerUpdate(state);
      },
    );

    this.permissionController = new PermissionController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'PermissionController',
        allowedActions: [
          `${this.approvalController.name}:addRequest`,
          `${this.approvalController.name}:hasRequest`,
          `${this.approvalController.name}:acceptRequest`,
          `${this.approvalController.name}:rejectRequest`,
          `SnapController:getPermitted`,
          `SnapController:install`,
          `SubjectMetadataController:getSubjectMetadata`,
        ],
      }),
      state: initState.PermissionController,
      caveatSpecifications: getCaveatSpecifications({
        getInternalAccounts: this.accountsController.listAccounts.bind(
          this.accountsController,
        ),
        findNetworkClientIdByChainId:
          this.networkController.findNetworkClientIdByChainId.bind(
            this.networkController,
          ),
      }),
      permissionSpecifications: {
        ...getPermissionSpecifications({
          getInternalAccounts: this.accountsController.listAccounts.bind(
            this.accountsController,
          ),
          getAllAccounts: this.keyringController.getAccounts.bind(
            this.keyringController,
          ),
          captureKeyringTypesWithMissingIdentities: (
            internalAccounts = [],
            accounts = [],
          ) => {
            const accountsMissingIdentities = accounts.filter(
              (address) =>
                !internalAccounts.some(
                  (account) =>
                    account.address.toLowerCase() === address.toLowerCase(),
                ),
            );
            const keyringTypesWithMissingIdentities =
              accountsMissingIdentities.map((address) =>
                this.keyringController.getAccountKeyringType(address),
              );

            const internalAccountCount = internalAccounts.length;

            const accountTrackerCount = Object.keys(
              this.accountTracker.store.getState().accounts || {},
            ).length;

            captureException(
              new Error(
                `Attempt to get permission specifications failed because their were ${accounts.length} accounts, but ${internalAccountCount} identities, and the ${keyringTypesWithMissingIdentities} keyrings included accounts with missing identities. Meanwhile, there are ${accountTrackerCount} accounts in the account tracker.`,
              ),
            );
          },
        }),
        ...this.getSnapPermissionSpecifications(),
      },
      unrestrictedMethods,
    });

    this.selectedNetworkController = new SelectedNetworkController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'SelectedNetworkController',
        allowedActions: [
          'NetworkController:getNetworkClientById',
          'NetworkController:getState',
          'NetworkController:getSelectedNetworkClient',
          'PermissionController:hasPermissions',
          'PermissionController:getSubjectNames',
        ],
        allowedEvents: [
          'NetworkController:stateChange',
          'PermissionController:stateChange',
        ],
      }),
      state: initState.SelectedNetworkController,
      useRequestQueuePreference:
        this.preferencesController.store.getState().useRequestQueue,
      onPreferencesStateChange: (listener) =>
        this.preferencesController.store.subscribe(listener),
      domainProxyMap: new WeakRefObjectMap(),
    });

    this.permissionLogController = new PermissionLogController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'PermissionLogController',
      }),
      restrictedMethods: new Set(Object.keys(RestrictedMethods)),
      state: initState.PermissionLogController,
    });

    this.subjectMetadataController = new SubjectMetadataController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'SubjectMetadataController',
        allowedActions: [`${this.permissionController.name}:hasPermissions`],
      }),
      state: initState.SubjectMetadataController,
      subjectCacheLimit: 100,
    });

    const shouldUseOffscreenExecutionService =
      isManifestV3 &&
      typeof chrome !== 'undefined' &&
      // eslint-disable-next-line no-undef
      typeof chrome.offscreen !== 'undefined';

    const snapExecutionServiceArgs = {
      messenger: this.controllerMessenger.getRestricted({
        name: 'ExecutionService',
      }),
      setupSnapProvider: this.setupSnapProvider.bind(this),
    };

    this.snapExecutionService =
      shouldUseOffscreenExecutionService === false
        ? new IframeExecutionService({
            ...snapExecutionServiceArgs,
            iframeUrl: new URL(process.env.IFRAME_EXECUTION_ENVIRONMENT_URL),
          })
        : new OffscreenExecutionService({
            ...snapExecutionServiceArgs,
            offscreenPromise: this.offscreenPromise,
          });

    const snapControllerMessenger = this.controllerMessenger.getRestricted({
      name: 'SnapController',
      allowedEvents: [
        'ExecutionService:unhandledError',
        'ExecutionService:outboundRequest',
        'ExecutionService:outboundResponse',
      ],
      allowedActions: [
        `${this.permissionController.name}:getEndowments`,
        `${this.permissionController.name}:getPermissions`,
        `${this.permissionController.name}:hasPermission`,
        `${this.permissionController.name}:hasPermissions`,
        `${this.permissionController.name}:requestPermissions`,
        `${this.permissionController.name}:revokeAllPermissions`,
        `${this.permissionController.name}:revokePermissions`,
        `${this.permissionController.name}:revokePermissionForAllSubjects`,
        `${this.permissionController.name}:getSubjectNames`,
        `${this.permissionController.name}:updateCaveat`,
        `${this.approvalController.name}:addRequest`,
        `${this.approvalController.name}:updateRequestState`,
        `${this.permissionController.name}:grantPermissions`,
        `${this.subjectMetadataController.name}:getSubjectMetadata`,
        `${this.subjectMetadataController.name}:addSubjectMetadata`,
        'ExecutionService:executeSnap',
        'ExecutionService:getRpcRequestHandler',
        'ExecutionService:terminateSnap',
        'ExecutionService:terminateAllSnaps',
        'ExecutionService:handleRpcRequest',
        'SnapsRegistry:get',
        'SnapsRegistry:getMetadata',
        'SnapsRegistry:update',
        'SnapsRegistry:resolveVersion',
        `SnapInterfaceController:createInterface`,
        `SnapInterfaceController:getInterface`,
      ],
    });

    const allowLocalSnaps = process.env.ALLOW_LOCAL_SNAPS;
    const requireAllowlist = process.env.REQUIRE_SNAPS_ALLOWLIST;

    this.snapController = new SnapController({
      environmentEndowmentPermissions: Object.values(EndowmentPermissions),
      excludedPermissions: {
        ...ExcludedSnapPermissions,
        ...ExcludedSnapEndowments,
      },
      closeAllConnections: this.removeAllConnections.bind(this),
      state: initState.SnapController,
      messenger: snapControllerMessenger,
      featureFlags: {
        dappsCanUpdateSnaps: true,
        allowLocalSnaps,
        requireAllowlist,
      },
      encryptor: encryptorFactory(600_000),
      getMnemonic: this.getPrimaryKeyringMnemonic.bind(this),
      preinstalledSnaps: PREINSTALLED_SNAPS,
      getFeatureFlags: () => {
        return {
          disableSnaps:
            this.preferencesController.store.getState().useExternalServices ===
            false,
        };
      },
    });

    this.notificationController = new NotificationController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'NotificationController',
      }),
      state: initState.NotificationController,
    });

    this.rateLimitController = new RateLimitController({
      state: initState.RateLimitController,
      messenger: this.controllerMessenger.getRestricted({
        name: 'RateLimitController',
      }),
      implementations: {
        showNativeNotification: {
          method: (origin, message) => {
            const subjectMetadataState = this.controllerMessenger.call(
              'SubjectMetadataController:getState',
            );

            const originMetadata = subjectMetadataState.subjectMetadata[origin];

            this.platform
              ._showNotification(originMetadata?.name ?? origin, message)
              .catch((error) => {
                log.error('Failed to create notification', error);
              });

            return null;
          },
          // 2 calls per 5 minutes
          rateLimitCount: 2,
          rateLimitTimeout: 300000,
        },
        showInAppNotification: {
          method: (origin, message) => {
            this.controllerMessenger.call(
              'NotificationController:show',
              origin,
              message,
            );

            return null;
          },
          // 5 calls per minute
          rateLimitCount: 5,
          rateLimitTimeout: 60000,
        },
      },
    });
    const cronjobControllerMessenger = this.controllerMessenger.getRestricted({
      name: 'CronjobController',
      allowedEvents: [
        'SnapController:snapInstalled',
        'SnapController:snapUpdated',
        'SnapController:snapUninstalled',
        'SnapController:snapEnabled',
        'SnapController:snapDisabled',
      ],
      allowedActions: [
        `${this.permissionController.name}:getPermissions`,
        'SnapController:handleRequest',
        'SnapController:getAll',
      ],
    });
    this.cronjobController = new CronjobController({
      state: initState.CronjobController,
      messenger: cronjobControllerMessenger,
    });

    const snapsRegistryMessenger = this.controllerMessenger.getRestricted({
      name: 'SnapsRegistry',
      allowedEvents: [],
      allowedActions: [],
    });

    this.snapsRegistry = new JsonSnapsRegistry({
      state: initState.SnapsRegistry,
      messenger: snapsRegistryMessenger,
      refetchOnAllowlistMiss: requireAllowlist,
      url: {
        registry: 'https://acl.execution.metamask.io/latest/registry.json',
        signature: 'https://acl.execution.metamask.io/latest/signature.json',
      },
      publicKey:
        '0x025b65308f0f0fb8bc7f7ff87bfc296e0330eee5d3c1d1ee4a048b2fd6a86fa0a6',
    });

    const snapInterfaceControllerMessenger =
      this.controllerMessenger.getRestricted({
        name: 'SnapInterfaceController',
        allowedActions: [
          `${this.phishingController.name}:maybeUpdateState`,
          `${this.phishingController.name}:testOrigin`,
        ],
      });

    this.snapInterfaceController = new SnapInterfaceController({
      state: initState.SnapInterfaceController,
      messenger: snapInterfaceControllerMessenger,
    });

    // Notification Controllers
    this.authenticationController = new AuthenticationController({
      state: initState.AuthenticationController,
      messenger: this.controllerMessenger.getRestricted({
        name: 'AuthenticationController',
        allowedActions: [
          'SnapController:handleRequest',
          'UserStorageController:disableProfileSyncing',
        ],
      }),
      metametrics: {
        getMetaMetricsId: () => this.metaMetricsController.getMetaMetricsId(),
      },
    });

    this.userStorageController = new UserStorageController({
      getMetaMetricsState: () =>
        this.metaMetricsController.state.participateInMetaMetrics,
      state: initState.UserStorageController,
      messenger: this.controllerMessenger.getRestricted({
        name: 'UserStorageController',
        allowedActions: [
          'SnapController:handleRequest',
          'AuthenticationController:getBearerToken',
          'AuthenticationController:getSessionProfile',
          'AuthenticationController:isSignedIn',
          'AuthenticationController:performSignOut',
          'AuthenticationController:performSignIn',
          'MetamaskNotificationsController:disableMetamaskNotifications',
          'MetamaskNotificationsController:selectIsMetamaskNotificationsEnabled',
        ],
      }),
    });

    const pushPlatformNotificationsControllerMessenger =
      this.controllerMessenger.getRestricted({
        name: 'PushPlatformNotificationsController',
        allowedActions: ['AuthenticationController:getBearerToken'],
      });
    this.pushPlatformNotificationsController =
      new PushPlatformNotificationsController({
        state: initState.PushPlatformNotificationsController,
        messenger: pushPlatformNotificationsControllerMessenger,
      });
    pushPlatformNotificationsControllerMessenger.subscribe(
      'PushPlatformNotificationsController:onNewNotifications',
      (notification) => {
        this.metaMetricsController.trackEvent({
          event: MetaMetricsEventName.PushNotificationReceived,
          category: MetaMetricsEventCategory.PushNotifications,
          properties: {
            notification_type: notification.type,
            chain_id: notification?.chain_id,
          },
        });
      },
    );
    pushPlatformNotificationsControllerMessenger.subscribe(
      'PushPlatformNotificationsController:pushNotificationClicked',
      (notification) => {
        this.metaMetricsController.trackEvent({
          event: MetaMetricsEventName.PushNotificationClicked,
          category: MetaMetricsEventCategory.PushNotifications,
          properties: {
            notification_type: notification.type,
            chain_id: notification?.chain_id,
          },
        });
      },
    );

    this.metamaskNotificationsController = new MetamaskNotificationsController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'MetamaskNotificationsController',
        allowedActions: [
          'KeyringController:getAccounts',
          'AuthenticationController:getBearerToken',
          'AuthenticationController:isSignedIn',
          'UserStorageController:enableProfileSyncing',
          'UserStorageController:getStorageKey',
          'UserStorageController:performGetStorage',
          'UserStorageController:performSetStorage',
          'PushPlatformNotificationsController:enablePushNotifications',
          'PushPlatformNotificationsController:disablePushNotifications',
          'PushPlatformNotificationsController:updateTriggerPushNotifications',
        ],
        allowedEvents: [
          'KeyringController:stateChange',
          'PushPlatformNotificationsController:onNewNotifications',
        ],
      }),
      state: initState.MetamaskNotificationsController,
    });

    // account tracker watches balances, nonces, and any code at their address
    this.accountTracker = new AccountTracker({
      provider: this.provider,
      blockTracker: this.blockTracker,
      getCurrentChainId: () =>
        this.networkController.state.providerConfig.chainId,
      getNetworkIdentifier: (providerConfig) => {
        const { type, rpcUrl } =
          providerConfig ?? this.networkController.state.providerConfig;
        return type === NETWORK_TYPES.RPC ? rpcUrl : type;
      },
      preferencesController: this.preferencesController,
      onboardingController: this.onboardingController,
      controllerMessenger: this.controllerMessenger.getRestricted({
        name: 'AccountTracker',
        allowedEvents: ['AccountsController:selectedEvmAccountChange'],
        allowedActions: ['AccountsController:getSelectedAccount'],
      }),
      initState: { accounts: {} },
      onAccountRemoved: this.controllerMessenger.subscribe.bind(
        this.controllerMessenger,
        'KeyringController:accountRemoved',
      ),
    });

    // start and stop polling for balances based on activeControllerConnections
    this.on('controllerConnectionChanged', (activeControllerConnections) => {
      const { completedOnboarding } =
        this.onboardingController.store.getState();
      if (activeControllerConnections > 0 && completedOnboarding) {
        this.triggerNetworkrequests();
      } else {
        this.stopNetworkRequests();
      }
    });

    this.onboardingController.store.subscribe(
      previousValueComparator(async (prevState, currState) => {
        const { completedOnboarding: prevCompletedOnboarding } = prevState;
        const { completedOnboarding: currCompletedOnboarding } = currState;
        if (!prevCompletedOnboarding && currCompletedOnboarding) {
          const { address } = this.accountsController.getSelectedAccount();

          this._addAccountsWithBalance();

          this.postOnboardingInitialization();
          this.triggerNetworkrequests();
          // execute once the token detection on the post-onboarding
          await this.tokenDetectionController.detectTokens({
            selectedAddress: address,
          });
        }
      }, this.onboardingController.store.getState()),
    );

    const tokenDetectionControllerMessenger =
      this.controllerMessenger.getRestricted({
        name: 'TokenDetectionController',
        allowedActions: [
          'AccountsController:getAccount',
          'AccountsController:getSelectedAccount',
          'KeyringController:getState',
          'NetworkController:getNetworkClientById',
          'NetworkController:getNetworkConfigurationByNetworkClientId',
          'NetworkController:getState',
          'PreferencesController:getState',
          'TokenListController:getState',
          'TokensController:getState',
          'TokensController:addDetectedTokens',
        ],
        allowedEvents: [
          'AccountsController:selectedEvmAccountChange',
          'KeyringController:lock',
          'KeyringController:unlock',
          'NetworkController:networkDidChange',
          'PreferencesController:stateChange',
          'TokenListController:stateChange',
        ],
      });

    this.tokenDetectionController = new TokenDetectionController({
      messenger: tokenDetectionControllerMessenger,
      getBalancesInSingleCall:
        this.assetsContractController.getBalancesInSingleCall.bind(
          this.assetsContractController,
        ),
      trackMetaMetricsEvent: this.metaMetricsController.trackEvent.bind(
        this.metaMetricsController,
      ),
    });

    this.addressBookController = new AddressBookController(
      undefined,
      initState.AddressBookController,
    );

    this.alertController = new AlertController({
      initState: initState.AlertController,
      preferencesStore: this.preferencesController.store,
      controllerMessenger: this.controllerMessenger.getRestricted({
        name: 'AlertController',
        allowedEvents: ['AccountsController:selectedAccountChange'],
        allowedActions: ['AccountsController:getSelectedAccount'],
      }),
    });

    ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
    this.custodyController = new CustodyController({
      initState: initState.CustodyController,
      captureException,
    });
    this.institutionalFeaturesController = new InstitutionalFeaturesController({
      initState: initState.InstitutionalFeaturesController,
      showConfirmRequest: opts.showUserConfirmation,
    });
    this.transactionUpdateController = new TransactionUpdateController({
      initState: initState.TransactionUpdateController,
      getCustodyKeyring: this.getCustodyKeyringIfExists.bind(this),
      mmiConfigurationController: this.mmiConfigurationController,
      captureException,
    });
    ///: END:ONLY_INCLUDE_IF

    this.backup = new Backup({
      preferencesController: this.preferencesController,
      addressBookController: this.addressBookController,
      accountsController: this.accountsController,
      networkController: this.networkController,
      trackMetaMetricsEvent: this.metaMetricsController.trackEvent.bind(
        this.metaMetricsController,
      ),
    });

    // This gets used as a ...spread parameter in two places: new TransactionController() and createRPCMethodTrackingMiddleware()
    this.snapAndHardwareMetricsParams = {
      getSelectedAccount: this.accountsController.getSelectedAccount.bind(
        this.accountsController,
      ),
      getAccountType: this.getAccountType.bind(this),
      getDeviceModel: this.getDeviceModel.bind(this),
      snapAndHardwareMessenger: this.controllerMessenger.getRestricted({
        name: 'SnapAndHardwareMessenger',
        allowedActions: [
          'KeyringController:getKeyringForAccount',
          'SnapController:get',
          'AccountsController:getSelectedAccount',
        ],
      }),
    };

    const transactionControllerMessenger =
      this.controllerMessenger.getRestricted({
        name: 'TransactionController',
        allowedActions: [
          `${this.approvalController.name}:addRequest`,
          'NetworkController:findNetworkClientIdByChainId',
          'NetworkController:getNetworkClientById',
        ],
        allowedEvents: [`NetworkController:stateChange`],
      });
    this.txController = new TransactionController({
      blockTracker: this.blockTracker,
      getCurrentNetworkEIP1559Compatibility:
        this.networkController.getEIP1559Compatibility.bind(
          this.networkController,
        ),
      getCurrentAccountEIP1559Compatibility:
        this.getCurrentAccountEIP1559Compatibility.bind(this),
      getExternalPendingTransactions:
        this.getExternalPendingTransactions.bind(this),
      getGasFeeEstimates: this.gasFeeController.fetchGasFeeEstimates.bind(
        this.gasFeeController,
      ),
      getNetworkClientRegistry:
        this.networkController.getNetworkClientRegistry.bind(
          this.networkController,
        ),
      getNetworkState: () => this.networkController.state,
      getPermittedAccounts: this.getPermittedAccounts.bind(this),
      getSavedGasFees: () =>
        this.preferencesController.store.getState().advancedGasFee[
          this.networkController.state.providerConfig.chainId
        ],
      getSelectedAddress: () =>
        this.accountsController.getSelectedAccount().address,
      incomingTransactions: {
        includeTokenTransfers: false,
        isEnabled: () =>
          Boolean(
            this.preferencesController.store.getState()
              .incomingTransactionsPreferences?.[
              this.networkController.state.providerConfig.chainId
            ] && this.onboardingController.store.getState().completedOnboarding,
          ),
        queryEntireHistory: false,
        updateTransactions: false,
      },
      isMultichainEnabled: process.env.TRANSACTION_MULTICHAIN,
      isSimulationEnabled: () =>
        this.preferencesController.store.getState().useTransactionSimulations,
      messenger: transactionControllerMessenger,
      onNetworkStateChange: (listener) => {
        networkControllerMessenger.subscribe(
          'NetworkController:networkDidChange',
          () => listener(),
        );
      },
      pendingTransactions: {
        isResubmitEnabled: () => {
          const state = this._getMetaMaskState();
          return !(
            getSmartTransactionsOptInStatus(state) &&
            getCurrentChainSupportsSmartTransactions(state)
          );
        },
      },
      provider: this.provider,
      testGasFeeFlows: process.env.TEST_GAS_FEE_FLOWS,
      hooks: {
        ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
        afterSign: (txMeta, signedEthTx) =>
          afterTransactionSignMMI(
            txMeta,
            signedEthTx,
            this.transactionUpdateController.addTransactionToWatchList.bind(
              this.transactionUpdateController,
            ),
          ),
        beforeCheckPendingTransaction:
          beforeCheckPendingTransactionMMI.bind(this),
        beforeApproveOnInit: beforeApproveOnInitMMI.bind(this),
        beforePublish: beforeTransactionPublishMMI.bind(this),
        getAdditionalSignArguments: getAdditionalSignArgumentsMMI.bind(this),
        ///: END:ONLY_INCLUDE_IF
        publish: this._publishSmartTransactionHook.bind(this),
      },
      sign: (...args) => this.keyringController.signTransaction(...args),
      state: initState.TransactionController,
    });

    this._addTransactionControllerListeners();

    this.decryptMessageController = new DecryptMessageController({
      getState: this.getState.bind(this),
      messenger: this.controllerMessenger.getRestricted({
        name: 'DecryptMessageController',
        allowedActions: [
          `${this.approvalController.name}:addRequest`,
          `${this.approvalController.name}:acceptRequest`,
          `${this.approvalController.name}:rejectRequest`,
          `${this.keyringController.name}:decryptMessage`,
        ],
      }),
      metricsEvent: this.metaMetricsController.trackEvent.bind(
        this.metaMetricsController,
      ),
    });

    this.encryptionPublicKeyController = new EncryptionPublicKeyController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'EncryptionPublicKeyController',
        allowedActions: [
          `${this.approvalController.name}:addRequest`,
          `${this.approvalController.name}:acceptRequest`,
          `${this.approvalController.name}:rejectRequest`,
        ],
      }),
      getEncryptionPublicKey:
        this.keyringController.getEncryptionPublicKey.bind(
          this.keyringController,
        ),
      getAccountKeyringType: this.keyringController.getAccountKeyringType.bind(
        this.keyringController,
      ),
      getState: this.getState.bind(this),
      metricsEvent: this.metaMetricsController.trackEvent.bind(
        this.metaMetricsController,
      ),
    });

    this.signatureController = new SignatureController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'SignatureController',
        allowedActions: [
          `${this.approvalController.name}:addRequest`,
          `${this.keyringController.name}:signMessage`,
          `${this.keyringController.name}:signPersonalMessage`,
          `${this.keyringController.name}:signTypedMessage`,
          `${this.loggingController.name}:add`,
        ],
      }),
      isEthSignEnabled: () =>
        this.preferencesController.store.getState()
          ?.disabledRpcMethodPreferences?.eth_sign,
      getAllState: this.getState.bind(this),
      getCurrentChainId: () =>
        this.networkController.state.providerConfig.chainId,
    });

    this.signatureController.hub.on(
      'cancelWithReason',
      ({ message, reason }) => {
        this.metaMetricsController.trackEvent({
          event: reason,
          category: MetaMetricsEventCategory.Transactions,
          properties: {
            action: 'Sign Request',
            type: message.type,
          },
        });
      },
    );

    ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
    const transactionMetricsRequest = this.getTransactionMetricsRequest();

    const mmiControllerMessenger = this.controllerMessenger.getRestricted({
      name: 'MMIController',
      allowedActions: [
        'AccountsController:getAccountByAddress',
        'AccountsController:setAccountName',
        'AccountsController:listAccounts',
        'AccountsController:getSelectedAccount',
        'AccountsController:setSelectedAccount',
      ],
    });

    this.mmiController = new MMIController({
      messenger: mmiControllerMessenger,
      mmiConfigurationController: this.mmiConfigurationController,
      keyringController: this.keyringController,
      preferencesController: this.preferencesController,
      appStateController: this.appStateController,
      transactionUpdateController: this.transactionUpdateController,
      custodyController: this.custodyController,
      getState: this.getState.bind(this),
      getPendingNonce: this.getPendingNonce.bind(this),
      accountTracker: this.accountTracker,
      metaMetricsController: this.metaMetricsController,
      networkController: this.networkController,
      permissionController: this.permissionController,
      signatureController: this.signatureController,
      platform: this.platform,
      extension: this.extension,
      getTransactions: this.txController.getTransactions.bind(
        this.txController,
      ),
      setTxStatusSigned: (id) =>
        this.txController.updateCustodialTransaction(id, {
          status: TransactionStatus.signed,
        }),
      setTxStatusSubmitted: (id) =>
        this.txController.updateCustodialTransaction(id, {
          status: TransactionStatus.submitted,
        }),
      setTxStatusFailed: (id, reason) =>
        this.txController.updateCustodialTransaction(id, {
          status: TransactionStatus.failed,
          errorMessage: reason,
        }),
      trackTransactionEvents: handleMMITransactionUpdate.bind(
        null,
        transactionMetricsRequest,
      ),
      updateTransaction: (txMeta, note) =>
        this.txController.updateTransaction(txMeta, note),
      updateTransactionHash: (id, hash) =>
        this.txController.updateCustodialTransaction(id, { hash }),
      setChannelId: (channelId) =>
        this.institutionalFeaturesController.setChannelId(channelId),
      setConnectionRequest: (payload) =>
        this.institutionalFeaturesController.setConnectionRequest(payload),
    });
    ///: END:ONLY_INCLUDE_IF

    this.swapsController = new SwapsController(
      {
        getBufferedGasLimit: async (txMeta, multiplier) => {
          const { gas: gasLimit, simulationFails } =
            await this.txController.estimateGasBuffered(
              txMeta.txParams,
              multiplier,
            );

          return { gasLimit, simulationFails };
        },
        provider: this.provider,
        getProviderConfig: () => this.networkController.state.providerConfig,
        getTokenRatesState: () => this.tokenRatesController.state,
        getCurrentChainId: () =>
          this.networkController.state.providerConfig.chainId,
        getEIP1559GasFeeEstimates:
          this.gasFeeController.fetchGasFeeEstimates.bind(
            this.gasFeeController,
          ),
        getLayer1GasFee: this.txController.getLayer1GasFee.bind(
          this.txController,
        ),
        getNetworkClientId: () =>
          this.networkController.state.selectedNetworkClientId,
        trackMetaMetricsEvent: this.metaMetricsController.trackEvent.bind(
          this.metaMetricsController,
        ),
      },
      initState.SwapsController,
    );
    this.bridgeController = new BridgeController();
    this.smartTransactionsController = new SmartTransactionsController(
      {
        getNetworkClientById: this.networkController.getNetworkClientById.bind(
          this.networkController,
        ),
        onNetworkStateChange: networkControllerMessenger.subscribe.bind(
          networkControllerMessenger,
          'NetworkController:stateChange',
        ),
        getNonceLock: this.txController.getNonceLock.bind(this.txController),
        confirmExternalTransaction:
          this.txController.confirmExternalTransaction.bind(this.txController),
        getTransactions: this.txController.getTransactions.bind(
          this.txController,
        ),
        provider: this.provider,
        trackMetaMetricsEvent: this.metaMetricsController.trackEvent.bind(
          this.metaMetricsController,
        ),
      },
      {
        supportedChainIds: getAllowedSmartTransactionsChainIds(),
      },
      initState.SmartTransactionsController,
    );

    const isExternalNameSourcesEnabled = () =>
      this.preferencesController.store.getState().useExternalNameSources;

    this.nameController = new NameController({
      messenger: this.controllerMessenger.getRestricted({
        name: 'NameController',
        allowedActions: [],
      }),
      providers: [
        new ENSNameProvider({
          reverseLookup: this.ensController.reverseResolveAddress.bind(
            this.ensController,
          ),
        }),
        new EtherscanNameProvider({ isEnabled: isExternalNameSourcesEnabled }),
        new TokenNameProvider({ isEnabled: isExternalNameSourcesEnabled }),
        new LensNameProvider({ isEnabled: isExternalNameSourcesEnabled }),
        new SnapsNameProvider({
          messenger: this.controllerMessenger.getRestricted({
            name: 'SnapsNameProvider',
            allowedActions: [
              'SnapController:getAll',
              'SnapController:get',
              'SnapController:handleRequest',
              'PermissionController:getState',
            ],
          }),
        }),
      ],
      state: initState.NameController,
    });

    const petnamesBridgeMessenger = this.controllerMessenger.getRestricted({
      name: 'PetnamesBridge',
      allowedEvents: [
        'NameController:stateChange',
        'AccountsController:stateChange',
      ],
      allowedActions: ['AccountsController:listAccounts'],
    });

    new AddressBookPetnamesBridge({
      addressBookController: this.addressBookController,
      nameController: this.nameController,
      messenger: petnamesBridgeMessenger,
    }).init();

    new AccountIdentitiesPetnamesBridge({
      nameController: this.nameController,
      messenger: petnamesBridgeMessenger,
    }).init();

    this.userOperationController = new UserOperationController({
      entrypoint: process.env.EIP_4337_ENTRYPOINT,
      getGasFeeEstimates: this.gasFeeController.fetchGasFeeEstimates.bind(
        this.gasFeeController,
      ),
      messenger: this.controllerMessenger.getRestricted({
        name: 'UserOperationController',
        allowedActions: [
          'ApprovalController:addRequest',
          'NetworkController:getNetworkClientById',
          'KeyringController:prepareUserOperation',
          'KeyringController:patchUserOperation',
          'KeyringController:signUserOperation',
        ],
      }),
      state: initState.UserOperationController,
    });

    this.userOperationController.hub.on(
      'user-operation-added',
      this._onUserOperationAdded.bind(this),
    );

    this.userOperationController.hub.on(
      'transaction-updated',
      this._onUserOperationTransactionUpdated.bind(this),
    );

    // ensure accountTracker updates balances after network change
    networkControllerMessenger.subscribe(
      'NetworkController:networkDidChange',
      () => {
        this.accountTracker.updateAccounts();
      },
    );

    // clear unapproved transactions and messages when the network will change
    networkControllerMessenger.subscribe(
      'NetworkController:networkWillChange',
      clearPendingConfirmations.bind(this),
    );

    this.metamaskMiddleware = createMetamaskMiddleware({
      static: {
        eth_syncing: false,
        web3_clientVersion: `MetaMask/v${version}`,
      },
      version,
      // account mgmt
      getAccounts: async (
        { origin: innerOrigin },
        { suppressUnauthorizedError = true } = {},
      ) => {
        if (innerOrigin === ORIGIN_METAMASK) {
          const selectedAddress =
            this.accountsController.getSelectedAccount().address;
          return selectedAddress ? [selectedAddress] : [];
        } else if (this.isUnlocked()) {
          return await this.getPermittedAccounts(innerOrigin, {
            suppressUnauthorizedError,
          });
        }
        return []; // changing this is a breaking change
      },
      // tx signing
      processTransaction: (transactionParams, dappRequest) =>
        addDappTransaction(
          this.getAddTransactionRequest({ transactionParams, dappRequest }),
        ),
      // msg signing
      ///: BEGIN:ONLY_INCLUDE_IF(build-main,build-beta,build-flask)
      processEthSignMessage: this.signatureController.newUnsignedMessage.bind(
        this.signatureController,
      ),
      processTypedMessage:
        this.signatureController.newUnsignedTypedMessage.bind(
          this.signatureController,
        ),
      processTypedMessageV3:
        this.signatureController.newUnsignedTypedMessage.bind(
          this.signatureController,
        ),
      processTypedMessageV4:
        this.signatureController.newUnsignedTypedMessage.bind(
          this.signatureController,
        ),
      processPersonalMessage:
        this.signatureController.newUnsignedPersonalMessage.bind(
          this.signatureController,
        ),
      ///: END:ONLY_INCLUDE_IF

      ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
      /* eslint-disable no-dupe-keys */
      processEthSignMessage: this.mmiController.newUnsignedMessage.bind(
        this.mmiController,
      ),
      processTypedMessage: this.mmiController.newUnsignedMessage.bind(
        this.mmiController,
      ),
      processTypedMessageV3: this.mmiController.newUnsignedMessage.bind(
        this.mmiController,
      ),
      processTypedMessageV4: this.mmiController.newUnsignedMessage.bind(
        this.mmiController,
      ),
      processPersonalMessage: this.mmiController.newUnsignedMessage.bind(
        this.mmiController,
      ),
      setTypedMessageInProgress:
        this.signatureController.setTypedMessageInProgress.bind(
          this.signatureController,
        ),
      setPersonalMessageInProgress:
        this.signatureController.setPersonalMessageInProgress.bind(
          this.signatureController,
        ),
      /* eslint-enable no-dupe-keys */
      ///: END:ONLY_INCLUDE_IF

      processEncryptionPublicKey:
        this.encryptionPublicKeyController.newRequestEncryptionPublicKey.bind(
          this.encryptionPublicKeyController,
        ),

      processDecryptMessage:
        this.decryptMessageController.newRequestDecryptMessage.bind(
          this.decryptMessageController,
        ),
      getPendingNonce: this.getPendingNonce.bind(this),
      getPendingTransactionByHash: (hash) =>
        this.txController.state.transactions.find(
          (meta) =>
            meta.hash === hash && meta.status === TransactionStatus.submitted,
        ),
    });

    // ensure isClientOpenAndUnlocked is updated when memState updates
    this.on('update', (memState) => this._onStateUpdate(memState));

    /**
     * All controllers in Memstore but not in store. They are not persisted.
     * On chrome profile re-start, they will be re-initialized.
     */
    const resetOnRestartStore = {
      AccountTracker: this.accountTracker.store,
      TokenRatesController: this.tokenRatesController,
      DecryptMessageController: this.decryptMessageController,
      EncryptionPublicKeyController: this.encryptionPublicKeyController,
      SignatureController: this.signatureController,
      SwapsController: this.swapsController.store,
      BridgeController: this.bridgeController.store,
      EnsController: this.ensController,
      ApprovalController: this.approvalController,
      PPOMController: this.ppomController,
    };

    this.store.updateStructure({
      AccountsController: this.accountsController,
      AppStateController: this.appStateController.store,
      AppMetadataController: this.appMetadataController.store,
      MultichainBalancesController: this.multichainBalancesController,
      TransactionController: this.txController,
      KeyringController: this.keyringController,
      PreferencesController: this.preferencesController.store,
      MetaMetricsController: this.metaMetricsController.store,
      AddressBookController: this.addressBookController,
      CurrencyController: this.currencyRateController,
      NetworkController: this.networkController,
      AlertController: this.alertController.store,
      OnboardingController: this.onboardingController.store,
      PermissionController: this.permissionController,
      PermissionLogController: this.permissionLogController,
      SubjectMetadataController: this.subjectMetadataController,
      AnnouncementController: this.announcementController,
      NetworkOrderController: this.networkOrderController,
      AccountOrderController: this.accountOrderController,
      GasFeeController: this.gasFeeController,
      TokenListController: this.tokenListController,
      TokensController: this.tokensController,
      SmartTransactionsController: this.smartTransactionsController,
      NftController: this.nftController,
      PhishingController: this.phishingController,
      SelectedNetworkController: this.selectedNetworkController,
      LoggingController: this.loggingController,
      MultichainRatesController: this.multichainRatesController,
      SnapController: this.snapController,
      CronjobController: this.cronjobController,
      SnapsRegistry: this.snapsRegistry,
      NotificationController: this.notificationController,
      SnapInterfaceController: this.snapInterfaceController,
      ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
      CustodyController: this.custodyController.store,
      InstitutionalFeaturesController:
        this.institutionalFeaturesController.store,
      MmiConfigurationController: this.mmiConfigurationController.store,
      ///: END:ONLY_INCLUDE_IF
      PPOMController: this.ppomController,
      NameController: this.nameController,
      UserOperationController: this.userOperationController,
      // Notification Controllers
      AuthenticationController: this.authenticationController,
      UserStorageController: this.userStorageController,
      MetamaskNotificationsController: this.metamaskNotificationsController,
      PushPlatformNotificationsController:
        this.pushPlatformNotificationsController,
      ...resetOnRestartStore,
    });

    this.memStore = new ComposableObservableStore({
      config: {
        AccountsController: this.accountsController,
        AppStateController: this.appStateController.store,
        AppMetadataController: this.appMetadataController.store,
        MultichainBalancesController: this.multichainBalancesController,
        NetworkController: this.networkController,
        KeyringController: this.keyringController,
        PreferencesController: this.preferencesController.store,
        MetaMetricsController: this.metaMetricsController.store,
        AddressBookController: this.addressBookController,
        CurrencyController: this.currencyRateController,
        AlertController: this.alertController.store,
        OnboardingController: this.onboardingController.store,
        PermissionController: this.permissionController,
        PermissionLogController: this.permissionLogController,
        SubjectMetadataController: this.subjectMetadataController,
        AnnouncementController: this.announcementController,
        NetworkOrderController: this.networkOrderController,
        AccountOrderController: this.accountOrderController,
        GasFeeController: this.gasFeeController,
        TokenListController: this.tokenListController,
        TokensController: this.tokensController,
        SmartTransactionsController: this.smartTransactionsController,
        NftController: this.nftController,
        SelectedNetworkController: this.selectedNetworkController,
        LoggingController: this.loggingController,
        TxController: this.txController,
        MultichainRatesController: this.multichainRatesController,
        SnapController: this.snapController,
        CronjobController: this.cronjobController,
        SnapsRegistry: this.snapsRegistry,
        NotificationController: this.notificationController,
        SnapInterfaceController: this.snapInterfaceController,
        ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
        CustodyController: this.custodyController.store,
        InstitutionalFeaturesController:
          this.institutionalFeaturesController.store,
        MmiConfigurationController: this.mmiConfigurationController.store,
        ///: END:ONLY_INCLUDE_IF
        NameController: this.nameController,
        UserOperationController: this.userOperationController,
        // Notification Controllers
        AuthenticationController: this.authenticationController,
        UserStorageController: this.userStorageController,
        MetamaskNotificationsController: this.metamaskNotificationsController,
        QueuedRequestController: this.queuedRequestController,
        PushPlatformNotificationsController:
          this.pushPlatformNotificationsController,
        ...resetOnRestartStore,
      },
      controllerMessenger: this.controllerMessenger,
    });

    // if this is the first time, clear the state of by calling these methods
    const resetMethods = [
      this.accountTracker.resetState,
      this.decryptMessageController.resetState.bind(
        this.decryptMessageController,
      ),
      this.encryptionPublicKeyController.resetState.bind(
        this.encryptionPublicKeyController,
      ),
      this.signatureController.resetState.bind(this.signatureController),
      this.swapsController.resetState,
      this.ensController.resetState.bind(this.ensController),
      this.approvalController.clear.bind(this.approvalController),
      // WE SHOULD ADD TokenListController.resetState here too. But it's not implemented yet.
    ];

    if (isManifestV3) {
      if (isFirstMetaMaskControllerSetup === true) {
        this.resetStates(resetMethods);
        this.extension.storage.session.set({
          isFirstMetaMaskControllerSetup: false,
        });
      }
    } else {
      // it's always the first time in MV2
      this.resetStates(resetMethods);
    }

    // Automatic login via config password
    const password = process.env.PASSWORD;
    if (
      !this.isUnlocked() &&
      this.onboardingController.store.getState().completedOnboarding &&
      password &&
      !process.env.IN_TEST
    ) {
      this._loginUser(password);
    } else {
      this._startUISync();
    }

    // Lazily update the store with the current extension environment
    this.extension.runtime.getPlatformInfo().then(({ os }) => {
      this.appStateController.setBrowserEnvironment(
        os,
        // This method is presently only supported by Firefox
        this.extension.runtime.getBrowserInfo === undefined
          ? 'chrome'
          : 'firefox',
      );
    });

    this.setupControllerEventSubscriptions();
    this.setupMultichainDataAndSubscriptions();

    // For more information about these legacy streams, see here:
    // https://github.com/MetaMask/metamask-extension/issues/15491
    // TODO:LegacyProvider: Delete
    this.publicConfigStore = this.createPublicConfigStore();

    // Multiple MetaMask instances launched warning
    this.extension.runtime.onMessageExternal.addListener(onMessageReceived);
    // Fire a ping message to check if other extensions are running
    checkForMultipleVersionsRunning();

    if (this.onboardingController.store.getState().completedOnboarding) {
      this.postOnboardingInitialization();
    }
  }

  postOnboardingInitialization() {
    const { usePhishDetect } = this.preferencesController.store.getState();

    this.networkController.lookupNetwork();

    if (usePhishDetect) {
      this.phishingController.maybeUpdateState();
    }
  }

  triggerNetworkrequests() {
    this.accountTracker.start();
    this.txController.startIncomingTransactionPolling();
    this.tokenDetectionController.enable();

    const preferencesControllerState =
      this.preferencesController.store.getState();

    const { useCurrencyRateCheck } = preferencesControllerState;

    if (useCurrencyRateCheck) {
      this.tokenRatesController.start();
    }

    if (this.#isTokenListPollingRequired(preferencesControllerState)) {
      this.tokenListController.start();
    }
  }

  stopNetworkRequests() {
    this.accountTracker.stop();
    this.txController.stopIncomingTransactionPolling();
    this.tokenDetectionController.disable();

    const preferencesControllerState =
      this.preferencesController.store.getState();

    const { useCurrencyRateCheck } = preferencesControllerState;

    if (useCurrencyRateCheck) {
      this.tokenRatesController.stop();
    }

    if (this.#isTokenListPollingRequired(preferencesControllerState)) {
      this.tokenListController.stop();
    }
  }

  resetStates(resetMethods) {
    resetMethods.forEach((resetMethod) => {
      try {
        resetMethod();
      } catch (err) {
        console.error(err);
      }
    });
  }

  ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
  /**
   * Initialize the snap keyring if it is not present.
   *
   * @returns {SnapKeyring}
   */
  async getSnapKeyring() {
    let [snapKeyring] = this.keyringController.getKeyringsByType(
      KeyringType.snap,
    );
    if (!snapKeyring) {
      snapKeyring = await this.keyringController.addNewKeyring(
        KeyringType.snap,
      );
    }
    return snapKeyring;
  }
  ///: END:ONLY_INCLUDE_IF

  trackInsightSnapView(snapId) {
    this.metaMetricsController.trackEvent({
      event: MetaMetricsEventName.InsightSnapViewed,
      category: MetaMetricsEventCategory.Snaps,
      properties: {
        snap_id: snapId,
      },
    });
  }

  /**
   * Get snap metadata from the current state without refreshing the registry database.
   *
   * @param {string} snapId - A snap id.
   * @returns The available metadata for the snap, if any.
   */
  _getSnapMetadata(snapId) {
    return this.snapsRegistry.state.database?.verifiedSnaps?.[snapId]?.metadata;
  }

  /**
   * Tracks snaps export usage.
   * Note: This function is throttled to 1 call per 60 seconds per snap id + handler combination.
   *
   * @param {string} snapId - The ID of the snap the handler is being triggered on.
   * @param {string} handler - The handler to trigger on the snap for the request.
   * @param {boolean} success - Whether the invocation was successful or not.
   * @param {string} origin - The origin of the request.
   */
  _trackSnapExportUsage = wrap(
    memoize(
      () =>
        throttle(
          (snapId, handler, success, origin) =>
            this.metaMetricsController.trackEvent({
              event: MetaMetricsEventName.SnapExportUsed,
              category: MetaMetricsEventCategory.Snaps,
              properties: {
                snap_id: snapId,
                export: handler,
                snap_category: this._getSnapMetadata(snapId)?.category,
                success,
                origin,
              },
            }),
          SECOND * 60,
        ),
      (snapId, handler, _, origin) => `${snapId}${handler}${origin}`,
    ),
    (getFunc, ...args) => getFunc(...args)(...args),
  );

  /**
   * Passes a JSON-RPC request object to the SnapController for execution.
   *
   * @param {object} args - A bag of options.
   * @param {string} args.snapId - The ID of the recipient snap.
   * @param {string} args.origin - The origin of the RPC request.
   * @param {string} args.handler - The handler to trigger on the snap for the request.
   * @param {object} args.request - The JSON-RPC request object.
   * @returns The result of the JSON-RPC request.
   */
  async handleSnapRequest(args) {
    try {
      const response = await this.controllerMessenger.call(
        'SnapController:handleRequest',
        args,
      );
      this._trackSnapExportUsage(args.snapId, args.handler, true, args.origin);
      return response;
    } catch (error) {
      this._trackSnapExportUsage(args.snapId, args.handler, false, args.origin);
      throw error;
    }
  }

  /**
   * Gets the currently selected locale from the PreferencesController.
   *
   * @returns The currently selected locale.
   */
  getLocale() {
    const { currentLocale } = this.preferencesController.store.getState();

    return currentLocale;
  }

  /**
   * Constructor helper for getting Snap permission specifications.
   */
  getSnapPermissionSpecifications() {
    return {
      ...buildSnapEndowmentSpecifications(Object.keys(ExcludedSnapEndowments)),
      ...buildSnapRestrictedMethodSpecifications(
        Object.keys(ExcludedSnapPermissions),
        {
          getLocale: this.getLocale.bind(this),
          clearSnapState: this.controllerMessenger.call.bind(
            this.controllerMessenger,
            'SnapController:clearSnapState',
          ),
          getMnemonic: this.getPrimaryKeyringMnemonic.bind(this),
          getUnlockPromise: this.appStateController.getUnlockPromise.bind(
            this.appStateController,
          ),
          getSnap: this.controllerMessenger.call.bind(
            this.controllerMessenger,
            'SnapController:get',
          ),
          handleSnapRpcRequest: this.handleSnapRequest.bind(this),
          getSnapState: this.controllerMessenger.call.bind(
            this.controllerMessenger,
            'SnapController:getSnapState',
          ),
          showDialog: (origin, type, id, placeholder) =>
            this.approvalController.addAndShowApprovalRequest({
              origin,
              type: SNAP_DIALOG_TYPES[type],
              requestData: { id, placeholder },
            }),
          showNativeNotification: (origin, args) =>
            this.controllerMessenger.call(
              'RateLimitController:call',
              origin,
              'showNativeNotification',
              origin,
              args.message,
            ),
          showInAppNotification: (origin, args) =>
            this.controllerMessenger.call(
              'RateLimitController:call',
              origin,
              'showInAppNotification',
              origin,
              args.message,
            ),
          updateSnapState: this.controllerMessenger.call.bind(
            this.controllerMessenger,
            'SnapController:updateSnapState',
          ),
          maybeUpdatePhishingList: () => {
            const { usePhishDetect } =
              this.preferencesController.store.getState();

            if (!usePhishDetect) {
              return;
            }

            this.controllerMessenger.call(
              'PhishingController:maybeUpdateState',
            );
          },
          isOnPhishingList: (origin) => {
            const { usePhishDetect } =
              this.preferencesController.store.getState();

            if (!usePhishDetect) {
              return false;
            }

            return this.controllerMessenger.call(
              'PhishingController:testOrigin',
              origin,
            ).result;
          },
          createInterface: this.controllerMessenger.call.bind(
            this.controllerMessenger,
            'SnapInterfaceController:createInterface',
          ),
          getInterface: this.controllerMessenger.call.bind(
            this.controllerMessenger,
            'SnapInterfaceController:getInterface',
          ),
          ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
          getSnapKeyring: this.getSnapKeyring.bind(this),
          ///: END:ONLY_INCLUDE_IF
        },
      ),
    };
  }

  /**
   * Deletes the specified notifications from state.
   *
   * @param {string[]} ids - The notifications ids to delete.
   */
  dismissNotifications(ids) {
    this.notificationController.dismiss(ids);
  }

  /**
   * Updates the readDate attribute of the specified notifications.
   *
   * @param {string[]} ids - The notifications ids to mark as read.
   */
  markNotificationsAsRead(ids) {
    this.notificationController.markRead(ids);
  }

  /**
   * Sets up BaseController V2 event subscriptions. Currently, this includes
   * the subscriptions necessary to notify permission subjects of account
   * changes.
   *
   * Some of the subscriptions in this method are ControllerMessenger selector
   * event subscriptions. See the relevant documentation for
   * `@metamask/base-controller` for more information.
   *
   * Note that account-related notifications emitted when the extension
   * becomes unlocked are handled in MetaMaskController._onUnlock.
   */
  setupControllerEventSubscriptions() {
    let lastSelectedAddress;

    this.preferencesController.store.subscribe(
      previousValueComparator((prevState, currState) => {
        this.#onPreferencesControllerStateChange(currState, prevState);
      }, this.preferencesController.store.getState()),
    );

    this.controllerMessenger.subscribe(
      `${this.accountsController.name}:selectedAccountChange`,
      async (account) => {
        if (account.address && account.address !== lastSelectedAddress) {
          lastSelectedAddress = account.address;
          await this._onAccountChange(account.address);
        }
      },
    );

    // This handles account changes every time relevant permission state
    // changes, for any reason.
    this.controllerMessenger.subscribe(
      `${this.permissionController.name}:stateChange`,
      async (currentValue, previousValue) => {
        const changedAccounts = getChangedAccounts(currentValue, previousValue);

        for (const [origin, accounts] of changedAccounts.entries()) {
          this._notifyAccountsChange(origin, accounts);
        }
      },
      getPermittedAccountsByOrigin,
    );

    this.controllerMessenger.subscribe(
      'NetworkController:networkDidChange',
      async () => {
        await this.txController.updateIncomingTransactions();
      },
    );

    this.controllerMessenger.subscribe(
      `${this.snapController.name}:snapInstallStarted`,
      (snapId, origin, isUpdate) => {
        const snapCategory = this._getSnapMetadata(snapId)?.category;
        this.metaMetricsController.trackEvent({
          event: isUpdate
            ? MetaMetricsEventName.SnapUpdateStarted
            : MetaMetricsEventName.SnapInstallStarted,
          category: MetaMetricsEventCategory.Snaps,
          properties: {
            snap_id: snapId,
            origin,
            snap_category: snapCategory,
          },
        });
      },
    );

    this.controllerMessenger.subscribe(
      `${this.snapController.name}:snapInstallFailed`,
      (snapId, origin, isUpdate, error) => {
        const isRejected = error.includes('User rejected the request.');
        const failedEvent = isUpdate
          ? MetaMetricsEventName.SnapUpdateFailed
          : MetaMetricsEventName.SnapInstallFailed;
        const rejectedEvent = isUpdate
          ? MetaMetricsEventName.SnapUpdateRejected
          : MetaMetricsEventName.SnapInstallRejected;

        const snapCategory = this._getSnapMetadata(snapId)?.category;
        this.metaMetricsController.trackEvent({
          event: isRejected ? rejectedEvent : failedEvent,
          category: MetaMetricsEventCategory.Snaps,
          properties: {
            snap_id: snapId,
            origin,
            snap_category: snapCategory,
          },
        });
      },
    );

    this.controllerMessenger.subscribe(
      `${this.snapController.name}:snapInstalled`,
      (truncatedSnap, origin) => {
        const snapId = truncatedSnap.id;
        const snapCategory = this._getSnapMetadata(snapId)?.category;
        this.metaMetricsController.trackEvent({
          event: MetaMetricsEventName.SnapInstalled,
          category: MetaMetricsEventCategory.Snaps,
          properties: {
            snap_id: snapId,
            version: truncatedSnap.version,
            origin,
            snap_category: snapCategory,
          },
        });
      },
    );

    this.controllerMessenger.subscribe(
      `${this.snapController.name}:snapUpdated`,
      (newSnap, oldVersion, origin) => {
        const snapId = newSnap.id;
        const snapCategory = this._getSnapMetadata(snapId)?.category;
        this.metaMetricsController.trackEvent({
          event: MetaMetricsEventName.SnapUpdated,
          category: MetaMetricsEventCategory.Snaps,
          properties: {
            snap_id: snapId,
            old_version: oldVersion,
            new_version: newSnap.version,
            origin,
            snap_category: snapCategory,
          },
        });
      },
    );

    this.controllerMessenger.subscribe(
      `${this.snapController.name}:snapTerminated`,
      (truncatedSnap) => {
        const approvals = Object.values(
          this.approvalController.state.pendingApprovals,
        ).filter(
          (approval) =>
            approval.origin === truncatedSnap.id &&
            approval.type.startsWith(RestrictedMethods.snap_dialog),
        );
        for (const approval of approvals) {
          this.approvalController.reject(
            approval.id,
            new Error('Snap was terminated.'),
          );
        }
      },
    );

    this.controllerMessenger.subscribe(
      `${this.snapController.name}:snapUninstalled`,
      (truncatedSnap) => {
        const notificationIds = Object.values(
          this.notificationController.state.notifications,
        ).reduce((idList, notification) => {
          if (notification.origin === truncatedSnap.id) {
            idList.push(notification.id);
          }
          return idList;
        }, []);

        this.dismissNotifications(notificationIds);

        const snapId = truncatedSnap.id;
        const snapCategory = this._getSnapMetadata(snapId)?.category;
        this.metaMetricsController.trackEvent({
          event: MetaMetricsEventName.SnapUninstalled,
          category: MetaMetricsEventCategory.Snaps,
          properties: {
            snap_id: snapId,
            version: truncatedSnap.version,
            snap_category: snapCategory,
          },
        });
      },
    );
  }

  /**
   * Sets up multichain data and subscriptions.
   * This method is called during the MetaMaskController constructor.
   * It starts the MultichainRatesController if selected account is non-EVM
   * and subscribes to account changes.
   */
  setupMultichainDataAndSubscriptions() {
    if (
      !isEvmAccountType(
        this.accountsController.getSelectedMultichainAccount().type,
      )
    ) {
      this.multichainRatesController.start();
    }

    this.controllerMessenger.subscribe(
      'AccountsController:selectedAccountChange',
      (selectedAccount) => {
        if (isEvmAccountType(selectedAccount.type)) {
          this.multichainRatesController.stop();
          return;
        }
        this.multichainRatesController.start();
      },
    );
    this.multichainBalancesController.start();
    this.multichainBalancesController.updateBalances();
  }

  /**
   * TODO:LegacyProvider: Delete
   * Constructor helper: initialize a public config store.
   * This store is used to make some config info available to Dapps synchronously.
   */
  createPublicConfigStore() {
    // subset of state for metamask inpage provider
    const publicConfigStore = new ObservableStore();

    const selectPublicState = async ({ isUnlocked }) => {
      const { chainId, networkVersion } = await this.getProviderNetworkState();

      return {
        isUnlocked,
        chainId,
        networkVersion: networkVersion ?? 'loading',
      };
    };

    const updatePublicConfigStore = async (memState) => {
      const networkStatus =
        memState.networksMetadata[memState.selectedNetworkClientId]?.status;
      if (networkStatus === NetworkStatus.Available) {
        publicConfigStore.putState(await selectPublicState(memState));
      }
    };

    // setup memStore subscription hooks
    this.on('update', updatePublicConfigStore);
    updatePublicConfigStore(this.getState());

    return publicConfigStore;
  }

  /**
   * Gets relevant state for the provider of an external origin.
   *
   * @param {string} origin - The origin to get the provider state for.
   * @returns {Promise<{ isUnlocked: boolean, networkVersion: string, chainId: string, accounts: string[] }>} An object with relevant state properties.
   */
  async getProviderState(origin) {
    const providerNetworkState = await this.getProviderNetworkState(
      this.preferencesController.getUseRequestQueue() ? origin : undefined,
    );

    return {
      isUnlocked: this.isUnlocked(),
      accounts: await this.getPermittedAccounts(origin),
      ...providerNetworkState,
    };
  }

  /**
   * Retrieves network state information relevant for external providers.
   *
   * @param {string} origin - The origin identifier for which network state is requested (default: 'metamask').
   * @returns {object} An object containing important network state properties, including chainId and networkVersion.
   */
  async getProviderNetworkState(origin = METAMASK_DOMAIN) {
    const networkClientId = this.controllerMessenger.call(
      'SelectedNetworkController:getNetworkClientIdForDomain',
      origin,
    );

    const networkClient = this.controllerMessenger.call(
      'NetworkController:getNetworkClientById',
      networkClientId,
    );

    const { chainId } = networkClient.configuration;

    const { completedOnboarding } = this.onboardingController.store.getState();

    let networkVersion = this.deprecatedNetworkVersions[networkClientId];
    if (!networkVersion && completedOnboarding) {
      const ethQuery = new EthQuery(networkClient.provider);
      networkVersion = await new Promise((resolve) => {
        ethQuery.sendAsync({ method: 'net_version' }, (error, result) => {
          if (error) {
            console.error(error);
            resolve(null);
          } else {
            resolve(convertNetworkId(result));
          }
        });
      });
      this.deprecatedNetworkVersions[networkClientId] = networkVersion;
    }

    return {
      chainId,
      networkVersion: networkVersion ?? 'loading',
    };
  }

  //=============================================================================
  // EXPOSED TO THE UI SUBSYSTEM
  //=============================================================================

  /**
   * The metamask-state of the various controllers, made available to the UI
   *
   * @returns {object} status
   */
  getState() {
    const { vault } = this.keyringController.state;
    const isInitialized = Boolean(vault);

    const flatState = this.memStore.getFlatState();

    // The vault should not be exposed to the UI
    delete flatState.vault;

    return {
      isInitialized,
      ...flatState,
      // Snap state, source code and other files are stripped out to prevent piping to the MetaMask UI.
      snapStates: {},
      unencryptedSnapStates: {},
      snaps: Object.values(flatState.snaps ?? {}).reduce((acc, snap) => {
        // eslint-disable-next-line no-unused-vars
        const { sourceCode, auxiliaryFiles, ...rest } = snap;
        acc[snap.id] = rest;
        return acc;
      }, {}),
    };
  }

  /**
   * Returns an Object containing API Callback Functions.
   * These functions are the interface for the UI.
   * The API object can be transmitted over a stream via JSON-RPC.
   *
   * @returns {object} Object containing API functions.
   */
  getApi() {
    const {
      accountsController,
      addressBookController,
      alertController,
      appStateController,
      keyringController,
      nftController,
      nftDetectionController,
      currencyRateController,
      tokenDetectionController,
      ensController,
      gasFeeController,
      metaMetricsController,
      networkController,
      announcementController,
      onboardingController,
      appMetadataController,
      permissionController,
      preferencesController,
      bridgeController,
      swapsController,
      tokensController,
      smartTransactionsController,
      txController,
      assetsContractController,
      backup,
      approvalController,
      phishingController,
      // Notification Controllers
      authenticationController,
      userStorageController,
      metamaskNotificationsController,
      pushPlatformNotificationsController,
    } = this;

    return {
      // etc
      getState: this.getState.bind(this),
      setCurrentCurrency: currencyRateController.setCurrentCurrency.bind(
        currencyRateController,
      ),
      setUseBlockie: preferencesController.setUseBlockie.bind(
        preferencesController,
      ),
      setUseNonceField: preferencesController.setUseNonceField.bind(
        preferencesController,
      ),
      setUsePhishDetect: preferencesController.setUsePhishDetect.bind(
        preferencesController,
      ),
      setUseMultiAccountBalanceChecker:
        preferencesController.setUseMultiAccountBalanceChecker.bind(
          preferencesController,
        ),
      dismissOpenSeaToBlockaidBanner:
        preferencesController.dismissOpenSeaToBlockaidBanner.bind(
          preferencesController,
        ),
      setUseSafeChainsListValidation:
        preferencesController.setUseSafeChainsListValidation.bind(
          preferencesController,
        ),
      setUseTokenDetection: preferencesController.setUseTokenDetection.bind(
        preferencesController,
      ),
      setUseNftDetection: preferencesController.setUseNftDetection.bind(
        preferencesController,
      ),
      setUse4ByteResolution: preferencesController.setUse4ByteResolution.bind(
        preferencesController,
      ),
      setUseCurrencyRateCheck:
        preferencesController.setUseCurrencyRateCheck.bind(
          preferencesController,
        ),
      setOpenSeaEnabled: preferencesController.setOpenSeaEnabled.bind(
        preferencesController,
      ),
      getUseRequestQueue: this.preferencesController.getUseRequestQueue.bind(
        this.preferencesController,
      ),
      getProviderConfig: () => this.networkController.state.providerConfig,
      setSecurityAlertsEnabled:
        preferencesController.setSecurityAlertsEnabled.bind(
          preferencesController,
        ),
      ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
      setAddSnapAccountEnabled:
        preferencesController.setAddSnapAccountEnabled.bind(
          preferencesController,
        ),
      ///: END:ONLY_INCLUDE_IF
      setUseExternalNameSources:
        preferencesController.setUseExternalNameSources.bind(
          preferencesController,
        ),
      setUseTransactionSimulations:
        preferencesController.setUseTransactionSimulations.bind(
          preferencesController,
        ),
      setUseRequestQueue: this.setUseRequestQueue.bind(this),
      setIpfsGateway: preferencesController.setIpfsGateway.bind(
        preferencesController,
      ),
      setIsIpfsGatewayEnabled:
        preferencesController.setIsIpfsGatewayEnabled.bind(
          preferencesController,
        ),
      setUseAddressBarEnsResolution:
        preferencesController.setUseAddressBarEnsResolution.bind(
          preferencesController,
        ),
      setParticipateInMetaMetrics:
        metaMetricsController.setParticipateInMetaMetrics.bind(
          metaMetricsController,
        ),
      setDataCollectionForMarketing:
        metaMetricsController.setDataCollectionForMarketing.bind(
          metaMetricsController,
        ),
      setCurrentLocale: preferencesController.setCurrentLocale.bind(
        preferencesController,
      ),
      setIncomingTransactionsPreferences:
        preferencesController.setIncomingTransactionsPreferences.bind(
          preferencesController,
        ),
      setServiceWorkerKeepAlivePreference:
        preferencesController.setServiceWorkerKeepAlivePreference.bind(
          preferencesController,
        ),
      markPasswordForgotten: this.markPasswordForgotten.bind(this),
      unMarkPasswordForgotten: this.unMarkPasswordForgotten.bind(this),
      getRequestAccountTabIds: this.getRequestAccountTabIds,
      getOpenMetamaskTabsIds: this.getOpenMetamaskTabsIds,
      markNotificationPopupAsAutomaticallyClosed: () =>
        this.notificationManager.markAsAutomaticallyClosed(),

      // approval
      requestUserApproval:
        approvalController.addAndShowApprovalRequest.bind(approvalController),

      // primary keyring management
      addNewAccount: this.addNewAccount.bind(this),
      getSeedPhrase: this.getSeedPhrase.bind(this),
      resetAccount: this.resetAccount.bind(this),
      removeAccount: this.removeAccount.bind(this),
      importAccountWithStrategy: this.importAccountWithStrategy.bind(this),
      getNextAvailableAccountName:
        accountsController.getNextAvailableAccountName.bind(accountsController),
      ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
      getAccountsBySnapId: (snapId) => getAccountsBySnapId(this, snapId),
      ///: END:ONLY_INCLUDE_IF

      // hardware wallets
      connectHardware: this.connectHardware.bind(this),
      forgetDevice: this.forgetDevice.bind(this),
      checkHardwareStatus: this.checkHardwareStatus.bind(this),
      unlockHardwareWalletAccount: this.unlockHardwareWalletAccount.bind(this),
      attemptLedgerTransportCreation:
        this.attemptLedgerTransportCreation.bind(this),

      // qr hardware devices
      submitQRHardwareCryptoHDKey:
        keyringController.submitQRCryptoHDKey.bind(keyringController),
      submitQRHardwareCryptoAccount:
        keyringController.submitQRCryptoAccount.bind(keyringController),
      cancelSyncQRHardware:
        keyringController.cancelQRSynchronization.bind(keyringController),
      submitQRHardwareSignature:
        keyringController.submitQRSignature.bind(keyringController),
      cancelQRHardwareSignRequest:
        keyringController.cancelQRSignRequest.bind(keyringController),

      // vault management
      submitPassword: this.submitPassword.bind(this),
      verifyPassword: this.verifyPassword.bind(this),

      // network management
      setProviderType: (type) => {
        return this.networkController.setProviderType(type);
      },
      setActiveNetwork: (networkConfigurationId) => {
        return this.networkController.setActiveNetwork(networkConfigurationId);
      },
      setNetworkClientIdForDomain: (origin, networkClientId) => {
        return this.selectedNetworkController.setNetworkClientIdForDomain(
          origin,
          networkClientId,
        );
      },
      rollbackToPreviousProvider:
        networkController.rollbackToPreviousProvider.bind(networkController),
      removeNetworkConfiguration: this.removeNetworkConfiguration.bind(this),
      upsertNetworkConfiguration:
        this.networkController.upsertNetworkConfiguration.bind(
          this.networkController,
        ),
      getCurrentNetworkEIP1559Compatibility:
        this.networkController.getEIP1559Compatibility.bind(
          this.networkController,
        ),
      getNetworkConfigurationByNetworkClientId:
        this.networkController.getNetworkConfigurationByNetworkClientId.bind(
          this.networkController,
        ),
      // PreferencesController
      setSelectedAddress: (address) => {
        const account = this.accountsController.getAccountByAddress(address);
        if (account) {
          this.accountsController.setSelectedAccount(account.id);
        } else {
          throw new Error(`No account found for address: ${address}`);
        }
      },
      toggleExternalServices: this.toggleExternalServices.bind(this),
      addToken: tokensController.addToken.bind(tokensController),
      updateTokenType: tokensController.updateTokenType.bind(tokensController),
      setFeatureFlag: preferencesController.setFeatureFlag.bind(
        preferencesController,
      ),
      setPreference: preferencesController.setPreference.bind(
        preferencesController,
      ),

      addKnownMethodData: preferencesController.addKnownMethodData.bind(
        preferencesController,
      ),
      setDismissSeedBackUpReminder:
        preferencesController.setDismissSeedBackUpReminder.bind(
          preferencesController,
        ),
      setDisabledRpcMethodPreference:
        preferencesController.setDisabledRpcMethodPreference.bind(
          preferencesController,
        ),
      getRpcMethodPreferences:
        preferencesController.getRpcMethodPreferences.bind(
          preferencesController,
        ),
      setAdvancedGasFee: preferencesController.setAdvancedGasFee.bind(
        preferencesController,
      ),
      setTheme: preferencesController.setTheme.bind(preferencesController),
      ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
      setSnapsAddSnapAccountModalDismissed:
        preferencesController.setSnapsAddSnapAccountModalDismissed.bind(
          preferencesController,
        ),
      ///: END:ONLY_INCLUDE_IF

      // AccountsController
      setSelectedInternalAccount: (id) => {
        const account = this.accountsController.getAccount(id);
        if (account) {
          this.accountsController.setSelectedAccount(id);
        }
      },

      setAccountName:
        accountsController.setAccountName.bind(accountsController),

      setAccountLabel: (address, label) => {
        this.preferencesController.setAccountLabel(address, label);
        const account = this.accountsController.getAccountByAddress(address);
        if (account === undefined) {
          throw new Error(`No account found for address: ${address}`);
        }
        this.accountsController.setAccountName(account.id, label);
      },

      // AssetsContractController
      getTokenStandardAndDetails: this.getTokenStandardAndDetails.bind(this),
      getTokenSymbol: this.getTokenSymbol.bind(this),

      // NftController
      addNft: nftController.addNft.bind(nftController),

      addNftVerifyOwnership:
        nftController.addNftVerifyOwnership.bind(nftController),

      removeAndIgnoreNft: nftController.removeAndIgnoreNft.bind(nftController),

      removeNft: nftController.removeNft.bind(nftController),

      checkAndUpdateAllNftsOwnershipStatus:
        nftController.checkAndUpdateAllNftsOwnershipStatus.bind(nftController),

      checkAndUpdateSingleNftOwnershipStatus:
        nftController.checkAndUpdateSingleNftOwnershipStatus.bind(
          nftController,
        ),

      isNftOwner: nftController.isNftOwner.bind(nftController),

      // AddressController
      setAddressBook: addressBookController.set.bind(addressBookController),
      removeFromAddressBook: addressBookController.delete.bind(
        addressBookController,
      ),

      // AppStateController
      setLastActiveTime:
        appStateController.setLastActiveTime.bind(appStateController),
      setCurrentExtensionPopupId:
        appStateController.setCurrentExtensionPopupId.bind(appStateController),
      setDefaultHomeActiveTabName:
        appStateController.setDefaultHomeActiveTabName.bind(appStateController),
      setConnectedStatusPopoverHasBeenShown:
        appStateController.setConnectedStatusPopoverHasBeenShown.bind(
          appStateController,
        ),
      setRecoveryPhraseReminderHasBeenShown:
        appStateController.setRecoveryPhraseReminderHasBeenShown.bind(
          appStateController,
        ),
      setRecoveryPhraseReminderLastShown:
        appStateController.setRecoveryPhraseReminderLastShown.bind(
          appStateController,
        ),
      setTermsOfUseLastAgreed:
        appStateController.setTermsOfUseLastAgreed.bind(appStateController),
      setSurveyLinkLastClickedOrClosed:
        appStateController.setSurveyLinkLastClickedOrClosed.bind(
          appStateController,
        ),
      setOnboardingDate:
        appStateController.setOnboardingDate.bind(appStateController),
      setNewPrivacyPolicyToastClickedOrClosed:
        appStateController.setNewPrivacyPolicyToastClickedOrClosed.bind(
          appStateController,
        ),
      setNewPrivacyPolicyToastShownDate:
        appStateController.setNewPrivacyPolicyToastShownDate.bind(
          appStateController,
        ),
      setSnapsInstallPrivacyWarningShownStatus:
        appStateController.setSnapsInstallPrivacyWarningShownStatus.bind(
          appStateController,
        ),
      setOutdatedBrowserWarningLastShown:
        appStateController.setOutdatedBrowserWarningLastShown.bind(
          appStateController,
        ),
      setShowTestnetMessageInDropdown:
        appStateController.setShowTestnetMessageInDropdown.bind(
          appStateController,
        ),
      setShowBetaHeader:
        appStateController.setShowBetaHeader.bind(appStateController),
      setShowPermissionsTour:
        appStateController.setShowPermissionsTour.bind(appStateController),
      setShowAccountBanner:
        appStateController.setShowAccountBanner.bind(appStateController),
      setShowNetworkBanner:
        appStateController.setShowNetworkBanner.bind(appStateController),
      updateNftDropDownState:
        appStateController.updateNftDropDownState.bind(appStateController),
      setFirstTimeUsedNetwork:
        appStateController.setFirstTimeUsedNetwork.bind(appStateController),
      setSwitchedNetworkDetails:
        appStateController.setSwitchedNetworkDetails.bind(appStateController),
      clearSwitchedNetworkDetails:
        appStateController.clearSwitchedNetworkDetails.bind(appStateController),
      setSwitchedNetworkNeverShowMessage:
        appStateController.setSwitchedNetworkNeverShowMessage.bind(
          appStateController,
        ),

      // EnsController
      tryReverseResolveAddress:
        ensController.reverseResolveAddress.bind(ensController),

      // KeyringController
      setLocked: this.setLocked.bind(this),
      createNewVaultAndKeychain: this.createNewVaultAndKeychain.bind(this),
      createNewVaultAndRestore: this.createNewVaultAndRestore.bind(this),
      exportAccount: this.exportAccount.bind(this),

      // txController
      updateTransaction: txController.updateTransaction.bind(txController),
      approveTransactionsWithSameNonce:
        txController.approveTransactionsWithSameNonce.bind(txController),
      createCancelTransaction: this.createCancelTransaction.bind(this),
      createSpeedUpTransaction: this.createSpeedUpTransaction.bind(this),
      estimateGas: this.estimateGas.bind(this),
      getNextNonce: this.getNextNonce.bind(this),
      addTransaction: (transactionParams, transactionOptions) =>
        addTransaction(
          this.getAddTransactionRequest({
            transactionParams,
            transactionOptions,
            waitForSubmit: false,
          }),
        ),
      addTransactionAndWaitForPublish: (
        transactionParams,
        transactionOptions,
      ) =>
        addTransaction(
          this.getAddTransactionRequest({
            transactionParams,
            transactionOptions,
            waitForSubmit: true,
          }),
        ),
      createTransactionEventFragment:
        createTransactionEventFragmentWithTxId.bind(
          null,
          this.getTransactionMetricsRequest(),
        ),
      getTransactions: this.txController.getTransactions.bind(
        this.txController,
      ),
      updateEditableParams: this.txController.updateEditableParams.bind(
        this.txController,
      ),
      updateTransactionGasFees:
        txController.updateTransactionGasFees.bind(txController),
      updateTransactionSendFlowHistory:
        txController.updateTransactionSendFlowHistory.bind(txController),
      updatePreviousGasParams:
        txController.updatePreviousGasParams.bind(txController),
      abortTransactionSigning:
        txController.abortTransactionSigning.bind(txController),
      getLayer1GasFee: txController.getLayer1GasFee.bind(txController),

      // decryptMessageController
      decryptMessage: this.decryptMessageController.decryptMessage.bind(
        this.decryptMessageController,
      ),
      decryptMessageInline:
        this.decryptMessageController.decryptMessageInline.bind(
          this.decryptMessageController,
        ),
      cancelDecryptMessage:
        this.decryptMessageController.cancelDecryptMessage.bind(
          this.decryptMessageController,
        ),

      // EncryptionPublicKeyController
      encryptionPublicKey:
        this.encryptionPublicKeyController.encryptionPublicKey.bind(
          this.encryptionPublicKeyController,
        ),
      cancelEncryptionPublicKey:
        this.encryptionPublicKeyController.cancelEncryptionPublicKey.bind(
          this.encryptionPublicKeyController,
        ),

      // AppMetadataController
      setShowTokenAutodetectModalOnUpgrade:
        appMetadataController.setShowTokenAutodetectModalOnUpgrade.bind(
          appMetadataController,
        ),

      // onboarding controller
      setSeedPhraseBackedUp:
        onboardingController.setSeedPhraseBackedUp.bind(onboardingController),
      completeOnboarding:
        onboardingController.completeOnboarding.bind(onboardingController),
      setFirstTimeFlowType:
        onboardingController.setFirstTimeFlowType.bind(onboardingController),

      // alert controller
      setAlertEnabledness:
        alertController.setAlertEnabledness.bind(alertController),
      setUnconnectedAccountAlertShown:
        alertController.setUnconnectedAccountAlertShown.bind(alertController),
      setWeb3ShimUsageAlertDismissed:
        alertController.setWeb3ShimUsageAlertDismissed.bind(alertController),

      // permissions
      removePermissionsFor: this.removePermissionsFor,
      approvePermissionsRequest: this.acceptPermissionsRequest,
      rejectPermissionsRequest: this.rejectPermissionsRequest,
      ...getPermissionBackgroundApiMethods(permissionController),

      ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
      connectCustodyAddresses: this.mmiController.connectCustodyAddresses.bind(
        this.mmiController,
      ),
      getCustodianAccounts: this.mmiController.getCustodianAccounts.bind(
        this.mmiController,
      ),
      getCustodianAccountsByAddress:
        this.mmiController.getCustodianAccountsByAddress.bind(
          this.mmiController,
        ),
      getCustodianTransactionDeepLink:
        this.mmiController.getCustodianTransactionDeepLink.bind(
          this.mmiController,
        ),
      getCustodianConfirmDeepLink:
        this.mmiController.getCustodianConfirmDeepLink.bind(this.mmiController),
      getCustodianSignMessageDeepLink:
        this.mmiController.getCustodianSignMessageDeepLink.bind(
          this.mmiController,
        ),
      getCustodianToken: this.mmiController.getCustodianToken.bind(
        this.mmiController,
      ),
      getCustodianJWTList: this.mmiController.getCustodianJWTList.bind(
        this.mmiController,
      ),
      getAllCustodianAccountsWithToken:
        this.mmiController.getAllCustodianAccountsWithToken.bind(
          this.mmiController,
        ),
      setCustodianNewRefreshToken:
        this.mmiController.setCustodianNewRefreshToken.bind(this.mmiController),
      setWaitForConfirmDeepLinkDialog:
        this.custodyController.setWaitForConfirmDeepLinkDialog.bind(
          this.custodyController,
        ),
      getMmiConfiguration:
        this.mmiConfigurationController.getConfiguration.bind(
          this.mmiConfigurationController,
        ),
      removeAddTokenConnectRequest:
        this.institutionalFeaturesController.removeAddTokenConnectRequest.bind(
          this.institutionalFeaturesController,
        ),
      setConnectionRequest:
        this.institutionalFeaturesController.setConnectionRequest.bind(
          this.institutionalFeaturesController,
        ),
      showInteractiveReplacementTokenBanner:
        appStateController.showInteractiveReplacementTokenBanner.bind(
          appStateController,
        ),
      setCustodianDeepLink:
        appStateController.setCustodianDeepLink.bind(appStateController),
      ///: END:ONLY_INCLUDE_IF

      // snaps
      disableSnap: this.controllerMessenger.call.bind(
        this.controllerMessenger,
        'SnapController:disable',
      ),
      enableSnap: this.controllerMessenger.call.bind(
        this.controllerMessenger,
        'SnapController:enable',
      ),
      updateSnap: (origin, requestedSnaps) => {
        // We deliberately do not await this promise as that would mean waiting for the update to complete
        // Instead we return null to signal to the UI that it is safe to redirect to the update flow
        this.controllerMessenger.call(
          'SnapController:install',
          origin,
          requestedSnaps,
        );
        return null;
      },
      removeSnap: this.controllerMessenger.call.bind(
        this.controllerMessenger,
        'SnapController:remove',
      ),
      handleSnapRequest: this.handleSnapRequest.bind(this),
      revokeDynamicSnapPermissions: this.controllerMessenger.call.bind(
        this.controllerMessenger,
        'SnapController:revokeDynamicPermissions',
      ),
      dismissNotifications: this.dismissNotifications.bind(this),
      markNotificationsAsRead: this.markNotificationsAsRead.bind(this),
      disconnectOriginFromSnap: this.controllerMessenger.call.bind(
        this.controllerMessenger,
        'SnapController:disconnectOrigin',
      ),
      updateNetworksList: this.updateNetworksList.bind(this),
      updateAccountsList: this.updateAccountsList.bind(this),
      updateHiddenAccountsList: this.updateHiddenAccountsList.bind(this),
      getPhishingResult: async (website) => {
        await phishingController.maybeUpdateState();

        return phishingController.test(website);
      },
      deleteInterface: this.controllerMessenger.call.bind(
        this.controllerMessenger,
        'SnapInterfaceController:deleteInterface',
      ),
      updateInterfaceState: this.controllerMessenger.call.bind(
        this.controllerMessenger,
        'SnapInterfaceController:updateInterfaceState',
      ),

      // swaps
      fetchAndSetQuotes:
        swapsController.fetchAndSetQuotes.bind(swapsController),
      setSelectedQuoteAggId:
        swapsController.setSelectedQuoteAggId.bind(swapsController),
      resetSwapsState: swapsController.resetSwapsState.bind(swapsController),
      setSwapsTokens: swapsController.setSwapsTokens.bind(swapsController),
      clearSwapsQuotes: swapsController.clearSwapsQuotes.bind(swapsController),
      setApproveTxId: swapsController.setApproveTxId.bind(swapsController),
      setTradeTxId: swapsController.setTradeTxId.bind(swapsController),
      setSwapsTxGasPrice:
        swapsController.setSwapsTxGasPrice.bind(swapsController),
      setSwapsTxGasLimit:
        swapsController.setSwapsTxGasLimit.bind(swapsController),
      setSwapsTxMaxFeePerGas:
        swapsController.setSwapsTxMaxFeePerGas.bind(swapsController),
      setSwapsTxMaxFeePriorityPerGas:
        swapsController.setSwapsTxMaxFeePriorityPerGas.bind(swapsController),
      safeRefetchQuotes:
        swapsController.safeRefetchQuotes.bind(swapsController),
      stopPollingForQuotes:
        swapsController.stopPollingForQuotes.bind(swapsController),
      setBackgroundSwapRouteState:
        swapsController.setBackgroundSwapRouteState.bind(swapsController),
      resetPostFetchState:
        swapsController.resetPostFetchState.bind(swapsController),
      setSwapsErrorKey: swapsController.setSwapsErrorKey.bind(swapsController),
      setInitialGasEstimate:
        swapsController.setInitialGasEstimate.bind(swapsController),
      setCustomApproveTxData:
        swapsController.setCustomApproveTxData.bind(swapsController),
      setSwapsLiveness: swapsController.setSwapsLiveness.bind(swapsController),
      setSwapsFeatureFlags:
        swapsController.setSwapsFeatureFlags.bind(swapsController),
      setSwapsUserFeeLevel:
        swapsController.setSwapsUserFeeLevel.bind(swapsController),
      setSwapsQuotesPollingLimitEnabled:
        swapsController.setSwapsQuotesPollingLimitEnabled.bind(swapsController),

      // Bridge
      setBridgeFeatureFlags:
        bridgeController.setBridgeFeatureFlags.bind(bridgeController),

      // Smart Transactions
      fetchSmartTransactionFees: smartTransactionsController.getFees.bind(
        smartTransactionsController,
      ),
      clearSmartTransactionFees: smartTransactionsController.clearFees.bind(
        smartTransactionsController,
      ),
      submitSignedTransactions:
        smartTransactionsController.submitSignedTransactions.bind(
          smartTransactionsController,
        ),
      cancelSmartTransaction:
        smartTransactionsController.cancelSmartTransaction.bind(
          smartTransactionsController,
        ),
      fetchSmartTransactionsLiveness:
        smartTransactionsController.fetchLiveness.bind(
          smartTransactionsController,
        ),
      updateSmartTransaction:
        smartTransactionsController.updateSmartTransaction.bind(
          smartTransactionsController,
        ),
      setStatusRefreshInterval:
        smartTransactionsController.setStatusRefreshInterval.bind(
          smartTransactionsController,
        ),

      // MetaMetrics
      trackMetaMetricsEvent: metaMetricsController.trackEvent.bind(
        metaMetricsController,
      ),
      trackMetaMetricsPage: metaMetricsController.trackPage.bind(
        metaMetricsController,
      ),
      createEventFragment: metaMetricsController.createEventFragment.bind(
        metaMetricsController,
      ),
      updateEventFragment: metaMetricsController.updateEventFragment.bind(
        metaMetricsController,
      ),
      finalizeEventFragment: metaMetricsController.finalizeEventFragment.bind(
        metaMetricsController,
      ),
      trackInsightSnapView: this.trackInsightSnapView.bind(this),

      // approval controller
      resolvePendingApproval: this.resolvePendingApproval,
      rejectPendingApproval: this.rejectPendingApproval,

      // Notifications
      resetViewedNotifications: announcementController.resetViewed.bind(
        announcementController,
      ),
      updateViewedNotifications: announcementController.updateViewed.bind(
        announcementController,
      ),

      // CurrencyRateController
      currencyRateStartPollingByNetworkClientId:
        currencyRateController.startPollingByNetworkClientId.bind(
          currencyRateController,
        ),
      currencyRateStopPollingByPollingToken:
        currencyRateController.stopPollingByPollingToken.bind(
          currencyRateController,
        ),

      // GasFeeController
      gasFeeStartPollingByNetworkClientId:
        gasFeeController.startPollingByNetworkClientId.bind(gasFeeController),
      gasFeeStopPollingByPollingToken:
        gasFeeController.stopPollingByPollingToken.bind(gasFeeController),

      getGasFeeTimeEstimate:
        gasFeeController.getTimeEstimate.bind(gasFeeController),

      addPollingTokenToAppState:
        appStateController.addPollingToken.bind(appStateController),

      removePollingTokenFromAppState:
        appStateController.removePollingToken.bind(appStateController),

      // Backup
      backupUserData: backup.backupUserData.bind(backup),
      restoreUserData: backup.restoreUserData.bind(backup),

      // TokenDetectionController
      detectTokens: tokenDetectionController.detectTokens.bind(
        tokenDetectionController,
      ),

      // DetectCollectibleController
      detectNfts: nftDetectionController.detectNfts.bind(
        nftDetectionController,
      ),

      /** Token Detection V2 */
      addDetectedTokens:
        tokensController.addDetectedTokens.bind(tokensController),
      addImportedTokens: tokensController.addTokens.bind(tokensController),
      ignoreTokens: tokensController.ignoreTokens.bind(tokensController),
      getBalancesInSingleCall:
        assetsContractController.getBalancesInSingleCall.bind(
          assetsContractController,
        ),

      // Authentication Controller
      performSignIn: authenticationController.performSignIn.bind(
        authenticationController,
      ),
      performSignOut: authenticationController.performSignOut.bind(
        authenticationController,
      ),

      // UserStorageController
      enableProfileSyncing: userStorageController.enableProfileSyncing.bind(
        userStorageController,
      ),
      disableProfileSyncing: userStorageController.disableProfileSyncing.bind(
        userStorageController,
      ),
      setIsProfileSyncingEnabled:
        userStorageController.setIsProfileSyncingEnabled.bind(
          userStorageController,
        ),

      // MetamaskNotificationsController
      checkAccountsPresence:
        metamaskNotificationsController.checkAccountsPresence.bind(
          metamaskNotificationsController,
        ),
      createOnChainTriggers:
        metamaskNotificationsController.createOnChainTriggers.bind(
          metamaskNotificationsController,
        ),
      deleteOnChainTriggersByAccount:
        metamaskNotificationsController.deleteOnChainTriggersByAccount.bind(
          metamaskNotificationsController,
        ),
      updateOnChainTriggersByAccount:
        metamaskNotificationsController.updateOnChainTriggersByAccount.bind(
          metamaskNotificationsController,
        ),
      fetchAndUpdateMetamaskNotifications:
        metamaskNotificationsController.fetchAndUpdateMetamaskNotifications.bind(
          metamaskNotificationsController,
        ),
      markMetamaskNotificationsAsRead:
        metamaskNotificationsController.markMetamaskNotificationsAsRead.bind(
          metamaskNotificationsController,
        ),
      setFeatureAnnouncementsEnabled:
        metamaskNotificationsController.setFeatureAnnouncementsEnabled.bind(
          metamaskNotificationsController,
        ),
      enablePushNotifications:
        pushPlatformNotificationsController.enablePushNotifications.bind(
          pushPlatformNotificationsController,
        ),
      disablePushNotifications:
        pushPlatformNotificationsController.disablePushNotifications.bind(
          pushPlatformNotificationsController,
        ),
      updateTriggerPushNotifications:
        pushPlatformNotificationsController.updateTriggerPushNotifications.bind(
          pushPlatformNotificationsController,
        ),
      enableMetamaskNotifications:
        metamaskNotificationsController.enableMetamaskNotifications.bind(
          metamaskNotificationsController,
        ),
      disableMetamaskNotifications:
        metamaskNotificationsController.disableMetamaskNotifications.bind(
          metamaskNotificationsController,
        ),

      // E2E testing
      throwTestError: this.throwTestError.bind(this),

      updateProposedNames: this.nameController.updateProposedNames.bind(
        this.nameController,
      ),
      setName: this.nameController.setName.bind(this.nameController),
    };
  }

  async exportAccount(address, password) {
    await this.verifyPassword(password);
    return this.keyringController.exportAccount(password, address);
  }

  async getTokenStandardAndDetails(address, userAddress, tokenId) {
    const { tokenList } = this.tokenListController.state;
    const { tokens } = this.tokensController.state;

    const staticTokenListDetails =
      STATIC_MAINNET_TOKEN_LIST[address.toLowerCase()] || {};
    const tokenListDetails = tokenList[address.toLowerCase()] || {};
    const userDefinedTokenDetails =
      tokens.find(({ address: _address }) =>
        isEqualCaseInsensitive(_address, address),
      ) || {};

    const tokenDetails = {
      ...staticTokenListDetails,
      ...tokenListDetails,
      ...userDefinedTokenDetails,
    };

    const tokenDetailsStandardIsERC20 =
      isEqualCaseInsensitive(tokenDetails.standard, TokenStandard.ERC20) ||
      tokenDetails.erc20 === true;

    const noEvidenceThatTokenIsAnNFT =
      !tokenId &&
      !isEqualCaseInsensitive(tokenDetails.standard, TokenStandard.ERC1155) &&
      !isEqualCaseInsensitive(tokenDetails.standard, TokenStandard.ERC721) &&
      !tokenDetails.erc721;

    const otherDetailsAreERC20Like =
      tokenDetails.decimals !== undefined && tokenDetails.symbol;

    const tokenCanBeTreatedAsAnERC20 =
      tokenDetailsStandardIsERC20 ||
      (noEvidenceThatTokenIsAnNFT && otherDetailsAreERC20Like);

    let details;
    if (tokenCanBeTreatedAsAnERC20) {
      try {
        const balance = userAddress
          ? await fetchTokenBalance(address, userAddress, this.provider)
          : undefined;

        details = {
          address,
          balance,
          standard: TokenStandard.ERC20,
          decimals: tokenDetails.decimals,
          symbol: tokenDetails.symbol,
        };
      } catch (e) {
        // If the `fetchTokenBalance` call failed, `details` remains undefined, and we
        // fall back to the below `assetsContractController.getTokenStandardAndDetails` call
        log.warn(`Failed to get token balance. Error: ${e}`);
      }
    }

    // `details`` will be undefined if `tokenCanBeTreatedAsAnERC20`` is false,
    // or if it is true but the `fetchTokenBalance`` call failed. In either case, we should
    // attempt to retrieve details from `assetsContractController.getTokenStandardAndDetails`
    if (details === undefined) {
      details = await this.assetsContractController.getTokenStandardAndDetails(
        address,
        userAddress,
        tokenId,
      );
    }

    const tokenDetailsStandardIsERC1155 = isEqualCaseInsensitive(
      details.standard,
      TokenStandard.ERC1155,
    );

    if (tokenDetailsStandardIsERC1155) {
      try {
        const balance = await fetchERC1155Balance(
          address,
          userAddress,
          tokenId,
          this.provider,
        );

        const balanceToUse = balance?._hex
          ? parseInt(balance._hex, 16).toString()
          : null;

        details = {
          ...details,
          balance: balanceToUse,
        };
      } catch (e) {
        // If the `fetchTokenBalance` call failed, `details` remains undefined, and we
        // fall back to the below `assetsContractController.getTokenStandardAndDetails` call
        log.warn('Failed to get token balance. Error:', e);
      }
    }

    return {
      ...details,
      decimals: details?.decimals?.toString(10),
      balance: details?.balance?.toString(10),
    };
  }

  async getTokenSymbol(address) {
    try {
      const details =
        await this.assetsContractController.getTokenStandardAndDetails(address);
      return details?.symbol;
    } catch (e) {
      return null;
    }
  }

  //=============================================================================
  // VAULT / KEYRING RELATED METHODS
  //=============================================================================

  /**
   * Creates a new Vault and create a new keychain.
   *
   * A vault, or KeyringController, is a controller that contains
   * many different account strategies, currently called Keyrings.
   * Creating it new means wiping all previous keyrings.
   *
   * A keychain, or keyring, controls many accounts with a single backup and signing strategy.
   * For example, a mnemonic phrase can generate many accounts, and is a keyring.
   *
   * @param {string} password
   * @returns {object} vault
   */
  async createNewVaultAndKeychain(password) {
    const releaseLock = await this.createVaultMutex.acquire();
    try {
      return await this.keyringController.createNewVaultAndKeychain(password);
    } finally {
      releaseLock();
    }
  }

  /**
   * Create a new Vault and restore an existent keyring.
   *
   * @param {string} password
   * @param {number[]} encodedSeedPhrase - The seed phrase, encoded as an array
   * of UTF-8 bytes.
   */
  async createNewVaultAndRestore(password, encodedSeedPhrase) {
    const releaseLock = await this.createVaultMutex.acquire();
    try {
      const { completedOnboarding } =
        this.onboardingController.store.getState();

      const seedPhraseAsBuffer = Buffer.from(encodedSeedPhrase);

      // clear permissions
      this.permissionController.clearState();

      // Clear snap state
      this.snapController.clearState();
      // Clear notification state
      this.notificationController.clear();

      // clear accounts in accountTracker
      this.accountTracker.clearAccounts();

      this.txController.clearUnapprovedTransactions();

      if (completedOnboarding) {
        this.tokenDetectionController.enable();
      }

      // create new vault
      await this.keyringController.createNewVaultAndRestore(
        password,
        this._convertMnemonicToWordlistIndices(seedPhraseAsBuffer),
      );

      if (completedOnboarding) {
        await this._addAccountsWithBalance();

        // This must be set as soon as possible to communicate to the
        // keyring's iframe and have the setting initialized properly
        // Optimistically called to not block MetaMask login due to
        // Ledger Keyring GitHub downtime
        this.setLedgerTransportPreference();
      }
    } finally {
      releaseLock();
    }
  }

  async _addAccountsWithBalance() {
    // Scan accounts until we find an empty one
    const { chainId } = this.networkController.state.providerConfig;
    const ethQuery = new EthQuery(this.provider);
    const accounts = await this.keyringController.getAccounts();
    let address = accounts[accounts.length - 1];

    for (let count = accounts.length; ; count++) {
      const balance = await this.getBalance(address, ethQuery);

      if (balance === '0x0') {
        // This account has no balance, so check for tokens
        await this.tokenDetectionController.detectTokens({
          selectedAddress: address,
        });

        const tokens =
          this.tokensController.state.allTokens?.[chainId]?.[address];
        const detectedTokens =
          this.tokensController.state.allDetectedTokens?.[chainId]?.[address];

        if (
          (tokens?.length ?? 0) === 0 &&
          (detectedTokens?.length ?? 0) === 0
        ) {
          // This account has no balance or tokens
          if (count !== 1) {
            await this.removeAccount(address);
          }
          break;
        }
      }

      // This account has assets, so check the next one
      address = await this.keyringController.addNewAccount(count);
    }
  }

  /**
   * Encodes a BIP-39 mnemonic as the indices of words in the English BIP-39 wordlist.
   *
   * @param {Buffer} mnemonic - The BIP-39 mnemonic.
   * @returns {Buffer} The Unicode code points for the seed phrase formed from the words in the wordlist.
   */
  _convertMnemonicToWordlistIndices(mnemonic) {
    const indices = mnemonic
      .toString()
      .split(' ')
      .map((word) => wordlist.indexOf(word));
    return new Uint8Array(new Uint16Array(indices).buffer);
  }

  /**
   * Converts a BIP-39 mnemonic stored as indices of words in the English wordlist to a buffer of Unicode code points.
   *
   * @param {Uint8Array} wordlistIndices - Indices to specific words in the BIP-39 English wordlist.
   * @returns {Buffer} The BIP-39 mnemonic formed from the words in the English wordlist, encoded as a list of Unicode code points.
   */
  _convertEnglishWordlistIndicesToCodepoints(wordlistIndices) {
    return Buffer.from(
      Array.from(new Uint16Array(wordlistIndices.buffer))
        .map((i) => wordlist[i])
        .join(' '),
    );
  }

  /**
   * Get an account balance from the AccountTracker or request it directly from the network.
   *
   * @param {string} address - The account address
   * @param {EthQuery} ethQuery - The EthQuery instance to use when asking the network
   */
  getBalance(address, ethQuery) {
    return new Promise((resolve, reject) => {
      const cached = this.accountTracker.store.getState().accounts[address];

      if (cached && cached.balance) {
        resolve(cached.balance);
      } else {
        ethQuery.getBalance(address, (error, balance) => {
          if (error) {
            reject(error);
            log.error(error);
          } else {
            resolve(balance || '0x0');
          }
        });
      }
    });
  }

  /**
   * Submits the user's password and attempts to unlock the vault.
   * Also synchronizes the preferencesController, to ensure its schema
   * is up to date with known accounts once the vault is decrypted.
   *
   * @param {string} password - The user's password
   */
  async submitPassword(password) {
    const { completedOnboarding } = this.onboardingController.store.getState();

    // Before attempting to unlock the keyrings, we need the offscreen to have loaded.
    await this.offscreenPromise;

    await this.keyringController.submitPassword(password);

    ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
    this.mmiController.onSubmitPassword();
    ///: END:ONLY_INCLUDE_IF

    try {
      await this.blockTracker.checkForLatestBlock();
    } catch (error) {
      log.error('Error while unlocking extension.', error);
    }

    await this.accountsController.updateAccounts();

    // This must be set as soon as possible to communicate to the
    // keyring's iframe and have the setting initialized properly
    // Optimistically called to not block MetaMask login due to
    // Ledger Keyring GitHub downtime
    if (completedOnboarding) {
      this.setLedgerTransportPreference();
    }
  }

  async _loginUser(password) {
    try {
      // Automatic login via config password
      await this.submitPassword(password);

      // Updating accounts in this.accountTracker before starting UI syncing ensure that
      // state has account balance before it is synced with UI
      await this.accountTracker.updateAccountsAllActiveNetworks();
    } finally {
      this._startUISync();
    }
  }

  _startUISync() {
    // Message startUISync is used to start syncing state with UI
    // Sending this message after login is completed helps to ensure that incomplete state without
    // account details are not flushed to UI.
    this.emit('startUISync');
    this.startUISync = true;
    this.memStore.subscribe(this.sendUpdate.bind(this));
  }

  /**
   * Submits a user's encryption key to log the user in via login token
   */
  async submitEncryptionKey() {
    try {
      const { loginToken, loginSalt } =
        await this.extension.storage.session.get(['loginToken', 'loginSalt']);
      if (loginToken && loginSalt) {
        const { vault } = this.keyringController.state;

        const jsonVault = JSON.parse(vault);

        if (jsonVault.salt !== loginSalt) {
          console.warn(
            'submitEncryptionKey: Stored salt and vault salt do not match',
          );
          await this.clearLoginArtifacts();
          return;
        }

        await this.keyringController.submitEncryptionKey(loginToken, loginSalt);
      }
    } catch (e) {
      // If somehow this login token doesn't work properly,
      // remove it and the user will get shown back to the unlock screen
      await this.clearLoginArtifacts();
      throw e;
    }
  }

  async clearLoginArtifacts() {
    await this.extension.storage.session.remove(['loginToken', 'loginSalt']);
  }

  /**
   * Submits a user's password to check its validity.
   *
   * @param {string} password - The user's password
   */
  async verifyPassword(password) {
    await this.keyringController.verifyPassword(password);
  }

  /**
   * @type Identity
   * @property {string} name - The account nickname.
   * @property {string} address - The account's ethereum address, in lower case.
   * receiving funds from our automatic Ropsten faucet.
   */

  /**
   * Gets the mnemonic of the user's primary keyring.
   */
  getPrimaryKeyringMnemonic() {
    const [keyring] = this.keyringController.getKeyringsByType(
      KeyringType.hdKeyTree,
    );
    if (!keyring.mnemonic) {
      throw new Error('Primary keyring mnemonic unavailable.');
    }

    return keyring.mnemonic;
  }

  ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
  async getCustodyKeyringIfExists(address) {
    const custodyType = this.custodyController.getCustodyTypeByAddress(
      toChecksumHexAddress(address),
    );
    const keyring = this.keyringController.getKeyringsByType(custodyType)[0];
    return keyring?.getAccountDetails(address) ? keyring : undefined;
  }
  ///: END:ONLY_INCLUDE_IF

  //
  // Hardware
  //

  async getKeyringForDevice(deviceName, hdPath = null) {
    const keyringOverrides = this.opts.overrides?.keyrings;
    let keyringName = null;
    switch (deviceName) {
      case HardwareDeviceNames.trezor:
        keyringName = keyringOverrides?.trezor?.type || TrezorKeyring.type;
        break;
      case HardwareDeviceNames.ledger:
        keyringName = keyringOverrides?.ledger?.type || LedgerKeyring.type;
        break;
      case HardwareDeviceNames.qr:
        keyringName = QRHardwareKeyring.type;
        break;
      case HardwareDeviceNames.lattice:
        keyringName = keyringOverrides?.lattice?.type || LatticeKeyring.type;
        break;
      default:
        throw new Error(
          'MetamaskController:getKeyringForDevice - Unknown device',
        );
    }
    let [keyring] = await this.keyringController.getKeyringsByType(keyringName);
    if (!keyring) {
      keyring = await this.keyringController.addNewKeyring(keyringName);
    }
    if (hdPath && keyring.setHdPath) {
      keyring.setHdPath(hdPath);
    }
    if (deviceName === HardwareDeviceNames.lattice) {
      keyring.appName = 'MetaMask';
    }
    if (deviceName === HardwareDeviceNames.trezor) {
      const model = keyring.getModel();
      this.appStateController.setTrezorModel(model);
    }

    keyring.network = this.networkController.state.providerConfig.type;

    return keyring;
  }

  async attemptLedgerTransportCreation() {
    const keyring = await this.getKeyringForDevice(HardwareDeviceNames.ledger);
    return await keyring.attemptMakeApp();
  }

  /**
   * Fetch account list from a hardware device.
   *
   * @param deviceName
   * @param page
   * @param hdPath
   * @returns [] accounts
   */
  async connectHardware(deviceName, page, hdPath) {
    const keyring = await this.getKeyringForDevice(deviceName, hdPath);

    if (deviceName === HardwareDeviceNames.ledger) {
      await this.setLedgerTransportPreference(keyring);
    }

    let accounts = [];
    switch (page) {
      case -1:
        accounts = await keyring.getPreviousPage();
        break;
      case 1:
        accounts = await keyring.getNextPage();
        break;
      default:
        accounts = await keyring.getFirstPage();
    }

    // Merge with existing accounts
    // and make sure addresses are not repeated
    const oldAccounts = await this.keyringController.getAccounts();

    const accountsToTrack = [
      ...new Set(
        oldAccounts.concat(accounts.map((a) => a.address.toLowerCase())),
      ),
    ];
    this.accountTracker.syncWithAddresses(accountsToTrack);
    return accounts;
  }

  /**
   * Check if the device is unlocked
   *
   * @param deviceName
   * @param hdPath
   * @returns {Promise<boolean>}
   */
  async checkHardwareStatus(deviceName, hdPath) {
    const keyring = await this.getKeyringForDevice(deviceName, hdPath);
    return keyring.isUnlocked();
  }

  /**
   * Clear
   *
   * @param deviceName
   * @returns {Promise<boolean>}
   */
  async forgetDevice(deviceName) {
    const keyring = await this.getKeyringForDevice(deviceName);

    for (const address of keyring.accounts) {
      await this.removeAccount(address);
    }

    keyring.forgetDevice();
    return true;
  }

  /**
   * Retrieves the keyring for the selected address and using the .type returns
   * a subtype for the account. Either 'hardware', 'imported', 'snap', or 'MetaMask'.
   *
   * @param {string} address - Address to retrieve keyring for
   * @returns {'hardware' | 'imported' | 'snap' | 'MetaMask'}
   */
  async getAccountType(address) {
    const keyringType = await this.keyringController.getAccountKeyringType(
      address,
    );
    switch (keyringType) {
      case KeyringType.trezor:
      case KeyringType.lattice:
      case KeyringType.qr:
      case KeyringType.ledger:
        return 'hardware';
      case KeyringType.imported:
        return 'imported';
      case KeyringType.snap:
        return 'snap';
      default:
        return 'MetaMask';
    }
  }

  /**
   * Retrieves the keyring for the selected address and using the .type
   * determines if a more specific name for the device is available. Returns
   * undefined for non hardware wallets.
   *
   * @param {string} address - Address to retrieve keyring for
   * @returns {'ledger' | 'lattice' | string | undefined}
   */
  async getDeviceModel(address) {
    const keyring = await this.keyringController.getKeyringForAccount(address);
    switch (keyring.type) {
      case KeyringType.trezor:
        return keyring.getModel();
      case KeyringType.qr:
        return keyring.getName();
      case KeyringType.ledger:
        // TODO: get model after ledger keyring exposes method
        return HardwareDeviceNames.ledger;
      case KeyringType.lattice:
        // TODO: get model after lattice keyring exposes method
        return HardwareDeviceNames.lattice;
      default:
        return undefined;
    }
  }

  /**
   * get hardware account label
   *
   * @returns string label
   */

  getAccountLabel(name, index, hdPathDescription) {
    return `${name[0].toUpperCase()}${name.slice(1)} ${
      parseInt(index, 10) + 1
    } ${hdPathDescription || ''}`.trim();
  }

  /**
   * Imports an account from a Trezor or Ledger device.
   *
   * @param index
   * @param deviceName
   * @param hdPath
   * @param hdPathDescription
   * @returns {} keyState
   */
  async unlockHardwareWalletAccount(
    index,
    deviceName,
    hdPath,
    hdPathDescription,
  ) {
    const keyring = await this.getKeyringForDevice(deviceName, hdPath);

    keyring.setAccountToUnlock(index);
    const unlockedAccount =
      await this.keyringController.addNewAccountForKeyring(keyring);
    const label = this.getAccountLabel(
      deviceName === HardwareDeviceNames.qr ? keyring.getName() : deviceName,
      index,
      hdPathDescription,
    );
    // Set the account label to Trezor 1 / Ledger 1 / QR Hardware 1, etc
    this.preferencesController.setAccountLabel(unlockedAccount, label);
    // Select the account
    this.preferencesController.setSelectedAddress(unlockedAccount);

    // It is expected that the account also exist in the accounts-controller
    // in other case, an error shall be thrown
    const account =
      this.accountsController.getAccountByAddress(unlockedAccount);
    this.accountsController.setAccountName(account.id, label);

    const accounts = this.accountsController.listAccounts();

    const { identities } = this.preferencesController.store.getState();
    return { unlockedAccount, identities, accounts };
  }

  //
  // Account Management
  //

  /**
   * Adds a new account to the default (first) HD seed phrase Keyring.
   *
   * @param accountCount
   * @returns {Promise<string>} The address of the newly-created account.
   */
  async addNewAccount(accountCount) {
    const oldAccounts = await this.keyringController.getAccounts();

    const addedAccountAddress = await this.keyringController.addNewAccount(
      accountCount,
    );

    if (!oldAccounts.includes(addedAccountAddress)) {
      this.preferencesController.setSelectedAddress(addedAccountAddress);
    }

    return addedAccountAddress;
  }

  /**
   * Verifies the validity of the current vault's seed phrase.
   *
   * Validity: seed phrase restores the accounts belonging to the current vault.
   *
   * Called when the first account is created and on unlocking the vault.
   *
   * @param password
   * @returns {Promise<number[]>} The seed phrase to be confirmed by the user,
   * encoded as an array of UTF-8 bytes.
   */
  async getSeedPhrase(password) {
    return this._convertEnglishWordlistIndicesToCodepoints(
      await this.keyringController.exportSeedPhrase(password),
    );
  }

  /**
   * Clears the transaction history, to allow users to force-reset their nonces.
   * Mostly used in development environments, when networks are restarted with
   * the same network ID.
   *
   * @returns {Promise<string>} The current selected address.
   */
  async resetAccount() {
    const selectedAddress =
      this.accountsController.getSelectedAccount().address;
    this.txController.wipeTransactions(false, selectedAddress);
    this.smartTransactionsController.wipeSmartTransactions({
      address: selectedAddress,
      ignoreNetwork: false,
    });
    this.networkController.resetConnection();

    return selectedAddress;
  }

  /**
   * Gets the permitted accounts for the specified origin. Returns an empty
   * array if no accounts are permitted.
   *
   * @param {string} origin - The origin whose exposed accounts to retrieve.
   * @param {boolean} [suppressUnauthorizedError] - Suppresses the unauthorized error.
   * @returns {Promise<string[]>} The origin's permitted accounts, or an empty
   * array.
   */
  async getPermittedAccounts(
    origin,
    { suppressUnauthorizedError = true } = {},
  ) {
    try {
      return await this.permissionController.executeRestrictedMethod(
        origin,
        RestrictedMethods.eth_accounts,
      );
    } catch (error) {
      if (
        suppressUnauthorizedError &&
        error.code === rpcErrorCodes.provider.unauthorized
      ) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Stops exposing the specified chain ID to all third parties.
   * Exposed chain IDs are stored in caveats of the permittedChains permission. This
   * method uses `PermissionController.updatePermissionsByCaveat` to
   * remove the specified chain ID from every permittedChains permission. If a
   * permission only included this chain ID, the permission is revoked entirely.
   *
   * @param {string} targetChainId - The chain ID to stop exposing
   * to third parties.
   */
  removeAllChainIdPermissions(targetChainId) {
    this.permissionController.updatePermissionsByCaveat(
      CaveatTypes.restrictNetworkSwitching,
      (existingChainIds) =>
        CaveatMutatorFactories[
          CaveatTypes.restrictNetworkSwitching
        ].removeChainId(targetChainId, existingChainIds),
    );
  }

  removeNetworkConfiguration(networkConfigurationId) {
    const { networkConfigurations } = this.networkController.state;
    const { chainId } = networkConfigurations[networkConfigurationId] ?? {};
    if (!chainId) {
      throw new Error('Network configuration not found');
    }
    const hasOtherConfigsForChainId = Object.values(networkConfigurations).some(
      (config) =>
        config.chainId === chainId &&
        config.id !== networkConfigurationId &&
        config.type !== networkConfigurationId,
    );

    // if this network configuration is only one for a given chainId
    // remove all permissions for that chainId
    if (!hasOtherConfigsForChainId) {
      this.removeAllChainIdPermissions(chainId);
    }

    this.networkController.removeNetworkConfiguration(networkConfigurationId);
  }

  /**
   * Stops exposing the account with the specified address to all third parties.
   * Exposed accounts are stored in caveats of the eth_accounts permission. This
   * method uses `PermissionController.updatePermissionsByCaveat` to
   * remove the specified address from every eth_accounts permission. If a
   * permission only included this address, the permission is revoked entirely.
   *
   * @param {string} targetAccount - The address of the account to stop exposing
   * to third parties.
   */
  removeAllAccountPermissions(targetAccount) {
    this.permissionController.updatePermissionsByCaveat(
      CaveatTypes.restrictReturnedAccounts,
      (existingAccounts) =>
        CaveatMutatorFactories[
          CaveatTypes.restrictReturnedAccounts
        ].removeAccount(targetAccount, existingAccounts),
    );
  }

  /**
   * Removes an account from state / storage.
   *
   * @param {string[]} address - A hex address
   */
  async removeAccount(address) {
    // Remove all associated permissions
    this.removeAllAccountPermissions(address);

    ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
    this.custodyController.removeAccount(address);
    ///: END:ONLY_INCLUDE_IF(build-mmi)

    const keyring = await this.keyringController.getKeyringForAccount(address);
    // Remove account from the keyring
    await this.keyringController.removeAccount(address);
    const updatedKeyringAccounts = keyring ? await keyring.getAccounts() : {};
    if (updatedKeyringAccounts?.length === 0) {
      keyring.destroy?.();
    }

    return address;
  }

  /**
   * Imports an account with the specified import strategy.
   * These are defined in @metamask/keyring-controller
   * Each strategy represents a different way of serializing an Ethereum key pair.
   *
   * @param {'privateKey' | 'json'} strategy - A unique identifier for an account import strategy.
   * @param {any} args - The data required by that strategy to import an account.
   */
  async importAccountWithStrategy(strategy, args) {
    const importedAccountAddress =
      await this.keyringController.importAccountWithStrategy(strategy, args);
    // set new account as selected
    this.preferencesController.setSelectedAddress(importedAccountAddress);
  }

  // ---------------------------------------------------------------------------
  // Identity Management (signature operations)

  getAddTransactionRequest({
    transactionParams,
    transactionOptions,
    dappRequest,
  }) {
    return {
      dappRequest,
      networkClientId:
        dappRequest?.networkClientId ??
        this.networkController.state.selectedNetworkClientId,
      selectedAccount: this.accountsController.getAccountByAddress(
        transactionParams.from,
      ),
      transactionController: this.txController,
      transactionOptions,
      transactionParams,
      userOperationController: this.userOperationController,
      chainId: this.networkController.state.providerConfig.chainId,
      ppomController: this.ppomController,
      securityAlertsEnabled:
        this.preferencesController.store.getState()?.securityAlertsEnabled,
      updateSecurityAlertResponse: this.updateSecurityAlertResponse.bind(this),
    };
  }

  /**
   * @returns {boolean} true if the keyring type supports EIP-1559
   */
  async getCurrentAccountEIP1559Compatibility() {
    return true;
  }

  //=============================================================================
  // END (VAULT / KEYRING RELATED METHODS)
  //=============================================================================

  /**
   * Allows a user to attempt to cancel a previously submitted transaction
   * by creating a new transaction.
   *
   * @param {number} originalTxId - the id of the txMeta that you want to
   *  attempt to cancel
   * @param {import(
   *  './controllers/transactions'
   * ).CustomGasSettings} [customGasSettings] - overrides to use for gas params
   *  instead of allowing this method to generate them
   * @param options
   * @returns {object} MetaMask state
   */
  async createCancelTransaction(originalTxId, customGasSettings, options) {
    await this.txController.stopTransaction(
      originalTxId,
      customGasSettings,
      options,
    );
    const state = this.getState();
    return state;
  }

  /**
   * Allows a user to attempt to speed up a previously submitted transaction
   * by creating a new transaction.
   *
   * @param {number} originalTxId - the id of the txMeta that you want to
   *  attempt to speed up
   * @param {import(
   *  './controllers/transactions'
   * ).CustomGasSettings} [customGasSettings] - overrides to use for gas params
   *  instead of allowing this method to generate them
   * @param options
   * @returns {object} MetaMask state
   */
  async createSpeedUpTransaction(originalTxId, customGasSettings, options) {
    await this.txController.speedUpTransaction(
      originalTxId,
      customGasSettings,
      options,
    );
    const state = this.getState();
    return state;
  }

  async estimateGas(estimateGasParams) {
    return new Promise((resolve, reject) => {
      return new EthJSQuery(this.provider).estimateGas(
        estimateGasParams,
        (err, res) => {
          if (err) {
            return reject(err);
          }

          return resolve(res.toString(16));
        },
      );
    });
  }

  handleWatchAssetRequest = ({ asset, type, origin, networkClientId }) => {
    switch (type) {
      case ERC20:
        return this.tokensController.watchAsset({
          asset,
          type,
          networkClientId,
        });
      case ERC721:
      case ERC1155:
        return this.nftController.watchNft(asset, type, origin);
      default:
        throw new Error(`Asset type ${type} not supported`);
    }
  };

  async updateSecurityAlertResponse(
    method,
    securityAlertId,
    securityAlertResponse,
  ) {
    updateSecurityAlertResponse({
      appStateController: this.appStateController,
      method,
      securityAlertId,
      securityAlertResponse,
      signatureController: this.signatureController,
      transactionController: this.txController,
    });
  }

  //=============================================================================
  // PASSWORD MANAGEMENT
  //=============================================================================

  /**
   * Allows a user to begin the seed phrase recovery process.
   */
  markPasswordForgotten() {
    this.preferencesController.setPasswordForgotten(true);
    this.sendUpdate();
  }

  /**
   * Allows a user to end the seed phrase recovery process.
   */
  unMarkPasswordForgotten() {
    this.preferencesController.setPasswordForgotten(false);
    this.sendUpdate();
  }

  //=============================================================================
  // REQUEST QUEUE
  //=============================================================================

  setUseRequestQueue(value) {
    this.preferencesController.setUseRequestQueue(value);
  }

  //=============================================================================
  // SETUP
  //=============================================================================

  /**
   * A runtime.MessageSender object, as provided by the browser:
   *
   * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/MessageSender
   * @typedef {object} MessageSender
   * @property {string} - The URL of the page or frame hosting the script that sent the message.
   */

  /**
   * A Snap sender object.
   *
   * @typedef {object} SnapSender
   * @property {string} snapId - The ID of the snap.
   */

  /**
   * Used to create a multiplexed stream for connecting to an untrusted context
   * like a Dapp or other extension.
   *
   * @param options - Options bag.
   * @param {ReadableStream} options.connectionStream - The Duplex stream to connect to.
   * @param {MessageSender | SnapSender} options.sender - The sender of the messages on this stream.
   * @param {string} [options.subjectType] - The type of the sender, i.e. subject.
   */
  setupUntrustedCommunicationEip1193({
    connectionStream,
    sender,
    subjectType,
  }) {
    const { completedOnboarding } = this.onboardingController.store.getState();
    const { usePhishDetect } = this.preferencesController.store.getState();

    let inputSubjectType;
    if (subjectType) {
      inputSubjectType = subjectType;
    } else if (sender.id && sender.id !== this.extension.runtime.id) {
      inputSubjectType = SubjectType.Extension;
    } else {
      inputSubjectType = SubjectType.Website;
    }

    if (usePhishDetect && completedOnboarding && sender.url) {
      const { hostname } = new URL(sender.url);
      this.phishingController.maybeUpdateState();
      // Check if new connection is blocked if phishing detection is on
      const phishingTestResponse = this.phishingController.test(hostname);
      if (phishingTestResponse?.result) {
        this.sendPhishingWarning(connectionStream, hostname);
        this.metaMetricsController.trackEvent({
          event: MetaMetricsEventName.PhishingPageDisplayed,
          category: MetaMetricsEventCategory.Phishing,
          properties: {
            url: hostname,
          },
        });
        return;
      }
    }

    // setup multiplexing
    const mux = setupMultiplex(connectionStream);

    // messages between inpage and background
    this.setupProviderConnectionEip1193(
      mux.createStream('metamask-provider'),
      sender,
      inputSubjectType,
    );

    // TODO:LegacyProvider: Delete
    if (sender.url) {
      // legacy streams
      this.setupPublicConfig(mux.createStream('publicConfig'));
    }
  }

  /**
   * Used to create a CAIP stream for connecting to an untrusted context.
   *
   * @param options - Options bag.
   * @param {ReadableStream} options.connectionStream - The Duplex stream to connect to.
   * @param {MessageSender | SnapSender} options.sender - The sender of the messages on this stream.
   * @param {string} [options.subjectType] - The type of the sender, i.e. subject.
   */

  setupUntrustedCommunicationCaip({ connectionStream, sender, subjectType }) {
    let inputSubjectType;
    if (subjectType) {
      inputSubjectType = subjectType;
    } else if (sender.id && sender.id !== this.extension.runtime.id) {
      inputSubjectType = SubjectType.Extension;
    } else {
      inputSubjectType = SubjectType.Website;
    }

    const caipStream = createCaipStream(connectionStream);

    // messages between subject and background
    this.setupProviderConnectionCaip(caipStream, sender, inputSubjectType);
  }

  /**
   * Used to create a multiplexed stream for connecting to a trusted context,
   * like our own user interfaces, which have the provider APIs, but also
   * receive the exported API from this controller, which includes trusted
   * functions, like the ability to approve transactions or sign messages.
   *
   * @param {*} connectionStream - The duplex stream to connect to.
   * @param {MessageSender} sender - The sender of the messages on this stream
   */
  setupTrustedCommunication(connectionStream, sender) {
    // setup multiplexing
    const mux = setupMultiplex(connectionStream);
    // connect features
    this.setupControllerConnection(mux.createStream('controller'));
    this.setupProviderConnectionEip1193(
      mux.createStream('provider'),
      sender,
      SubjectType.Internal,
    );
  }

  /**
   * Used to create a multiplexed stream for connecting to the phishing warning page.
   *
   * @param options - Options bag.
   * @param {ReadableStream} options.connectionStream - The Duplex stream to connect to.
   */
  setupPhishingCommunication({ connectionStream }) {
    const { usePhishDetect } = this.preferencesController.store.getState();

    if (!usePhishDetect) {
      return;
    }

    // setup multiplexing
    const mux = setupMultiplex(connectionStream);
    const phishingStream = mux.createStream(PHISHING_SAFELIST);

    // set up postStream transport
    phishingStream.on(
      'data',
      createMetaRPCHandler(
        {
          safelistPhishingDomain: this.safelistPhishingDomain.bind(this),
          backToSafetyPhishingWarning:
            this.backToSafetyPhishingWarning.bind(this),
        },
        phishingStream,
      ),
    );
  }

  /**
   * Called when we detect a suspicious domain. Requests the browser redirects
   * to our anti-phishing page.
   *
   * @private
   * @param {*} connectionStream - The duplex stream to the per-page script,
   * for sending the reload attempt to.
   * @param {string} hostname - The hostname that triggered the suspicion.
   */
  sendPhishingWarning(connectionStream, hostname) {
    const mux = setupMultiplex(connectionStream);
    const phishingStream = mux.createStream('phishing');
    phishingStream.write({ hostname });
  }

  /**
   * A method for providing our API over a stream using JSON-RPC.
   *
   * @param {*} outStream - The stream to provide our API over.
   */
  setupControllerConnection(outStream) {
    const api = this.getApi();

    // report new active controller connection
    this.activeControllerConnections += 1;
    this.emit('controllerConnectionChanged', this.activeControllerConnections);

    // set up postStream transport
    outStream.on('data', createMetaRPCHandler(api, outStream));
    const handleUpdate = (update) => {
      if (!isStreamWritable(outStream)) {
        return;
      }
      // send notification to client-side
      outStream.write({
        jsonrpc: '2.0',
        method: 'sendUpdate',
        params: [update],
      });
    };
    this.on('update', handleUpdate);
    const startUISync = () => {
      if (!isStreamWritable(outStream)) {
        return;
      }
      // send notification to client-side
      outStream.write({
        jsonrpc: '2.0',
        method: 'startUISync',
      });
    };

    if (this.startUISync) {
      startUISync();
    } else {
      this.once('startUISync', startUISync);
    }

    outStream.on('end', () => {
      this.activeControllerConnections -= 1;
      this.emit(
        'controllerConnectionChanged',
        this.activeControllerConnections,
      );
      this.removeListener('update', handleUpdate);
    });
  }

  /**
   * A method for serving our ethereum provider over a given stream.
   *
   * @param {*} outStream - The stream to provide over.
   * @param {MessageSender | SnapSender} sender - The sender of the messages on this stream
   * @param {SubjectType} subjectType - The type of the sender, i.e. subject.
   */
  setupProviderConnectionEip1193(outStream, sender, subjectType) {
    let origin;
    if (subjectType === SubjectType.Internal) {
      origin = ORIGIN_METAMASK;
    } else if (subjectType === SubjectType.Snap) {
      origin = sender.snapId;
    } else {
      origin = new URL(sender.url).origin;
    }

    if (sender.id && sender.id !== this.extension.runtime.id) {
      this.subjectMetadataController.addSubjectMetadata({
        origin,
        extensionId: sender.id,
        subjectType: SubjectType.Extension,
      });
    }

    let tabId;
    if (sender.tab && sender.tab.id) {
      tabId = sender.tab.id;
    }

    const engine = this.setupProviderEngineEip1193({
      origin,
      sender,
      subjectType,
      tabId,
    });

    const dupeReqFilterStream = createDupeReqFilterStream();

    // setup connection
    const providerStream = createEngineStream({ engine });

    const connectionId = this.addConnection(origin, { engine });

    pipeline(
      outStream,
      dupeReqFilterStream,
      providerStream,
      outStream,
      (err) => {
        // handle any middleware cleanup
        engine._middleware.forEach((mid) => {
          if (mid.destroy && typeof mid.destroy === 'function') {
            mid.destroy();
          }
        });
        connectionId && this.removeConnection(origin, connectionId);
        if (err) {
          log.error(err);
        }
      },
    );

    // Used to show wallet liveliness to the provider
    if (subjectType !== SubjectType.Internal) {
      this._notifyChainChangeForConnection({ engine }, origin);
    }
  }

  /**
   * A method for serving our CAIP provider over a given stream.
   *
   * @param {*} outStream - The stream to provide over.
   * @param {MessageSender | SnapSender} sender - The sender of the messages on this stream
   * @param {SubjectType} subjectType - The type of the sender, i.e. subject.
   */
  setupProviderConnectionCaip(outStream, sender, subjectType) {
    let origin;
    if (subjectType === SubjectType.Internal) {
      origin = ORIGIN_METAMASK;
    } else if (subjectType === SubjectType.Snap) {
      origin = sender.snapId;
    } else {
      origin = new URL(sender.url).origin;
    }

    if (sender.id && sender.id !== this.extension.runtime.id) {
      this.subjectMetadataController.addSubjectMetadata({
        origin,
        extensionId: sender.id,
        subjectType: SubjectType.Extension,
      });
    }

    let tabId;
    if (sender.tab && sender.tab.id) {
      tabId = sender.tab.id;
    }

    const engine = this.setupProviderEngineCaip({
      origin,
      tabId,
    });

    const dupeReqFilterStream = createDupeReqFilterStream();

    // setup connection
    const providerStream = createEngineStream({ engine });

    const connectionId = this.addConnection(origin, { engine });

    pipeline(
      outStream,
      dupeReqFilterStream,
      providerStream,
      outStream,
      (err) => {
        // handle any middleware cleanup
        engine._middleware.forEach((mid) => {
          if (mid.destroy && typeof mid.destroy === 'function') {
            mid.destroy();
          }
        });
        connectionId && this.removeConnection(origin, connectionId);
        if (err) {
          log.error(err);
        }
      },
    );

    // Used to show wallet liveliness to the provider
    if (subjectType !== SubjectType.Internal) {
      this._notifyChainChangeForConnection({ engine }, origin);
    }
  }

  /**
   * For snaps running in workers.
   *
   * @param snapId
   * @param connectionStream
   */
  setupSnapProvider(snapId, connectionStream) {
    this.setupUntrustedCommunicationEip1193({
      connectionStream,
      sender: { snapId },
      subjectType: SubjectType.Snap,
    });
  }

  /**
   * A method for creating an ethereum provider that is safely restricted for the requesting subject.
   *
   * @param {object} options - Provider engine options
   * @param {string} options.origin - The origin of the sender
   * @param {MessageSender | SnapSender} options.sender - The sender object.
   * @param {string} options.subjectType - The type of the sender subject.
   * @param {tabId} [options.tabId] - The tab ID of the sender - if the sender is within a tab
   */
  setupProviderEngineEip1193({ origin, subjectType, sender, tabId }) {
    const engine = new JsonRpcEngine();

    // Append origin to each request
    engine.push(createOriginMiddleware({ origin }));

    // Append selectedNetworkClientId to each request
    engine.push(createSelectedNetworkMiddleware(this.controllerMessenger));

    // Add a middleware that will switch chain on each request (as needed)
    const requestQueueMiddleware = createQueuedRequestMiddleware({
      enqueueRequest: this.queuedRequestController.enqueueRequest.bind(
        this.queuedRequestController,
      ),
      useRequestQueue: this.preferencesController.getUseRequestQueue.bind(
        this.preferencesController,
      ),
      shouldEnqueueRequest: (request) => {
        if (
          request.method === 'eth_requestAccounts' &&
          this.permissionController.hasPermission(
            request.origin,
            PermissionNames.eth_accounts,
          )
        ) {
          return false;
        }
        return methodsWithConfirmation.includes(request.method);
      },
    });
    engine.push(requestQueueMiddleware);

    // If the origin is not in the selectedNetworkController's `domains` state
    // when the provider engine is created, the selectedNetworkController will
    // fetch the globally selected networkClient from the networkController and wrap
    // it in a proxy which can be switched to use its own state if/when the origin
    // is added to the `domains` state
    const proxyClient =
      this.selectedNetworkController.getProviderAndBlockTracker(origin);

    // We create the filter and subscription manager middleware now, but they will
    // be inserted into the engine later.
    const filterMiddleware = createFilterMiddleware(proxyClient);
    const subscriptionManager = createSubscriptionManager(proxyClient);
    subscriptionManager.events.on('notification', (message) =>
      engine.emit('notification', message),
    );

    // Append tabId to each request if it exists
    if (tabId) {
      engine.push(createTabIdMiddleware({ tabId }));
    }

    engine.push(createLoggerMiddleware({ origin }));
    engine.push(this.permissionLogController.createMiddleware());

    if (origin === BaseUrl.Portfolio) {
      engine.push(createTxVerificationMiddleware(this.networkController));
    }

    engine.push(
      createPPOMMiddleware(
        this.ppomController,
        this.preferencesController,
        this.networkController,
        this.appStateController,
        this.updateSecurityAlertResponse.bind(this),
      ),
    );

    const isConfirmationRedesignEnabled = () => {
      return this.preferencesController.store.getState().preferences
        .redesignedConfirmationsEnabled;
    };

    engine.push(
      createRPCMethodTrackingMiddleware({
        trackEvent: this.metaMetricsController.trackEvent.bind(
          this.metaMetricsController,
        ),
        getMetricsState: this.metaMetricsController.store.getState.bind(
          this.metaMetricsController.store,
        ),
        getAccountType: this.getAccountType.bind(this),
        getDeviceModel: this.getDeviceModel.bind(this),
        isConfirmationRedesignEnabled,
        snapAndHardwareMessenger: this.controllerMessenger.getRestricted({
          name: 'SnapAndHardwareMessenger',
          allowedActions: [
            'KeyringController:getKeyringForAccount',
            'SnapController:get',
            'AccountsController:getSelectedAccount',
          ],
        }),
        appStateController: this.appStateController,
      }),
    );

    engine.push(createUnsupportedMethodMiddleware());

    // Legacy RPC methods that need to be implemented _ahead of_ the permission
    // middleware.
    engine.push(
      createLegacyMethodMiddleware({
        getAccounts: this.getPermittedAccounts.bind(this, origin),
      }),
    );

    if (subjectType !== SubjectType.Internal) {
      engine.push(
        this.permissionController.createPermissionMiddleware({
          origin,
        }),
      );
    }

    if (subjectType === SubjectType.Website) {
      engine.push(
        createOnboardingMiddleware({
          location: sender.url,
          registerOnboarding: this.onboardingController.registerOnboarding,
        }),
      );
    }

    // EVM requests and eth permissions should not be passed to non-EVM accounts
    // this middleware intercepts these requests and returns an error.
    engine.push(
      createEvmMethodsToNonEvmAccountReqFilterMiddleware({
        messenger: this.controllerMessenger.getRestricted({
          name: 'EvmMethodsToNonEvmAccountFilterMessenger',
          allowedActions: ['AccountsController:getSelectedAccount'],
        }),
      }),
    );

    // Unrestricted/permissionless RPC method implementations.
    // They must nevertheless be placed _behind_ the permission middleware.
    engine.push(
      createMethodMiddleware({
        origin,

        subjectType,

        // Miscellaneous
        addSubjectMetadata:
          this.subjectMetadataController.addSubjectMetadata.bind(
            this.subjectMetadataController,
          ),
        metamaskState: this.getState(),
        getProviderState: this.getProviderState.bind(this),
        getUnlockPromise: this.appStateController.getUnlockPromise.bind(
          this.appStateController,
        ),
        handleWatchAssetRequest: this.handleWatchAssetRequest.bind(this),
        requestUserApproval:
          this.approvalController.addAndShowApprovalRequest.bind(
            this.approvalController,
          ),
        startApprovalFlow: this.approvalController.startFlow.bind(
          this.approvalController,
        ),
        endApprovalFlow: this.approvalController.endFlow.bind(
          this.approvalController,
        ),
        sendMetrics: this.metaMetricsController.trackEvent.bind(
          this.metaMetricsController,
        ),
        // Permission-related
        getAccounts: this.getPermittedAccounts.bind(this, origin),
        getPermissionsForOrigin: this.permissionController.getPermissions.bind(
          this.permissionController,
          origin,
        ),
        hasPermission: this.permissionController.hasPermission.bind(
          this.permissionController,
          origin,
        ),
        requestAccountsPermission:
          this.permissionController.requestPermissions.bind(
            this.permissionController,
            { origin },
            { eth_accounts: {} },
          ),
        requestPermittedChainsPermission: (chainIds) =>
          this.permissionController.requestPermissions(
            { origin },
            {
              [PermissionNames.permittedChains]: {
                caveats: [
                  CaveatFactories[CaveatTypes.restrictNetworkSwitching](
                    chainIds,
                  ),
                ],
              },
            },
          ),
        requestPermissionsForOrigin:
          this.permissionController.requestPermissions.bind(
            this.permissionController,
            { origin },
          ),
        revokePermissionsForOrigin: (permissionKeys) => {
          try {
            this.permissionController.revokePermissions({
              [origin]: permissionKeys,
            });
          } catch (e) {
            // we dont want to handle errors here because
            // the revokePermissions api method should just
            // return `null` if the permissions were not
            // successfully revoked or if the permissions
            // for the origin do not exist
            console.log(e);
          }
        },
        getCaveat: ({ target, caveatType }) => {
          try {
            return this.permissionController.getCaveat(
              origin,
              target,
              caveatType,
            );
          } catch (e) {
            if (e instanceof PermissionDoesNotExistError) {
              // suppress expected error in case that the origin
              // does not have the target permission yet
            } else {
              throw e;
            }
          }

          return undefined;
        },
        getChainPermissionsFeatureFlag: () =>
          Boolean(process.env.CHAIN_PERMISSIONS),
        getCurrentRpcUrl: () =>
          this.networkController.state.providerConfig.rpcUrl,
        // network configuration-related
        upsertNetworkConfiguration:
          this.networkController.upsertNetworkConfiguration.bind(
            this.networkController,
          ),
        setActiveNetwork: async (networkClientId) => {
          await this.networkController.setActiveNetwork(networkClientId);
          // if the origin has the eth_accounts permission
          // we set per dapp network selection state
          if (
            this.permissionController.hasPermission(
              origin,
              PermissionNames.eth_accounts,
            )
          ) {
            this.selectedNetworkController.setNetworkClientIdForDomain(
              origin,
              networkClientId,
            );
          }
        },
        findNetworkConfigurationBy: this.findNetworkConfigurationBy.bind(this),
        getCurrentChainIdForDomain: (domain) => {
          const networkClientId =
            this.selectedNetworkController.getNetworkClientIdForDomain(domain);
          const { chainId } =
            this.networkController.getNetworkConfigurationByNetworkClientId(
              networkClientId,
            );
          return chainId;
        },

        // Web3 shim-related
        getWeb3ShimUsageState: this.alertController.getWeb3ShimUsageState.bind(
          this.alertController,
        ),
        setWeb3ShimUsageRecorded:
          this.alertController.setWeb3ShimUsageRecorded.bind(
            this.alertController,
          ),

        ///: BEGIN:ONLY_INCLUDE_IF(build-mmi)
        handleMmiAuthenticate:
          this.institutionalFeaturesController.handleMmiAuthenticate.bind(
            this.institutionalFeaturesController,
          ),
        handleMmiCheckIfTokenIsPresent:
          this.mmiController.handleMmiCheckIfTokenIsPresent.bind(
            this.mmiController,
          ),
        handleMmiDashboardData: this.mmiController.handleMmiDashboardData.bind(
          this.mmiController,
        ),
        handleMmiSetAccountAndNetwork:
          this.mmiController.setAccountAndNetwork.bind(this.mmiController),
        handleMmiOpenAddHardwareWallet:
          this.mmiController.handleMmiOpenAddHardwareWallet.bind(
            this.mmiController,
          ),
        ///: END:ONLY_INCLUDE_IF
      }),
    );

    engine.push(
      createSnapsMethodMiddleware(subjectType === SubjectType.Snap, {
        getUnlockPromise: this.appStateController.getUnlockPromise.bind(
          this.appStateController,
        ),
        getSnaps: this.controllerMessenger.call.bind(
          this.controllerMessenger,
          'SnapController:getPermitted',
          origin,
        ),
        requestPermissions: async (requestedPermissions) =>
          await this.permissionController.requestPermissions(
            { origin },
            requestedPermissions,
          ),
        getPermissions: this.permissionController.getPermissions.bind(
          this.permissionController,
          origin,
        ),
        getSnapFile: this.controllerMessenger.call.bind(
          this.controllerMessenger,
          'SnapController:getFile',
          origin,
        ),
        installSnaps: this.controllerMessenger.call.bind(
          this.controllerMessenger,
          'SnapController:install',
          origin,
        ),
        invokeSnap: this.permissionController.executeRestrictedMethod.bind(
          this.permissionController,
          origin,
          RestrictedMethods.wallet_snap,
        ),
        getIsLocked: () => {
          return !this.appStateController.isUnlocked();
        },
        ///: BEGIN:ONLY_INCLUDE_IF(keyring-snaps)
        hasPermission: this.permissionController.hasPermission.bind(
          this.permissionController,
          origin,
        ),
        getSnap: this.controllerMessenger.call.bind(
          this.controllerMessenger,
          'SnapController:get',
        ),
        getAllSnaps: this.controllerMessenger.call.bind(
          this.controllerMessenger,
          'SnapController:getAll',
        ),
        handleSnapRpcRequest: (args) =>
          this.handleSnapRequest({ ...args, origin }),
        getAllowedKeyringMethods: keyringSnapPermissionsBuilder(
          this.subjectMetadataController,
          origin,
        ),
        createInterface: this.controllerMessenger.call.bind(
          this.controllerMessenger,
          'SnapInterfaceController:createInterface',
          origin,
        ),
        getInterfaceState: (...args) =>
          this.controllerMessenger.call(
            'SnapInterfaceController:getInterface',
            origin,
            ...args,
          ).state,
        updateInterface: this.controllerMessenger.call.bind(
          this.controllerMessenger,
          'SnapInterfaceController:updateInterface',
          origin,
        ),
        ///: END:ONLY_INCLUDE_IF
      }),
    );

    engine.push(filterMiddleware);
    engine.push(subscriptionManager.middleware);

    engine.push(this.metamaskMiddleware);

    engine.push(providerAsMiddleware(proxyClient.provider));

    return engine;
  }

  /**
   * A method for creating a CAIP provider that is safely restricted for the requesting subject.
   *
   * @param {object} options - Provider engine options
   * @param {string} options.origin - The origin of the sender
   * @param {tabId} [options.tabId] - The tab ID of the sender - if the sender is within a tab
   */
  setupProviderEngineCaip({ origin, tabId }) {
    const engine = new JsonRpcEngine();

    engine.push((request, _res, _next, end) => {
      console.log('CAIP request received', { origin, tabId, request });
      return end(new Error('CAIP RPC Pipeline not yet implemented.'));
    });

    return engine;
  }

  /**
   * TODO:LegacyProvider: Delete
   * A method for providing our public config info over a stream.
   * This includes info we like to be synchronous if possible, like
   * the current selected account, and network ID.
   *
   * Since synchronous methods have been deprecated in web3,
   * this is a good candidate for deprecation.
   *
   * @param {*} outStream - The stream to provide public config over.
   */
  setupPublicConfig(outStream) {
    const configStream = storeAsStream(this.publicConfigStore);

    pipeline(configStream, outStream, (err) => {
      configStream.destroy();
      if (err) {
        log.error(err);
      }
    });
  }

  /**
   * Adds a reference to a connection by origin. Ignores the 'metamask' origin.
   * Caller must ensure that the returned id is stored such that the reference
   * can be deleted later.
   *
   * @param {string} origin - The connection's origin string.
   * @param {object} options - Data associated with the connection
   * @param {object} options.engine - The connection's JSON Rpc Engine
   * @returns {string} The connection's id (so that it can be deleted later)
   */
  addConnection(origin, { engine }) {
    if (origin === ORIGIN_METAMASK) {
      return null;
    }

    if (!this.connections[origin]) {
      this.connections[origin] = {};
    }

    const id = nanoid();
    this.connections[origin][id] = {
      engine,
    };

    return id;
  }

  /**
   * Deletes a reference to a connection, by origin and id.
   * Ignores unknown origins.
   *
   * @param {string} origin - The connection's origin string.
   * @param {string} id - The connection's id, as returned from addConnection.
   */
  removeConnection(origin, id) {
    const connections = this.connections[origin];
    if (!connections) {
      return;
    }

    delete connections[id];

    if (Object.keys(connections).length === 0) {
      delete this.connections[origin];
    }
  }

  /**
   * Closes all connections for the given origin, and removes the references
   * to them.
   * Ignores unknown origins.
   *
   * @param {string} origin - The origin string.
   */
  removeAllConnections(origin) {
    const connections = this.connections[origin];
    if (!connections) {
      return;
    }

    Object.keys(connections).forEach((id) => {
      this.removeConnection(origin, id);
    });
  }

  /**
   * Causes the RPC engines associated with the connections to the given origin
   * to emit a notification event with the given payload.
   *
   * The caller is responsible for ensuring that only permitted notifications
   * are sent.
   *
   * Ignores unknown origins.
   *
   * @param {string} origin - The connection's origin string.
   * @param {unknown} payload - The event payload.
   */
  notifyConnections(origin, payload) {
    const connections = this.connections[origin];

    if (connections) {
      Object.values(connections).forEach((conn) => {
        if (conn.engine) {
          conn.engine.emit('notification', payload);
        }
      });
    }
  }

  /**
   * Causes the RPC engines associated with all connections to emit a
   * notification event with the given payload.
   *
   * If the "payload" parameter is a function, the payload for each connection
   * will be the return value of that function called with the connection's
   * origin.
   *
   * The caller is responsible for ensuring that only permitted notifications
   * are sent.
   *
   * @param {unknown} payload - The event payload, or payload getter function.
   */
  notifyAllConnections(payload) {
    const getPayload =
      typeof payload === 'function'
        ? (origin) => payload(origin)
        : () => payload;

    Object.keys(this.connections).forEach((origin) => {
      Object.values(this.connections[origin]).forEach(async (conn) => {
        try {
          this.notifyConnection(conn, await getPayload(origin));
        } catch (err) {
          console.error(err);
        }
      });
    });
  }

  /**
   * Causes the RPC engine for passed connection to emit a
   * notification event with the given payload.
   *
   * The caller is responsible for ensuring that only permitted notifications
   * are sent.
   *
   * @param {object} connection - Data associated with the connection
   * @param {object} connection.engine - The connection's JSON Rpc Engine
   * @param {unknown} payload - The event payload
   */
  notifyConnection(connection, payload) {
    try {
      if (connection.engine) {
        connection.engine.emit('notification', payload);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // handlers

  /**
   * Handle a KeyringController update
   *
   * @param {object} state - the KC state
   * @returns {Promise<void>}
   * @private
   */
  async _onKeyringControllerUpdate(state) {
    const { keyrings } = state;

    // The accounts tracker only supports EVM addresses and the keyring
    // controller may pass non-EVM addresses, so we filter them out
    const addresses = keyrings
      .reduce((acc, { accounts }) => acc.concat(accounts), [])
      .filter(isEthAddress);

    if (!addresses.length) {
      return;
    }

    this.accountTracker.syncWithAddresses(addresses);
  }

  /**
   * Handle global application unlock.
   * Notifies all connections that the extension is unlocked, and which
   * account(s) are currently accessible, if any.
   */
  _onUnlock() {
    this.notifyAllConnections(async (origin) => {
      return {
        method: NOTIFICATION_NAMES.unlockStateChanged,
        params: {
          isUnlocked: true,
          accounts: await this.getPermittedAccounts(origin),
        },
      };
    });

    this.unMarkPasswordForgotten();

    // In the current implementation, this handler is triggered by a
    // KeyringController event. Other controllers subscribe to the 'unlock'
    // event of the MetaMaskController itself.
    this.emit('unlock');
  }

  /**
   * Handle global application lock.
   * Notifies all connections that the extension is locked.
   */
  _onLock() {
    this.notifyAllConnections({
      method: NOTIFICATION_NAMES.unlockStateChanged,
      params: {
        isUnlocked: false,
      },
    });

    // In the current implementation, this handler is triggered by a
    // KeyringController event. Other controllers subscribe to the 'lock'
    // event of the MetaMaskController itself.
    this.emit('lock');
  }

  /**
   * Handle memory state updates.
   * - Ensure isClientOpenAndUnlocked is updated
   * - Notifies all connections with the new provider network state
   *   - The external providers handle diffing the state
   *
   * @param newState
   */
  _onStateUpdate(newState) {
    this.isClientOpenAndUnlocked = newState.isUnlocked && this._isClientOpen;
    this._notifyChainChange();
  }

  // misc

  /**
   * A method for emitting the full MetaMask state to all registered listeners.
   *
   * @private
   */
  privateSendUpdate() {
    this.emit('update', this.getState());
  }

  /**
   * @returns {boolean} Whether the extension is unlocked.
   */
  isUnlocked() {
    return this.keyringController.state.isUnlocked;
  }

  //=============================================================================
  // MISCELLANEOUS
  //=============================================================================

  getExternalPendingTransactions(address) {
    return this.smartTransactionsController.getTransactions({
      addressFrom: address,
      status: 'pending',
    });
  }

  /**
   * Returns the nonce that will be associated with a transaction once approved
   *
   * @param {string} address - The hex string address for the transaction
   * @param networkClientId - The optional networkClientId to get the nonce lock with
   * @returns {Promise<number>}
   */
  async getPendingNonce(address, networkClientId) {
    const { nonceDetails, releaseLock } = await this.txController.getNonceLock(
      address,
      process.env.TRANSACTION_MULTICHAIN ? networkClientId : undefined,
    );

    const pendingNonce = nonceDetails.params.highestSuggested;

    releaseLock();
    return pendingNonce;
  }

  /**
   * Returns the next nonce according to the nonce-tracker
   *
   * @param {string} address - The hex string address for the transaction
   * @param networkClientId - The optional networkClientId to get the nonce lock with
   * @returns {Promise<number>}
   */
  async getNextNonce(address, networkClientId) {
    const nonceLock = await this.txController.getNonceLock(
      address,
      process.env.TRANSACTION_MULTICHAIN ? networkClientId : undefined,
    );
    nonceLock.releaseLock();
    return nonceLock.nextNonce;
  }

  /**
   * Throw an artificial error in a timeout handler for testing purposes.
   *
   * @param message - The error message.
   * @deprecated This is only mean to facilitiate E2E testing. We should not
   * use this for handling errors.
   */
  throwTestError(message) {
    setTimeout(() => {
      const error = new Error(message);
      error.name = 'TestError';
      throw error;
    });
  }

  /**
   * A method for setting TransactionController event listeners
   */
  _addTransactionControllerListeners() {
    const transactionMetricsRequest = this.getTransactionMetricsRequest();

    this.controllerMessenger.subscribe(
      'TransactionController:postTransactionBalanceUpdated',
      handlePostTransactionBalanceUpdate.bind(null, transactionMetricsRequest),
    );

    this.controllerMessenger.subscribe(
      'TransactionController:unapprovedTransactionAdded',
      (transactionMeta) =>
        handleTransactionAdded(transactionMetricsRequest, { transactionMeta }),
    );

    this.controllerMessenger.subscribe(
      'TransactionController:transactionApproved',
      handleTransactionApproved.bind(null, transactionMetricsRequest),
    );

    this.controllerMessenger.subscribe(
      'TransactionController:transactionDropped',
      handleTransactionDropped.bind(null, transactionMetricsRequest),
    );

    this.controllerMessenger.subscribe(
      'TransactionController:transactionConfirmed',
      handleTransactionConfirmed.bind(null, transactionMetricsRequest),
    );

    this.controllerMessenger.subscribe(
      'TransactionController:transactionFailed',
      handleTransactionFailed.bind(null, transactionMetricsRequest),
    );

    this.controllerMessenger.subscribe(
      'TransactionController:transactionNewSwap',
      ({ transactionMeta }) =>
        this.swapsController.setTradeTxId(transactionMeta.id),
    );

    this.controllerMessenger.subscribe(
      'TransactionController:transactionNewSwapApproval',
      ({ transactionMeta }) =>
        this.swapsController.setApproveTxId(transactionMeta.id),
    );

    this.controllerMessenger.subscribe(
      'TransactionController:transactionRejected',
      handleTransactionRejected.bind(null, transactionMetricsRequest),
    );

    this.controllerMessenger.subscribe(
      'TransactionController:transactionSubmitted',
      handleTransactionSubmitted.bind(null, transactionMetricsRequest),
    );

    this.controllerMessenger.subscribe(
      'TransactionController:transactionStatusUpdated',
      ({ transactionMeta }) => {
        this._onFinishedTransaction(transactionMeta);
      },
    );
  }

  getTransactionMetricsRequest() {
    const controllerActions = {
      // Metametrics Actions
      createEventFragment: this.metaMetricsController.createEventFragment.bind(
        this.metaMetricsController,
      ),
      finalizeEventFragment:
        this.metaMetricsController.finalizeEventFragment.bind(
          this.metaMetricsController,
        ),
      getEventFragmentById:
        this.metaMetricsController.getEventFragmentById.bind(
          this.metaMetricsController,
        ),
      getParticipateInMetrics: () =>
        this.metaMetricsController.state.participateInMetaMetrics,
      trackEvent: this.metaMetricsController.trackEvent.bind(
        this.metaMetricsController,
      ),
      updateEventFragment: this.metaMetricsController.updateEventFragment.bind(
        this.metaMetricsController,
      ),
      // Other dependencies
      getAccountType: this.getAccountType.bind(this),
      getDeviceModel: this.getDeviceModel.bind(this),
      getEIP1559GasFeeEstimates:
        this.gasFeeController.fetchGasFeeEstimates.bind(this.gasFeeController),
      getSelectedAddress: () =>
        this.accountsController.getSelectedAccount().address,
      getTokenStandardAndDetails: this.getTokenStandardAndDetails.bind(this),
      getTransaction: (id) =>
        this.txController.state.transactions.find((tx) => tx.id === id),
      getIsSmartTransaction: () => {
        return getIsSmartTransaction(this._getMetaMaskState());
      },
      getSmartTransactionByMinedTxHash: (txHash) => {
        return this.smartTransactionsController.getSmartTransactionByMinedTxHash(
          txHash,
        );
      },
    };
    return {
      ...controllerActions,
      snapAndHardwareMessenger: this.controllerMessenger.getRestricted({
        name: 'SnapAndHardwareMessenger',
        allowedActions: [
          'KeyringController:getKeyringForAccount',
          'SnapController:get',
          'AccountsController:getSelectedAccount',
        ],
      }),
      provider: this.provider,
    };
  }

  toggleExternalServices(useExternal) {
    this.preferencesController.toggleExternalServices(useExternal);
    this.tokenListController.updatePreventPollingOnNetworkRestart(!useExternal);
    if (useExternal) {
      this.tokenDetectionController.enable();
      this.gasFeeController.enableNonRPCGasFeeApis();
    } else {
      this.tokenDetectionController.disable();
      this.gasFeeController.disableNonRPCGasFeeApis();
    }
  }

  //=============================================================================
  // CONFIG
  //=============================================================================

  /**
   * Returns the first network configuration object that matches at least one field of the
   * provided search criteria. Returns null if no match is found
   *
   * @param {object} rpcInfo - The RPC endpoint properties and values to check.
   * @returns {object} rpcInfo found in the network configurations list
   */
  findNetworkConfigurationBy(rpcInfo) {
    const { networkConfigurations } = this.networkController.state;
    const networkConfiguration = Object.values(networkConfigurations).find(
      (configuration) => {
        return Object.keys(rpcInfo).some((key) => {
          return configuration[key] === rpcInfo[key];
        });
      },
    );

    return networkConfiguration || null;
  }

  /**
   * Sets the Ledger Live preference to use for Ledger hardware wallet support
   *
   * @param _keyring
   * @deprecated This method is deprecated and will be removed in the future.
   * Only webhid connections are supported in chrome and u2f in firefox.
   */
  async setLedgerTransportPreference(_keyring) {
    const transportType = window.navigator.hid
      ? LedgerTransportTypes.webhid
      : LedgerTransportTypes.u2f;
    const keyring =
      _keyring || (await this.getKeyringForDevice(HardwareDeviceNames.ledger));
    if (keyring?.updateTransportMethod) {
      return keyring.updateTransportMethod(transportType).catch((e) => {
        throw e;
      });
    }

    return undefined;
  }

  /**
   * A method for initializing storage the first time.
   *
   * @param {object} initState - The default state to initialize with.
   * @private
   */
  recordFirstTimeInfo(initState) {
    if (!('firstTimeInfo' in initState)) {
      const version = this.platform.getVersion();
      initState.firstTimeInfo = {
        version,
        date: Date.now(),
      };
    }
  }

  // TODO: Replace isClientOpen methods with `controllerConnectionChanged` events.
  /* eslint-disable accessor-pairs */
  /**
   * A method for recording whether the MetaMask user interface is open or not.
   *
   * @param {boolean} open
   */
  set isClientOpen(open) {
    this._isClientOpen = open;
  }
  /* eslint-enable accessor-pairs */

  /**
   * A method that is called by the background when all instances of metamask are closed.
   * Currently used to stop polling in the gasFeeController.
   */
  onClientClosed() {
    try {
      this.gasFeeController.stopAllPolling();
      this.currencyRateController.stopAllPolling();
      this.appStateController.clearPollingTokens();
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * A method that is called by the background when a particular environment type is closed (fullscreen, popup, notification).
   * Currently used to stop polling in the gasFeeController for only that environement type
   *
   * @param environmentType
   */
  onEnvironmentTypeClosed(environmentType) {
    const appStatePollingTokenType =
      POLLING_TOKEN_ENVIRONMENT_TYPES[environmentType];
    const pollingTokensToDisconnect =
      this.appStateController.store.getState()[appStatePollingTokenType];
    pollingTokensToDisconnect.forEach((pollingToken) => {
      this.gasFeeController.stopPollingByPollingToken(pollingToken);
      this.currencyRateController.stopPollingByPollingToken(pollingToken);
      this.appStateController.removePollingToken(
        pollingToken,
        appStatePollingTokenType,
      );
    });
  }

  /**
   * Adds a domain to the PhishingController safelist
   *
   * @param {string} hostname - the domain to safelist
   */
  safelistPhishingDomain(hostname) {
    return this.phishingController.bypass(hostname);
  }

  async backToSafetyPhishingWarning() {
    const extensionURL = this.platform.getExtensionURL();
    await this.platform.switchToAnotherURL(undefined, extensionURL);
  }

  /**
   * Locks MetaMask
   */
  setLocked() {
    return this.keyringController.setLocked();
  }

  removePermissionsFor = (subjects) => {
    try {
      this.permissionController.revokePermissions(subjects);
    } catch (exp) {
      if (!(exp instanceof PermissionsRequestNotFoundError)) {
        throw exp;
      }
    }
  };

  updateCaveat = (origin, target, caveatType, caveatValue) => {
    try {
      this.controllerMessenger.call(
        'PermissionController:updateCaveat',
        origin,
        target,
        caveatType,
        caveatValue,
      );
    } catch (exp) {
      if (!(exp instanceof PermissionsRequestNotFoundError)) {
        throw exp;
      }
    }
  };

  updateNetworksList = (sortedNetworkList) => {
    try {
      this.networkOrderController.updateNetworksList(sortedNetworkList);
    } catch (err) {
      log.error(err.message);
      throw err;
    }
  };

  updateAccountsList = (pinnedAccountList) => {
    try {
      this.accountOrderController.updateAccountsList(pinnedAccountList);
    } catch (err) {
      log.error(err.message);
      throw err;
    }
  };

  updateHiddenAccountsList = (hiddenAccountList) => {
    try {
      this.accountOrderController.updateHiddenAccountsList(hiddenAccountList);
    } catch (err) {
      log.error(err.message);
      throw err;
    }
  };

  rejectPermissionsRequest = (requestId) => {
    try {
      this.permissionController.rejectPermissionsRequest(requestId);
    } catch (exp) {
      if (!(exp instanceof PermissionsRequestNotFoundError)) {
        throw exp;
      }
    }
  };

  acceptPermissionsRequest = (request) => {
    try {
      this.permissionController.acceptPermissionsRequest(request);
    } catch (exp) {
      if (!(exp instanceof PermissionsRequestNotFoundError)) {
        throw exp;
      }
    }
  };

  resolvePendingApproval = async (id, value, options) => {
    try {
      await this.approvalController.accept(id, value, options);
    } catch (exp) {
      if (!(exp instanceof ApprovalRequestNotFoundError)) {
        throw exp;
      }
    }
  };

  rejectPendingApproval = (id, error) => {
    try {
      this.approvalController.reject(
        id,
        new EthereumRpcError(error.code, error.message, error.data),
      );
    } catch (exp) {
      if (!(exp instanceof ApprovalRequestNotFoundError)) {
        throw exp;
      }
    }
  };

  async _onAccountChange(newAddress) {
    const permittedAccountsMap = getPermittedAccountsByOrigin(
      this.permissionController.state,
    );

    for (const [origin, accounts] of permittedAccountsMap.entries()) {
      if (accounts.includes(newAddress)) {
        this._notifyAccountsChange(origin, accounts);
      }
    }

    await this.txController.updateIncomingTransactions();
  }

  async _notifyAccountsChange(origin, newAccounts) {
    if (this.isUnlocked()) {
      this.notifyConnections(origin, {
        method: NOTIFICATION_NAMES.accountsChanged,
        // This should be the same as the return value of `eth_accounts`,
        // namely an array of the current / most recently selected Ethereum
        // account.
        params:
          newAccounts.length < 2
            ? // If the length is 1 or 0, the accounts are sorted by definition.
              newAccounts
            : // If the length is 2 or greater, we have to execute
              // `eth_accounts` vi this method.
              await this.getPermittedAccounts(origin),
      });
    }

    this.permissionLogController.updateAccountsHistory(origin, newAccounts);
  }

  async _notifyChainChange() {
    if (this.preferencesController.getUseRequestQueue()) {
      this.notifyAllConnections(async (origin) => ({
        method: NOTIFICATION_NAMES.chainChanged,
        params: await this.getProviderNetworkState(origin),
      }));
    } else {
      this.notifyAllConnections({
        method: NOTIFICATION_NAMES.chainChanged,
        params: await this.getProviderNetworkState(),
      });
    }
  }

  async _notifyChainChangeForConnection(connection, origin) {
    if (this.preferencesController.getUseRequestQueue()) {
      this.notifyConnection(connection, {
        method: NOTIFICATION_NAMES.chainChanged,
        params: await this.getProviderNetworkState(origin),
      });
    } else {
      this.notifyConnection(connection, {
        method: NOTIFICATION_NAMES.chainChanged,
        params: await this.getProviderNetworkState(),
      });
    }
  }

  async _onFinishedTransaction(transactionMeta) {
    if (
      ![TransactionStatus.confirmed, TransactionStatus.failed].includes(
        transactionMeta.status,
      )
    ) {
      return;
    }

    await this._createTransactionNotifcation(transactionMeta);
    await this._updateNFTOwnership(transactionMeta);
    this._trackTransactionFailure(transactionMeta);
  }

  async _createTransactionNotifcation(transactionMeta) {
    const { chainId } = transactionMeta;
    let rpcPrefs = {};

    if (chainId) {
      const { networkConfigurations } = this.networkController.state;

      const matchingNetworkConfig = Object.values(networkConfigurations).find(
        (networkConfiguration) => networkConfiguration.chainId === chainId,
      );

      rpcPrefs = matchingNetworkConfig?.rpcPrefs ?? {};
    }

    try {
      await this.platform.showTransactionNotification(
        transactionMeta,
        rpcPrefs,
      );
    } catch (error) {
      log.error('Failed to create transaction notification', error);
    }
  }

  async _updateNFTOwnership(transactionMeta) {
    // if this is a transferFrom method generated from within the app it may be an NFT transfer transaction
    // in which case we will want to check and update ownership status of the transferred NFT.

    const { type, txParams, chainId, txReceipt } = transactionMeta;
    const selectedAddress =
      this.accountsController.getSelectedAccount().address;

    const { allNfts } = this.nftController.state;
    const txReceiptLogs = txReceipt?.logs;

    const isContractInteractionTx =
      type === TransactionType.contractInteraction && txReceiptLogs;
    const isTransferFromTx =
      (type === TransactionType.tokenMethodTransferFrom ||
        type === TransactionType.tokenMethodSafeTransferFrom) &&
      txParams !== undefined;

    if (!isContractInteractionTx && !isTransferFromTx) {
      return;
    }

    if (isTransferFromTx) {
      const { data, to: contractAddress, from: userAddress } = txParams;
      const transactionData = parseStandardTokenTransactionData(data);
      // Sometimes the tokenId value is parsed as "_value" param. Not seeing this often any more, but still occasionally:
      // i.e. call approve() on BAYC contract - https://etherscan.io/token/0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d#writeContract, and tokenId shows up as _value,
      // not sure why since it doesn't match the ERC721 ABI spec we use to parse these transactions - https://github.com/MetaMask/metamask-eth-abis/blob/d0474308a288f9252597b7c93a3a8deaad19e1b2/src/abis/abiERC721.ts#L62.
      const transactionDataTokenId =
        getTokenIdParam(transactionData) ?? getTokenValueParam(transactionData);

      // check if its a known NFT
      const knownNft = allNfts?.[userAddress]?.[chainId]?.find(
        ({ address, tokenId }) =>
          isEqualCaseInsensitive(address, contractAddress) &&
          tokenId === transactionDataTokenId,
      );

      // if it is we check and update ownership status.
      if (knownNft) {
        this.nftController.checkAndUpdateSingleNftOwnershipStatus(
          knownNft,
          false,
          // TODO add networkClientId once it is available in the transactionMeta
          // the chainId previously passed here didn't actually allow us to check for ownership on a non globally selected network
          // because the check would use the provider for the globally selected network, not the chainId passed here.
          { userAddress },
        );
      }
    } else {
      // Else if contract interaction we will parse the logs

      const allNftTransferLog = txReceiptLogs.map((txReceiptLog) => {
        const isERC1155NftTransfer =
          txReceiptLog.topics &&
          txReceiptLog.topics[0] === TRANSFER_SINFLE_LOG_TOPIC_HASH;
        const isERC721NftTransfer =
          txReceiptLog.topics &&
          txReceiptLog.topics[0] === TOKEN_TRANSFER_LOG_TOPIC_HASH;
        let isTransferToSelectedAddress;

        if (isERC1155NftTransfer) {
          isTransferToSelectedAddress =
            txReceiptLog.topics &&
            txReceiptLog.topics[3] &&
            txReceiptLog.topics[3].match(selectedAddress?.slice(2));
        }

        if (isERC721NftTransfer) {
          isTransferToSelectedAddress =
            txReceiptLog.topics &&
            txReceiptLog.topics[2] &&
            txReceiptLog.topics[2].match(selectedAddress?.slice(2));
        }

        return {
          isERC1155NftTransfer,
          isERC721NftTransfer,
          isTransferToSelectedAddress,
          ...txReceiptLog,
        };
      });
      if (allNftTransferLog.length !== 0) {
        const allNftParsedLog = [];
        allNftTransferLog.forEach((singleLog) => {
          if (
            singleLog.isTransferToSelectedAddress &&
            (singleLog.isERC1155NftTransfer || singleLog.isERC721NftTransfer)
          ) {
            let iface;
            if (singleLog.isERC1155NftTransfer) {
              iface = new Interface(abiERC1155);
            } else {
              iface = new Interface(abiERC721);
            }
            try {
              const parsedLog = iface.parseLog({
                data: singleLog.data,
                topics: singleLog.topics,
              });
              allNftParsedLog.push({
                contract: singleLog.address,
                ...parsedLog,
              });
            } catch (err) {
              // ignore
            }
          }
        });
        // Filter known nfts and new Nfts
        const knownNFTs = [];
        const newNFTs = [];
        allNftParsedLog.forEach((single) => {
          const tokenIdFromLog = getTokenIdParam(single);
          const existingNft = allNfts?.[selectedAddress]?.[chainId]?.find(
            ({ address, tokenId }) => {
              return (
                isEqualCaseInsensitive(address, single.contract) &&
                tokenId === tokenIdFromLog
              );
            },
          );
          if (existingNft) {
            knownNFTs.push(existingNft);
          } else {
            newNFTs.push({
              tokenId: tokenIdFromLog,
              ...single,
            });
          }
        });
        // For known nfts only refresh ownership
        const refreshOwnershipNFts = knownNFTs.map(async (singleNft) => {
          return this.nftController.checkAndUpdateSingleNftOwnershipStatus(
            singleNft,
            false,
            // TODO add networkClientId once it is available in the transactionMeta
            // the chainId previously passed here didn't actually allow us to check for ownership on a non globally selected network
            // because the check would use the provider for the globally selected network, not the chainId passed here.
            { selectedAddress },
          );
        });
        await Promise.allSettled(refreshOwnershipNFts);
        // For new nfts, add them to state
        const addNftPromises = newNFTs.map(async (singleNft) => {
          return this.nftController.addNft(
            singleNft.contract,
            singleNft.tokenId,
          );
        });
        await Promise.allSettled(addNftPromises);
      }
    }
  }

  _trackTransactionFailure(transactionMeta) {
    const { txReceipt } = transactionMeta;
    const metamaskState = this.getState();

    if (!txReceipt || txReceipt.status !== '0x0') {
      return;
    }

    this.metaMetricsController.trackEvent(
      {
        event: 'Tx Status Update: On-Chain Failure',
        category: MetaMetricsEventCategory.Background,
        properties: {
          action: 'Transactions',
          errorMessage: transactionMeta.simulationFails?.reason,
          numberOfTokens: metamaskState.tokens.length,
          numberOfAccounts: Object.keys(metamaskState.accounts).length,
        },
      },
      {
        matomoEvent: true,
      },
    );
  }

  _onUserOperationAdded(userOperationMeta) {
    const transactionMeta = this.txController.state.transactions.find(
      (tx) => tx.id === userOperationMeta.id,
    );

    if (!transactionMeta) {
      return;
    }

    if (transactionMeta.type === TransactionType.swap) {
      this.controllerMessenger.publish(
        'TransactionController:transactionNewSwap',
        { transactionMeta },
      );
    } else if (transactionMeta.type === TransactionType.swapApproval) {
      this.controllerMessenger.publish(
        'TransactionController:transactionNewSwapApproval',
        { transactionMeta },
      );
    }
  }

  _onUserOperationTransactionUpdated(transactionMeta) {
    const updatedTransactionMeta = {
      ...transactionMeta,
      txParams: {
        ...transactionMeta.txParams,
        from: this.accountsController.getSelectedAccount().address,
      },
    };

    const transactionExists = this.txController.state.transactions.some(
      (tx) => tx.id === updatedTransactionMeta.id,
    );

    if (!transactionExists) {
      this.txController.update((state) => {
        state.transactions.push(updatedTransactionMeta);
      });
    }

    this.txController.updateTransaction(
      updatedTransactionMeta,
      'Generated from user operation',
    );

    this.controllerMessenger.publish(
      'TransactionController:transactionStatusUpdated',
      { transactionMeta: updatedTransactionMeta },
    );
  }

  _publishSmartTransactionHook(transactionMeta) {
    const state = this._getMetaMaskState();
    const isSmartTransaction = getIsSmartTransaction(state);
    if (!isSmartTransaction) {
      // Will cause TransactionController to publish to the RPC provider as normal.
      return { transactionHash: undefined };
    }
    const featureFlags = getFeatureFlagsByChainId(state);
    return submitSmartTransactionHook({
      transactionMeta,
      transactionController: this.txController,
      smartTransactionsController: this.smartTransactionsController,
      controllerMessenger: this.controllerMessenger,
      isSmartTransaction,
      featureFlags,
    });
  }

  _getMetaMaskState() {
    return {
      metamask: this.getState(),
    };
  }

  async #onPreferencesControllerStateChange(currentState, previousState) {
    const { currentLocale } = currentState;
    const { chainId } = this.networkController.state.providerConfig;

    await updateCurrentLocale(currentLocale);

    if (currentState.incomingTransactionsPreferences?.[chainId]) {
      this.txController.startIncomingTransactionPolling();
    } else {
      this.txController.stopIncomingTransactionPolling();
    }

    this.#checkTokenListPolling(currentState, previousState);

    // TODO: Remove once the preferences controller has been replaced with the core monorepo implementation
    this.controllerMessenger.publish(
      'PreferencesController:stateChange',
      currentState,
      [],
    );
  }

  #checkTokenListPolling(currentState, previousState) {
    const previousEnabled = this.#isTokenListPollingRequired(previousState);
    const newEnabled = this.#isTokenListPollingRequired(currentState);

    if (previousEnabled === newEnabled) {
      return;
    }

    this.tokenListController.updatePreventPollingOnNetworkRestart(!newEnabled);

    if (newEnabled) {
      log.debug('Started token list controller polling');
      this.tokenListController.start();
    } else {
      log.debug('Stopped token list controller polling');
      this.tokenListController.clearingTokenListData();
      this.tokenListController.stop();
    }
  }

  #isTokenListPollingRequired(preferencesControllerState) {
    const { useTokenDetection, useTransactionSimulations, preferences } =
      preferencesControllerState ?? {};

    const { petnamesEnabled } = preferences ?? {};

    return useTokenDetection || petnamesEnabled || useTransactionSimulations;
  }
}
