export const TRADES_BASE_PROD_URL = 'https://api.metaswap.codefi.network/trades?'
export const TOKENS_BASE_PROD_URL = 'https://api.metaswap.codefi.network/tokens'
export const AGGREGATOR_METADATA_BASE_PROD_URL = 'https://api.metaswap.codefi.network/aggregatorMetadata'
export const TOP_ASSET_BASE_PROD_URL = 'https://api.metaswap.codefi.network/topAssets'

export const TOKENS = [
  { erc20: true, symbol: 'META', decimals: 18, address: '0x617b3f8050a0BD94b6b1da02B4384eE5B4DF13F4' },
  { erc20: true, symbol: 'ZRX', decimals: 18, address: '0xE41d2489571d322189246DaFA5ebDe1F4699F498' },
  { erc20: true, symbol: 'AST', decimals: 4, address: '0x27054b13b1B798B345b591a4d22e6562d47eA75a' },
  { erc20: true, symbol: 'BAT', decimals: 18, address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF' },
  { erc20: true, symbol: 'CVL', decimals: 18, address: '0x01FA555c97D7958Fa6f771f3BbD5CCD508f81e22' },
  { erc20: true, symbol: 'GLA', decimals: 8, address: '0x71D01dB8d6a2fBEa7f8d434599C237980C234e4C' },
  { erc20: true, symbol: 'GNO', decimals: 18, address: '0x6810e776880C02933D47DB1b9fc05908e5386b96' },
  { erc20: true, symbol: 'OMG', decimals: 18, address: '0xd26114cd6EE289AccF82350c8d8487fedB8A0C07' },
  { erc20: true, symbol: 'SAI', decimals: 18, address: '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359' },
  { erc20: true, symbol: 'USDT', decimals: 6, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  { erc20: true, symbol: 'WED', decimals: 18, address: '0x7848ae8F19671Dc05966dafBeFbBbb0308BDfAbD' },
  { erc20: true, symbol: 'WBTC', decimals: 8, address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
]

export const MOCK_TRADE_RESPONSE_1 = [
  {
    'trade': { // the ethereum transaction data for the swap
      'data': '0xa6c3bf330000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000004e0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000005591360f8c7640fea5771c9682d6b5ecb776e1f8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000021486a000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005efe3c3b5dfc3a75ffc8add04bbdbac1e42fa234bf4549d8dab1bc44c8056eaf0e1dfe8600000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000003c00000000000000000000000000000000000000000000000000000000000000420000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000000000000000000000000000001c4dc1600f3000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000005591360f8c7640fea5771c9682d6b5ecb776e1f800000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000140000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000036691c4f426eb8f42f150ebde43069a31cb080ad000000000000000000000000000000000000000000000000002386f26fc10000000000000000000000000000000000000000000000000000000000000021486a00000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000020000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024f47261b0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010400000000000000000000000000000000000000000000000000000000000000869584cd0000000000000000000000001000000000000000000000000000000000000011000000000000000000000000000000000000000000000000000000005efe201b',
      'from': '0x2369267687A84ac7B494daE2f1542C40E37f4455',
      'value': '5700000000000000',
      'to': '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
    },
    'sourceAmount': '10000000000000000',
    'destinationAmount': '2248687',
    'error': null,
    'sourceToken': TOKENS[0].address,
    'destinationToken': TOKENS[1].address,
    'fetchTime': 553,
    'aggregator': 'zeroEx',
    'averageGas': 1,
    'maxGas': 10,
    'aggType': 'AGG',
    'approvalNeeded': { // the ethereum transaction data for the approval (if needed)
      'data': '0x095ea7b300000000000000000000000095e6f48254609a6ee006f7d493c8e5fb97094cef0000000000000000000000000000000000000000004a817c7ffffffdabf41c00',
      'to': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      'amount': '0',
      'from': '0x2369267687A84ac7B494daE2f1542C40E37f4455',
      'gas': '12',
      'gasPrice': '34',
    },
  },
  {
    'sourceAmount': '10000000000000000',
    'destinationAmount': '2248687',
    'error': null,
    'sourceToken': TOKENS[0].address,
    'destinationToken': TOKENS[1].address,
    'fetchTime': 553,
    'aggregator': 'zeroEx',
    'aggType': 'AGG',
    'approvalNeeded': { // the ethereum transaction data for the approval (if needed)
      'data': '0x095ea7b300000000000000000000000095e6f48254609a6ee006f7d493c8e5fb97094cef0000000000000000000000000000000000000000004a817c7ffffffdabf41c00',
      'to': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      'value': '0',
      'from': '0x2369267687A84ac7B494daE2f1542C40E37f4455',
    },
  },
  {
    'trade': { // the ethereum transaction data for the swap
      'data': '0xa6c3bf330000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000004e0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000005591360f8c7640fea5771c9682d6b5ecb776e1f8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000021486a000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005efe3c3b5dfc3a75ffc8add04bbdbac1e42fa234bf4549d8dab1bc44c8056eaf0e1dfe8600000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000003c00000000000000000000000000000000000000000000000000000000000000420000000000000000000000000000000000000000000000000000000000000042000000000000000000000000000000000000000000000000000000000000001c4dc1600f3000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000005591360f8c7640fea5771c9682d6b5ecb776e1f800000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000140000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000036691c4f426eb8f42f150ebde43069a31cb080ad000000000000000000000000000000000000000000000000002386f26fc10000000000000000000000000000000000000000000000000000000000000021486a00000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000020000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024f47261b0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010400000000000000000000000000000000000000000000000000000000000000869584cd0000000000000000000000001000000000000000000000000000000000000011000000000000000000000000000000000000000000000000000000005efe201b',
      'from': '0x2369267687A84ac7B494daE2f1542C40E37f4455',
      'value': '5700000000000000',
      'to': '0x61935cbdd02287b511119ddb11aeb42f1593b7ef',
    },
    'sourceAmount': '10000000000000000',
    'destinationAmount': '2248687',
    'error': true,
    'sourceToken': TOKENS[0].address,
    'destinationToken': TOKENS[1].address,
    'fetchTime': 553,
    'aggregator': 'zeroEx',
    'aggType': 'AGG',
  },
]

export const MOCK_TRADE_RESPONSE_2 = MOCK_TRADE_RESPONSE_1.map((trade) => ({ ...trade, sourceAmount: '20000000000000000' }))

export const AGGREGATOR_METADATA = {
  'agg1': {
    'color': '#283B4C',
    'title': 'agg1',
    'icon': 'data:image/png;base64,iVBORw0KGgoAAA',
  },
  'agg2': {
    'color': '#283B4C',
    'title': 'agg2',
    'icon': 'data:image/png;base64,iVBORw0KGgoAAA',
  },
}

export const TOP_ASSETS = [
  {
    'symbol': 'LINK',
    'address': '0x514910771af9ca656af840dff83e8264ecf986ca',
  },
  {
    'symbol': 'UMA',
    'address': '0x04fa0d235c4abf4bcf4787af4cf447de572ef828',
  },
  {
    'symbol': 'YFI',
    'address': '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
  },
  {
    'symbol': 'LEND',
    'address': '0x80fb784b7ed66730e8b1dbd9820afd29931aab03',
  },
  {
    'symbol': 'SNX',
    'address': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
  },
]
