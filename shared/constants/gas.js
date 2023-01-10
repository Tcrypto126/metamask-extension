import { addHexPrefix } from 'ethereumjs-util';

const ONE_HUNDRED_THOUSAND = 100000;
const MIN_GAS_LIMIT_DEC = '21000';

export const MIN_GAS_LIMIT_HEX = parseInt(MIN_GAS_LIMIT_DEC, 10).toString(16);

export const GAS_LIMITS = {
  // maximum gasLimit of a simple send
  SIMPLE: addHexPrefix(MIN_GAS_LIMIT_HEX),
  // a base estimate for token transfers.
  BASE_TOKEN_ESTIMATE: addHexPrefix(ONE_HUNDRED_THOUSAND.toString(16)),
};

/**
 * @typedef {object} GasEstimateTypes
 * @property {'fee-market'} FEE_MARKET - A gas estimate for a fee market
 *  transaction generated by our gas estimation API.
 * @property {'legacy'} LEGACY - A gas estimate for a legacy Transaction
 *  generated by our gas estimation API.
 * @property {'eth_gasPrice'} ETH_GAS_PRICE - A gas estimate provided by the
 *  Ethereum node via eth_gasPrice.
 * @property {'none'} NONE - No gas estimate available.
 */

/**
 * These are already declared in @metamask/controllers but importing them from
 * that module and re-exporting causes the UI bundle size to expand beyond 4MB
 *
 * (TODO: This comment was added before @metamask/controllers was split up —
 * revisit now that @metamask/gas-fee-controller is available)
 *
 * @type {GasEstimateTypes}
 */
export const GAS_ESTIMATE_TYPES = {
  FEE_MARKET: 'fee-market',
  LEGACY: 'legacy',
  ETH_GASPRICE: 'eth_gasPrice',
  NONE: 'none',
};

/**
 * These represent gas recommendation levels presented in the UI
 */
export const GAS_RECOMMENDATIONS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

/**
 * These represent types of gas estimation
 */
export const PRIORITY_LEVELS = {
  TEN_PERCENT_INCREASED: 'tenPercentIncreased',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CUSTOM: 'custom',
  DAPP_SUGGESTED: 'dappSuggested',
};

/**
 * Represents the user customizing their gas preference
 */
export const CUSTOM_GAS_ESTIMATE = 'custom';

/**
 * These represent the different edit modes presented in the UI
 */
export const EDIT_GAS_MODES = {
  SPEED_UP: 'speed-up',
  CANCEL: 'cancel',
  MODIFY_IN_PLACE: 'modify-in-place',
  SWAPS: 'swaps',
};

/**
 * Represents levels for `networkCongestion` (calculated along with gas fee
 * estimates; represents a number between 0 and 1) that we use to render the
 * network status slider on the send transaction screen and inform users when
 * gas fees are high
 */
export const NETWORK_CONGESTION_THRESHOLDS = {
  NOT_BUSY: 0,
  STABLE: 0.33,
  BUSY: 0.66,
};
