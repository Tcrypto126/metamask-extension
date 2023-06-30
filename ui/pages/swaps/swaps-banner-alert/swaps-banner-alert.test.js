import React from 'react';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import {
  renderWithProvider,
  createSwapsMockStore,
} from '../../../../test/jest';
import {
  QUOTES_EXPIRED_ERROR,
  SWAP_FAILED_ERROR,
  ERROR_FETCHING_QUOTES,
  QUOTES_NOT_AVAILABLE_ERROR,
  CONTRACT_DATA_DISABLED_ERROR,
  OFFLINE_FOR_MAINTENANCE,
  SLIPPAGE_OVER_LIMIT_ERROR,
  SLIPPAGE_VERY_HIGH_ERROR,
  SLIPPAGE_TOO_LOW_ERROR,
  SLIPPAGE_NEGATIVE_ERROR,
} from '../../../../shared/constants/swaps';
import SwapsBannerAlert from './swaps-banner-alert';

const middleware = [thunk];

describe('SwapsBannerAlert', () => {
  it('renders the component with the SLIPPAGE_OVER_LIMIT_ERROR', () => {
    const mockStore = createSwapsMockStore();
    const store = configureMockStore(middleware)(mockStore);
    const { getByText } = renderWithProvider(
      <SwapsBannerAlert swapsErrorKey={SLIPPAGE_OVER_LIMIT_ERROR} />,
      store,
    );
    expect(getByText('Reduce slippage to continue')).toBeInTheDocument();
    expect(
      getByText(
        'Slippage tolerance must be 15% or less. Anything higher will result in a bad rate.',
      ),
    ).toBeInTheDocument();
    expect(getByText('Edit transaction settings')).toBeInTheDocument();
  });

  it('renders the component with the SLIPPAGE_VERY_HIGH_ERROR', () => {
    const mockStore = createSwapsMockStore();
    const store = configureMockStore(middleware)(mockStore);
    const { getByText } = renderWithProvider(
      <SwapsBannerAlert swapsErrorKey={SLIPPAGE_VERY_HIGH_ERROR} />,
      store,
    );
    expect(getByText('Very high slippage')).toBeInTheDocument();
    expect(
      getByText(
        'The slippage entered is considered very high and may result in a bad rate',
      ),
    ).toBeInTheDocument();
  });

  it('renders the component with the SLIPPAGE_TOO_LOW_ERROR', () => {
    const mockStore = createSwapsMockStore();
    const store = configureMockStore(middleware)(mockStore);
    const { getByText } = renderWithProvider(
      <SwapsBannerAlert swapsErrorKey={SLIPPAGE_TOO_LOW_ERROR} />,
      store,
    );
    expect(
      getByText('Increase slippage to avoid transaction failure'),
    ).toBeInTheDocument();
    expect(
      getByText(
        'Max slippage is too low which may cause your transaction to fail.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the component with the SLIPPAGE_NEGATIVE_ERROR', () => {
    const mockStore = createSwapsMockStore();
    const store = configureMockStore(middleware)(mockStore);
    const { getByText } = renderWithProvider(
      <SwapsBannerAlert swapsErrorKey={SLIPPAGE_NEGATIVE_ERROR} />,
      store,
    );
    expect(getByText('Increase slippage to continue')).toBeInTheDocument();
    expect(
      getByText('Slippage must be greater or equal to zero'),
    ).toBeInTheDocument();
    expect(getByText('Edit transaction settings')).toBeInTheDocument();
  });

  it('renders the component with the QUOTES_NOT_AVAILABLE_ERROR', () => {
    const mockStore = createSwapsMockStore();
    const store = configureMockStore(middleware)(mockStore);
    const { getByText } = renderWithProvider(
      <SwapsBannerAlert swapsErrorKey={QUOTES_NOT_AVAILABLE_ERROR} />,
      store,
    );
    expect(getByText('No quotes available')).toBeInTheDocument();
    expect(
      getByText('Reduce the size of your trade or use a different token.'),
    ).toBeInTheDocument();
    expect(getByText('Learn more about Swaps')).toBeInTheDocument();
  });

  it('renders the component with the ERROR_FETCHING_QUOTES', () => {
    const mockStore = createSwapsMockStore();
    const store = configureMockStore(middleware)(mockStore);
    const { getByText } = renderWithProvider(
      <SwapsBannerAlert swapsErrorKey={ERROR_FETCHING_QUOTES} />,
      store,
    );
    expect(getByText('Error fetching quotes')).toBeInTheDocument();
    expect(
      getByText(
        'Hmmm... something went wrong. Try again, or if errors persist, contact customer support.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the component with the CONTRACT_DATA_DISABLED_ERROR', () => {
    const mockStore = createSwapsMockStore();
    const store = configureMockStore(middleware)(mockStore);
    const { getByText } = renderWithProvider(
      <SwapsBannerAlert swapsErrorKey={CONTRACT_DATA_DISABLED_ERROR} />,
      store,
    );
    expect(
      getByText('Contract data is not enabled on your Ledger'),
    ).toBeInTheDocument();
    expect(
      getByText(
        'In the Ethereum app on your Ledger, go to "Settings" and allow contract data. Then, try your swap again.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the component with the QUOTES_EXPIRED_ERROR', () => {
    const mockStore = createSwapsMockStore();
    const store = configureMockStore(middleware)(mockStore);
    const { getByText } = renderWithProvider(
      <SwapsBannerAlert swapsErrorKey={QUOTES_EXPIRED_ERROR} />,
      store,
    );
    expect(getByText('Quotes timeout')).toBeInTheDocument();
    expect(
      getByText('Please request new quotes to get the latest rates.'),
    ).toBeInTheDocument();
  });

  it('renders the component with the OFFLINE_FOR_MAINTENANCE', () => {
    const mockStore = createSwapsMockStore();
    const store = configureMockStore(middleware)(mockStore);
    const { getByText } = renderWithProvider(
      <SwapsBannerAlert swapsErrorKey={OFFLINE_FOR_MAINTENANCE} />,
      store,
    );
    expect(getByText('Offline for maintenance')).toBeInTheDocument();
    expect(
      getByText(
        'MetaMask Swaps is undergoing maintenance. Please check back later.',
      ),
    ).toBeInTheDocument();
  });

  it('renders the component with the SWAP_FAILED_ERROR', () => {
    const mockStore = createSwapsMockStore();
    const store = configureMockStore(middleware)(mockStore);
    const { getByText } = renderWithProvider(
      <SwapsBannerAlert swapsErrorKey={SWAP_FAILED_ERROR} />,
      store,
    );
    expect(getByText('Swap failed')).toBeInTheDocument();
  });
});
