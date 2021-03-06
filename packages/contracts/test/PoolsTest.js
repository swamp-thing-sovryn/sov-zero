const StabilityPool = artifacts.require("./StabilityPool.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const NonPayable = artifacts.require("./NonPayable.sol")

const testHelpers = require("../utils/testHelpers.js")
const timeMachine = require('ganache-time-traveler');

const sovTokenTester = artifacts.require("./SOVTokenTester.sol")

const th = testHelpers.TestHelper
const dec = th.dec

const _minus_1_Ether = web3.utils.toWei('-1', 'ether')

contract('StabilityPool', async accounts => {
  /* mock* are EOA’s, temporarily used to call protected functions.
  TODO: Replace with mock contracts, and later complete transactions from EOA
  */
  let stabilityPool

  const [owner, alice] = accounts;

  before(async () => {
    stabilityPool = await StabilityPool.new()
    const mockActivePoolAddress = (await NonPayable.new()).address
    const dumbContractAddress = (await NonPayable.new()).address
    const sovToken = await sovTokenTester.new()
    await stabilityPool.setAddresses(sovToken.address, dumbContractAddress, dumbContractAddress, dumbContractAddress, mockActivePoolAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress, dumbContractAddress)
  })

  let revertToSnapshot;

  beforeEach(async() => {
    let snapshot = await timeMachine.takeSnapshot();
    revertToSnapshot = () => timeMachine.revertToSnapshot(snapshot['result'])
  });

  afterEach(async() => {
    await revertToSnapshot();
  });

  it('getSOV(): gets the recorded SOV balance', async () => {
    const recordedSOVBalance = await stabilityPool.getSOV()
    assert.equal(recordedSOVBalance, 0)
  })

  it('getTotalZSUSDDeposits(): gets the recorded ZSUSD balance', async () => {
    const recordedETHBalance = await stabilityPool.getTotalZSUSDDeposits()
    assert.equal(recordedETHBalance, 0)
  })
})

contract('ActivePool', async accounts => {

  let activePool, mockBorrowerOperations
  let sovToken

  const [owner, alice] = accounts;
  beforeEach(async () => {
    activePool = await ActivePool.new()
    mockBorrowerOperations = await NonPayable.new()
    const dumbContractAddress = (await NonPayable.new()).address
    sovToken = await sovTokenTester.new()
    await activePool.setAddresses(sovToken.address, mockBorrowerOperations.address, dumbContractAddress, dumbContractAddress, dumbContractAddress)
  })

  it('getSOV(): gets the recorded SOV balance', async () => {
    const recordedSOVBalance = await activePool.getSOV()
    assert.equal(recordedSOVBalance, 0)
  })

  it('getZSUSDDebt(): gets the recorded ZSUSD balance', async () => {
    const recordedETHBalance = await activePool.getZSUSDDebt()
    assert.equal(recordedETHBalance, 0)
  })
 
  it('increaseZSUSD(): increases the recorded ZSUSD balance by the correct amount', async () => {
    const recordedZSUSD_balanceBefore = await activePool.getZSUSDDebt()
    assert.equal(recordedZSUSD_balanceBefore, 0)

    // await activePool.increaseZSUSDDebt(100, { from: mockBorrowerOperationsAddress })
    const increaseZSUSDDebtData = th.getTransactionData('increaseZSUSDDebt(uint256)', ['0x64'])
    const tx = await mockBorrowerOperations.forward(activePool.address, increaseZSUSDDebtData)
    assert.isTrue(tx.receipt.status)
    const recordedZSUSD_balanceAfter = await activePool.getZSUSDDebt()
    assert.equal(recordedZSUSD_balanceAfter, 100)
  })
  // Decrease
  it('decreaseZSUSD(): decreases the recorded ZSUSD balance by the correct amount', async () => {
    // start the pool on 100 wei
    //await activePool.increaseZSUSDDebt(100, { from: mockBorrowerOperationsAddress })
    const increaseZSUSDDebtData = th.getTransactionData('increaseZSUSDDebt(uint256)', ['0x64'])
    const tx1 = await mockBorrowerOperations.forward(activePool.address, increaseZSUSDDebtData)
    assert.isTrue(tx1.receipt.status)

    const recordedZSUSD_balanceBefore = await activePool.getZSUSDDebt()
    assert.equal(recordedZSUSD_balanceBefore, 100)

    //await activePool.decreaseZSUSDDebt(100, { from: mockBorrowerOperationsAddress })
    const decreaseZSUSDDebtData = th.getTransactionData('decreaseZSUSDDebt(uint256)', ['0x64'])
    const tx2 = await mockBorrowerOperations.forward(activePool.address, decreaseZSUSDDebtData)
    assert.isTrue(tx2.receipt.status)
    const recordedZSUSD_balanceAfter = await activePool.getZSUSDDebt()
    assert.equal(recordedZSUSD_balanceAfter, 0)
  })

  // send raw ether
  it('sendSOV(): decreases the recorded SOV balance by the correct amount', async () => {
    // setup: give pool 2 SOV
    const activePool_initialBalance = await sovToken.balanceOf(activePool.address)
    assert.equal(activePool_initialBalance, 0)
    // start pool with 2 SOV
    const tx1 = await sovToken.transfer(activePool.address, dec(2, 'ether'))
    assert.isTrue(tx1.receipt.status)

    const activePool_BalanceBeforeTx = await sovToken.balanceOf(activePool.address)
    const alice_Balance_BeforeTx = await sovToken.balanceOf(alice)

    assert.equal(activePool_BalanceBeforeTx, dec(2, 'ether'))

    // send SOV from pool to alice
    const sendSOVData = th.getTransactionData('sendSOV(address,uint256)', [alice, web3.utils.toHex(dec(1, 'ether'))])
    const tx2 = await mockBorrowerOperations.forward(activePool.address, sendSOVData, { from: owner })
    assert.isTrue(tx2.receipt.status)

    const activePool_BalanceAfterTx = await sovToken.balanceOf(activePool.address)
    const alice_Balance_AfterTx = await sovToken.balanceOf(alice)

    const alice_BalanceChange = alice_Balance_AfterTx.sub(alice_Balance_BeforeTx)
    const pool_BalanceChange = activePool_BalanceAfterTx.sub(activePool_BalanceBeforeTx)
    assert.equal(alice_BalanceChange, dec(1, 'ether'))
    assert.equal(pool_BalanceChange, _minus_1_Ether)
  })
})

contract('DefaultPool', async accounts => {
 
  let defaultPool, mockTroveManager, mockActivePool
  let sovToken

  const [owner, alice] = accounts;
  beforeEach(async () => {
    defaultPool = await DefaultPool.new()
    mockTroveManager = await NonPayable.new()
    mockActivePool = await NonPayable.new()
    sovToken = await sovTokenTester.new()
    await defaultPool.setAddresses(sovToken.address, mockTroveManager.address, mockActivePool.address)
  })

  it('getSOV(): gets the recorded ZSUSD balance', async () => {
    const recordedETHBalance = await defaultPool.getSOV()
    assert.equal(recordedETHBalance, 0)
  })

  it('getZSUSDDebt(): gets the recorded ZSUSD balance', async () => {
    const recordedETHBalance = await defaultPool.getZSUSDDebt()
    assert.equal(recordedETHBalance, 0)
  })
 
  it('increaseZSUSD(): increases the recorded ZSUSD balance by the correct amount', async () => {
    const recordedZSUSD_balanceBefore = await defaultPool.getZSUSDDebt()
    assert.equal(recordedZSUSD_balanceBefore, 0)

    // await defaultPool.increaseZSUSDDebt(100, { from: mockTroveManagerAddress })
    const increaseZSUSDDebtData = th.getTransactionData('increaseZSUSDDebt(uint256)', ['0x64'])
    const tx = await mockTroveManager.forward(defaultPool.address, increaseZSUSDDebtData)
    assert.isTrue(tx.receipt.status)

    const recordedZSUSD_balanceAfter = await defaultPool.getZSUSDDebt()
    assert.equal(recordedZSUSD_balanceAfter, 100)
  })
  
  it('decreaseZSUSD(): decreases the recorded ZSUSD balance by the correct amount', async () => {
    // start the pool on 100 wei
    //await defaultPool.increaseZSUSDDebt(100, { from: mockTroveManagerAddress })
    const increaseZSUSDDebtData = th.getTransactionData('increaseZSUSDDebt(uint256)', ['0x64'])
    const tx1 = await mockTroveManager.forward(defaultPool.address, increaseZSUSDDebtData)
    assert.isTrue(tx1.receipt.status)

    const recordedZSUSD_balanceBefore = await defaultPool.getZSUSDDebt()
    assert.equal(recordedZSUSD_balanceBefore, 100)

    // await defaultPool.decreaseZSUSDDebt(100, { from: mockTroveManagerAddress })
    const decreaseZSUSDDebtData = th.getTransactionData('decreaseZSUSDDebt(uint256)', ['0x64'])
    const tx2 = await mockTroveManager.forward(defaultPool.address, decreaseZSUSDDebtData)
    assert.isTrue(tx2.receipt.status)

    const recordedZSUSD_balanceAfter = await defaultPool.getZSUSDDebt()
    assert.equal(recordedZSUSD_balanceAfter, 0)
  })

  // send raw ether
  it('sendSOVToActivePool(): decreases the recorded SOV balance by the correct amount', async () => {
    // setup: give pool 2 SOV
    const defaultPool_initialBalance = await sovToken.balanceOf(defaultPool.address)
    assert.equal(defaultPool_initialBalance, 0)

    // start pool with 2 SOV
    const tx1 = await sovToken.transfer(defaultPool.address,dec(2, 'ether'))
    assert.isTrue(tx1.receipt.status)

    const defaultPool_BalanceBeforeTx = await sovToken.balanceOf(defaultPool.address)
    const activePool_Balance_BeforeTx = await sovToken.balanceOf(mockActivePool.address)

    assert.equal(defaultPool_BalanceBeforeTx, dec(2, 'ether'))

    // send ether from pool to alice
    const sendSOVData = th.getTransactionData('sendSOVToActivePool(uint256)', [web3.utils.toHex(dec(1, 'ether'))])
    await mockActivePool.setPayable(true)
    const tx2 = await mockTroveManager.forward(defaultPool.address, sendSOVData, { from: owner })
    assert.isTrue(tx2.receipt.status)

    const defaultPool_BalanceAfterTx = await sovToken.balanceOf(defaultPool.address)
    const activePool_Balance_AfterTx = await sovToken.balanceOf(mockActivePool.address)


    const activePool_BalanceChange = activePool_Balance_AfterTx.sub(activePool_Balance_BeforeTx)
    const defaultPool_BalanceChange = defaultPool_BalanceAfterTx.sub(defaultPool_BalanceBeforeTx)
    assert.equal(activePool_BalanceChange, dec(1, 'ether'))
    assert.equal(defaultPool_BalanceChange, _minus_1_Ether)
  })
})

contract('Reset chain state', async accounts => {})
