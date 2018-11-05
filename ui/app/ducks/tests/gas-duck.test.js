import assert from 'assert'
import sinon from 'sinon'
import proxyquire from 'proxyquire'


const GasDuck = proxyquire('../gas.duck.js', {
  '../../lib/local-storage-helpers': {
    loadLocalStorageData: sinon.spy(),
    saveLocalStorageData: sinon.spy(),
  },
})

const {
  basicGasEstimatesLoadingStarted,
  basicGasEstimatesLoadingFinished,
  setBasicGasEstimateData,
  setCustomGasPrice,
  setCustomGasLimit,
  setCustomGasTotal,
  setCustomGasErrors,
  resetCustomGasState,
  fetchBasicGasEstimates,
  gasEstimatesLoadingStarted,
  gasEstimatesLoadingFinished,
  setPricesAndTimeEstimates,
  fetchGasEstimates,
  setApiEstimatesLastRetrieved,
} = GasDuck
const GasReducer = GasDuck.default

describe('Gas Duck', () => {
  let tempFetch
  let tempDateNow
  const mockEthGasApiResponse = {
    average: 'mockAverage',
    avgWait: 'mockAvgWait',
    block_time: 'mockBlock_time',
    blockNum: 'mockBlockNum',
    fast: 'mockFast',
    fastest: 'mockFastest',
    fastestWait: 'mockFastestWait',
    fastWait: 'mockFastWait',
    safeLow: 'mockSafeLow',
    safeLowWait: 'mockSafeLowWait',
    speed: 'mockSpeed',
  }
  const mockPredictTableResponse = [
    { expectedTime: 100, expectedWait: 10, gasprice: 1, somethingElse: 'foobar' },
    { expectedTime: 50, expectedWait: 5, gasprice: 2, somethingElse: 'foobar' },
    { expectedTime: 20, expectedWait: 4, gasprice: 4, somethingElse: 'foobar' },
    { expectedTime: 10, expectedWait: 2, gasprice: 10, somethingElse: 'foobar' },
    { expectedTime: 1, expectedWait: 0.5, gasprice: 20, somethingElse: 'foobar' },
  ]
  const fetchStub = sinon.stub().callsFake((url) => new Promise(resolve => {
    const dataToResolve = url.match(/ethgasAPI/)
      ? mockEthGasApiResponse
      : mockPredictTableResponse
    resolve({
      json: () => new Promise(resolve => resolve(dataToResolve)),
    })
  }))

  beforeEach(() => {
    tempFetch = global.fetch
    tempDateNow = global.Date.now
    global.fetch = fetchStub
    global.Date.now = () => 2000000
  })

  afterEach(() => {
    global.fetch = tempFetch
    global.Date.now = tempDateNow
  })

  const mockState = {
    gas: {
      mockProp: 123,
    },
  }
  const initState = {
    customData: {
      price: null,
      limit: '0x5208',
    },
    basicEstimates: {
      average: null,
      fastestWait: null,
      fastWait: null,
      fast: null,
      safeLowWait: null,
      blockNum: null,
      avgWait: null,
      blockTime: null,
      speed: null,
      fastest: null,
      safeLow: null,
    },
    basicEstimateIsLoading: true,
    errors: {},
    gasEstimatesLoading: true,
    priceAndTimeEstimates: [],
    priceAndTimeEstimatesLastRetrieved: 0,

  }
  const BASIC_GAS_ESTIMATE_LOADING_FINISHED = 'metamask/gas/BASIC_GAS_ESTIMATE_LOADING_FINISHED'
  const BASIC_GAS_ESTIMATE_LOADING_STARTED = 'metamask/gas/BASIC_GAS_ESTIMATE_LOADING_STARTED'
  const GAS_ESTIMATE_LOADING_FINISHED = 'metamask/gas/GAS_ESTIMATE_LOADING_FINISHED'
  const GAS_ESTIMATE_LOADING_STARTED = 'metamask/gas/GAS_ESTIMATE_LOADING_STARTED'
  const RESET_CUSTOM_GAS_STATE = 'metamask/gas/RESET_CUSTOM_GAS_STATE'
  const SET_BASIC_GAS_ESTIMATE_DATA = 'metamask/gas/SET_BASIC_GAS_ESTIMATE_DATA'
  const SET_CUSTOM_GAS_ERRORS = 'metamask/gas/SET_CUSTOM_GAS_ERRORS'
  const SET_CUSTOM_GAS_LIMIT = 'metamask/gas/SET_CUSTOM_GAS_LIMIT'
  const SET_CUSTOM_GAS_PRICE = 'metamask/gas/SET_CUSTOM_GAS_PRICE'
  const SET_CUSTOM_GAS_TOTAL = 'metamask/gas/SET_CUSTOM_GAS_TOTAL'
  const SET_PRICE_AND_TIME_ESTIMATES = 'metamask/gas/SET_PRICE_AND_TIME_ESTIMATES'
  const SET_API_ESTIMATES_LAST_RETRIEVED = 'metamask/gas/SET_API_ESTIMATES_LAST_RETRIEVED'

  describe('GasReducer()', () => {
    it('should initialize state', () => {
      assert.deepEqual(
        GasReducer({}),
        initState
      )
    })

    it('should return state unchanged if it does not match a dispatched actions type', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: 'someOtherAction',
          value: 'someValue',
        }),
        Object.assign({}, mockState.gas)
      )
    })

    it('should set basicEstimateIsLoading to true when receiving a BASIC_GAS_ESTIMATE_LOADING_STARTED action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: BASIC_GAS_ESTIMATE_LOADING_STARTED,
        }),
        Object.assign({basicEstimateIsLoading: true}, mockState.gas)
      )
    })

    it('should set basicEstimateIsLoading to false when receiving a BASIC_GAS_ESTIMATE_LOADING_FINISHED action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: BASIC_GAS_ESTIMATE_LOADING_FINISHED,
        }),
        Object.assign({basicEstimateIsLoading: false}, mockState.gas)
      )
    })

    it('should set gasEstimatesLoading to true when receiving a GAS_ESTIMATE_LOADING_STARTED action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: GAS_ESTIMATE_LOADING_STARTED,
        }),
        Object.assign({gasEstimatesLoading: true}, mockState.gas)
      )
    })

    it('should set gasEstimatesLoading to false when receiving a GAS_ESTIMATE_LOADING_FINISHED action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: GAS_ESTIMATE_LOADING_FINISHED,
        }),
        Object.assign({gasEstimatesLoading: false}, mockState.gas)
      )
    })

    it('should return a new object (and not just modify the existing state object)', () => {
      assert.deepEqual(GasReducer(mockState), mockState.gas)
      assert.notEqual(GasReducer(mockState), mockState.gas)
    })

    it('should set basicEstimates when receiving a SET_BASIC_GAS_ESTIMATE_DATA action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: SET_BASIC_GAS_ESTIMATE_DATA,
          value: { someProp: 'someData123' },
        }),
        Object.assign({basicEstimates: {someProp: 'someData123'} }, mockState.gas)
      )
    })

    it('should set priceAndTimeEstimates when receiving a SET_PRICE_AND_TIME_ESTIMATES action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: SET_PRICE_AND_TIME_ESTIMATES,
          value: { someProp: 'someData123' },
        }),
        Object.assign({priceAndTimeEstimates: {someProp: 'someData123'} }, mockState.gas)
      )
    })

    it('should set customData.price when receiving a SET_CUSTOM_GAS_PRICE action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: SET_CUSTOM_GAS_PRICE,
          value: 4321,
        }),
        Object.assign({customData: {price: 4321} }, mockState.gas)
      )
    })

    it('should set customData.limit when receiving a SET_CUSTOM_GAS_LIMIT action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: SET_CUSTOM_GAS_LIMIT,
          value: 9876,
        }),
        Object.assign({customData: {limit: 9876} }, mockState.gas)
      )
    })

    it('should set customData.total when receiving a SET_CUSTOM_GAS_TOTAL action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: SET_CUSTOM_GAS_TOTAL,
          value: 10000,
        }),
        Object.assign({customData: {total: 10000} }, mockState.gas)
      )
    })

    it('should set priceAndTimeEstimatesLastRetrieved when receivinga SET_API_ESTIMATES_LAST_RETRIEVED action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: SET_API_ESTIMATES_LAST_RETRIEVED,
          value: 1500000000000,
        }),
        Object.assign({ priceAndTimeEstimatesLastRetrieved: 1500000000000 }, mockState.gas)
      )
    })

    it('should set errors when receiving a SET_CUSTOM_GAS_ERRORS action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: SET_CUSTOM_GAS_ERRORS,
          value: { someError: 'error_error' },
        }),
        Object.assign({errors: {someError: 'error_error'} }, mockState.gas)
      )
    })

    it('should return the initial state in response to a RESET_CUSTOM_GAS_STATE action', () => {
      assert.deepEqual(
        GasReducer(mockState, {
          type: RESET_CUSTOM_GAS_STATE,
        }),
        Object.assign({}, initState)
      )
    })
  })

  describe('basicGasEstimatesLoadingStarted', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        basicGasEstimatesLoadingStarted(),
        { type: BASIC_GAS_ESTIMATE_LOADING_STARTED }
      )
    })
  })

  describe('basicGasEstimatesLoadingFinished', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        basicGasEstimatesLoadingFinished(),
        { type: BASIC_GAS_ESTIMATE_LOADING_FINISHED }
      )
    })
  })

  describe('fetchBasicGasEstimates', () => {
    const mockDistpatch = sinon.spy()
    it('should call fetch with the expected params', async () => {
      await fetchBasicGasEstimates()(mockDistpatch)
      assert.deepEqual(
        mockDistpatch.getCall(0).args,
        [{ type: BASIC_GAS_ESTIMATE_LOADING_STARTED} ]
      )
      assert.deepEqual(
        global.fetch.getCall(0).args,
        [
          'https://ethgasstation.info/json/ethgasAPI.json',
          {
            'headers': {},
            'referrer': 'http://ethgasstation.info/json/',
            'referrerPolicy': 'no-referrer-when-downgrade',
            'body': null,
            'method': 'GET',
            'mode': 'cors',
          },
        ]
      )
      assert.deepEqual(
        mockDistpatch.getCall(1).args,
        [{
          type: SET_BASIC_GAS_ESTIMATE_DATA,
          value: {
            average: 'mockAverage',
            avgWait: 'mockAvgWait',
            blockTime: 'mockBlock_time',
            blockNum: 'mockBlockNum',
            fast: 'mockFast',
            fastest: 'mockFastest',
            fastestWait: 'mockFastestWait',
            fastWait: 'mockFastWait',
            safeLow: 'mockSafeLow',
            safeLowWait: 'mockSafeLowWait',
            speed: 'mockSpeed',
          },
        }]
      )
      assert.deepEqual(
        mockDistpatch.getCall(2).args,
        [{ type: BASIC_GAS_ESTIMATE_LOADING_FINISHED }]
      )
    })
  })

  describe('fetchGasEstimates', () => {
    const mockDistpatch = sinon.spy()

    beforeEach(() => {
      mockDistpatch.resetHistory()
    })

    it('should call fetch with the expected params', async () => {
      global.fetch.resetHistory()
      await fetchGasEstimates(5)(mockDistpatch, () => ({ gas: Object.assign(
        {},
        initState,
        { priceAndTimeEstimatesLastRetrieved: 1000000 }
      ) }))
      assert.deepEqual(
        mockDistpatch.getCall(0).args,
        [{ type: GAS_ESTIMATE_LOADING_STARTED} ]
      )
      assert.deepEqual(
        global.fetch.getCall(0).args,
        [
          'https://ethgasstation.info/json/predictTable.json',
          {
            'headers': {},
            'referrer': 'http://ethgasstation.info/json/',
            'referrerPolicy': 'no-referrer-when-downgrade',
            'body': null,
            'method': 'GET',
            'mode': 'cors',
          },
        ]
      )

      assert.deepEqual(
        mockDistpatch.getCall(1).args,
        [{ type: SET_API_ESTIMATES_LAST_RETRIEVED, value: 2000000 }]
      )

      assert.deepEqual(
        mockDistpatch.getCall(2).args,
        [{
          type: SET_PRICE_AND_TIME_ESTIMATES,
          value: [
            {
              expectedTime: '25',
              expectedWait: 5,
              gasprice: 2,
            },
            {
              expectedTime: '20',
              expectedWait: 4,
              gasprice: 4,
            },
            {
              expectedTime: '10',
              expectedWait: 2,
              gasprice: 10,
            },
            {
              expectedTime: '2.5',
              expectedWait: 0.5,
              gasprice: 20,
            },
          ],

        }]
      )
      assert.deepEqual(
        mockDistpatch.getCall(3).args,
        [{ type: GAS_ESTIMATE_LOADING_FINISHED }]
      )
    })

    it('should not call fetch if the estimates were retrieved < 75000 ms ago', async () => {
      global.fetch.resetHistory()
      await fetchGasEstimates(5)(mockDistpatch, () => ({ gas: Object.assign(
        {},
        initState,
        {
          priceAndTimeEstimatesLastRetrieved: Date.now(),
          priceAndTimeEstimates: [{
            expectedTime: '10',
            expectedWait: 2,
            gasprice: 50,
          }],
        }
      ) }))
      assert.deepEqual(
        mockDistpatch.getCall(0).args,
        [{ type: GAS_ESTIMATE_LOADING_STARTED} ]
      )
      assert.equal(global.fetch.callCount, 0)

      assert.deepEqual(
        mockDistpatch.getCall(1).args,
        [{
          type: SET_PRICE_AND_TIME_ESTIMATES,
          value: [
            {
              expectedTime: '10',
              expectedWait: 2,
              gasprice: 50,
            },
          ],

        }]
      )
      assert.deepEqual(
        mockDistpatch.getCall(2).args,
        [{ type: GAS_ESTIMATE_LOADING_FINISHED }]
      )
    })
  })

  describe('gasEstimatesLoadingStarted', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        gasEstimatesLoadingStarted(),
        { type: GAS_ESTIMATE_LOADING_STARTED }
      )
    })
  })

  describe('gasEstimatesLoadingFinished', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        gasEstimatesLoadingFinished(),
        { type: GAS_ESTIMATE_LOADING_FINISHED }
      )
    })
  })

  describe('setPricesAndTimeEstimates', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        setPricesAndTimeEstimates('mockPricesAndTimeEstimates'),
        { type: SET_PRICE_AND_TIME_ESTIMATES, value: 'mockPricesAndTimeEstimates' }
      )
    })
  })

  describe('setBasicGasEstimateData', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        setBasicGasEstimateData('mockBasicEstimatData'),
        { type: SET_BASIC_GAS_ESTIMATE_DATA, value: 'mockBasicEstimatData' }
      )
    })
  })

  describe('setCustomGasPrice', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        setCustomGasPrice('mockCustomGasPrice'),
        { type: SET_CUSTOM_GAS_PRICE, value: 'mockCustomGasPrice' }
      )
    })
  })

  describe('setCustomGasLimit', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        setCustomGasLimit('mockCustomGasLimit'),
        { type: SET_CUSTOM_GAS_LIMIT, value: 'mockCustomGasLimit' }
      )
    })
  })

  describe('setCustomGasTotal', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        setCustomGasTotal('mockCustomGasTotal'),
        { type: SET_CUSTOM_GAS_TOTAL, value: 'mockCustomGasTotal' }
      )
    })
  })

  describe('setCustomGasErrors', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        setCustomGasErrors('mockErrorObject'),
        { type: SET_CUSTOM_GAS_ERRORS, value: 'mockErrorObject' }
      )
    })
  })

  describe('setApiEstimatesLastRetrieved', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        setApiEstimatesLastRetrieved(1234),
        { type: SET_API_ESTIMATES_LAST_RETRIEVED, value: 1234 }
      )
    })
  })

  describe('resetCustomGasState', () => {
    it('should create the correct action', () => {
      assert.deepEqual(
        resetCustomGasState(),
        { type: RESET_CUSTOM_GAS_STATE }
      )
    })
  })

})
