const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")
const timeMachine = require('ganache-time-traveler');

const ZEROStakingTester = artifacts.require('ZEROStakingTester')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const NonPayable = artifacts.require("./NonPayable.sol")

const th = testHelpers.TestHelper
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues
const dec = th.dec
const assertRevert = th.assertRevert

const toBN = th.toBN
const ZERO = th.toBN('0')

/* NOTE: These tests do not test for specific SOV and ZSUSD gain values. They only test that the 
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake. 
 *
 * Specific SOV/ZSUSD gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTOR in the TroveManager, which are still TBD based on economic
 * modelling.
 * 
 */ 

contract('ZEROStaking revenue share tests', async accounts => {

  const multisig = accounts[999];
  
  const [owner, A, B, C, D, E, F, G, whale, sovFeeCollector] = accounts;

  let priceFeed
  let zsusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let zeroStaking
  let zeroToken

  let contracts

  let sovToken

  const openTrove = async (params) => th.openTrove(contracts, params)

  before(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployZSUSDTokenTester(contracts)
    const ZEROContracts = await deploymentHelper.deployZEROTesterContractsHardhat(multisig)
    
    await ZEROContracts.zeroToken.unprotectedMint(multisig,toBN(dec(20,24)))

    await deploymentHelper.connectZEROContracts(ZEROContracts)
    await deploymentHelper.connectCoreContracts(contracts, ZEROContracts)
    await deploymentHelper.connectZEROContractsToCore(ZEROContracts, contracts, owner)

    nonPayable = await NonPayable.new() 
    priceFeed = contracts.priceFeedTestnet
    zsusdToken = contracts.zsusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers
    sovToken = contracts.sovTokenTester

    zeroToken = ZEROContracts.zeroToken
    zeroStaking = ZEROContracts.zeroStaking

    for (account of accounts.slice(0, 30)) {
      await sovToken.transfer(account, toBN(dec(10000,30)))
    }
  })

  let revertToSnapshot;

  beforeEach(async() => {
    let snapshot = await timeMachine.takeSnapshot();
    revertToSnapshot = () => timeMachine.revertToSnapshot(snapshot['result'])
  });

  afterEach(async() => {
    await revertToSnapshot();
  });

  it('stake(): reverts if amount is zero', async () => {
    // FF time one year so owner can transfer ZERO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers ZERO to staker A
    await zeroToken.transfer(A, dec(100, 18), {from: multisig})

    // console.log(`A zero bal: ${await zeroToken.balanceOf(A)}`)

    // A makes stake
    await zeroToken.approve(zeroStaking.address, dec(100, 18), {from: A})
    await assertRevert(zeroStaking.stake(0, {from: A}), "ZEROStaking: Amount must be non-zero")
  })

  it("SOV fee per ZERO staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extraZSUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraZSUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraZSUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraZSUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

    // FF time one year so owner can transfer ZERO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers ZERO to staker A
    await zeroToken.transfer(A, dec(100, 18), {from: multisig})

    // console.log(`A zero bal: ${await zeroToken.balanceOf(A)}`)

    // A makes stake
    await zeroToken.approve(zeroStaking.address, dec(100, 18), {from: A})
    await zeroStaking.stake(dec(100, 18), {from: A})

    // Check SOV fee per unit staked is zero
    const F_SOV_Before = await zeroStaking.F_SOV()
    assert.equal(F_SOV_Before, '0')

    const B_BalBeforeREdemption = await zsusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await zsusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check SOV fee emitted in event is non-zero
    const emittedSOVFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedSOVFee.gt(toBN('0')))

    // Check SOV fee per unit staked has increased by correct amount
    const F_SOV_After = await zeroStaking.F_SOV()

    // Expect fee per unit staked = fee/100, since there is 100 ZSUSD totalStaked
    // 100% sent to SovFeeCollector address
    const ethFeeToSovCollector = emittedSOVFee
    const ethFeeToZeroStalking = emittedSOVFee.sub(ethFeeToSovCollector)
    const expected_F_SOV_After = ethFeeToZeroStalking.div(toBN('100')) 

    assert.isTrue(expected_F_SOV_After.eq(F_SOV_After))
  })

  it("SOV fee per ZERO staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extraZSUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraZSUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraZSUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraZSUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraZSUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer ZERO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers ZERO to staker A
    await zeroToken.transfer(A, dec(100, 18), {from: multisig})

    // Check SOV fee per unit staked is zero
    const F_SOV_Before = await zeroStaking.F_SOV()
    assert.equal(F_SOV_Before, '0')

    const B_BalBeforeREdemption = await zsusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await zsusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check SOV fee emitted in event is non-zero
    const emittedSOVFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedSOVFee.gt(toBN('0')))

    // Check SOV fee per unit staked has not increased 
    const F_SOV_After = await zeroStaking.F_SOV()
    assert.equal(F_SOV_After, '0')
  })

  it("ZSUSD fee per ZERO staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extraZSUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraZSUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraZSUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraZSUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraZSUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer ZERO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers ZERO to staker A
    await zeroToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await zeroToken.approve(zeroStaking.address, dec(100, 18), {from: A})
    await zeroStaking.stake(dec(100, 18), {from: A})

    // Check ZSUSD fee per unit staked is zero
    const F_ZSUSD_Before = await zeroStaking.F_SOV()
    assert.equal(F_ZSUSD_Before, '0')

    const B_BalBeforeREdemption = await zsusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await zsusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawZSUSD(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check ZSUSD fee value in event is non-zero
    const emittedZSUSDFee = toBN(th.getZSUSDFeeFromZSUSDBorrowingEvent(tx))
    assert.isTrue(emittedZSUSDFee.gt(toBN('0')))
    
    // Check ZSUSD fee per unit staked has increased by correct amount
    const F_ZSUSD_After = await zeroStaking.F_ZSUSD()

    // Expect fee per unit staked = fee/100, since there is 100 ZSUSD totalStaked
    // 100% sent to SovFeeCollector address
    const zsusdFeeToSovCollector = emittedZSUSDFee
    const zsusdFeeToZeroStalking = emittedZSUSDFee.sub(zsusdFeeToSovCollector)
    const expected_F_ZSUSD_After = zsusdFeeToZeroStalking.div(toBN('100')) 

    assert.isTrue(expected_F_ZSUSD_After.eq(F_ZSUSD_After))
  })

  it("ZSUSD fee per ZERO staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extraZSUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraZSUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraZSUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraZSUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraZSUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer ZERO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers ZERO to staker A
    await zeroToken.transfer(A, dec(100, 18), {from: multisig})

    // Check ZSUSD fee per unit staked is zero
    const F_ZSUSD_Before = await zeroStaking.F_SOV()
    assert.equal(F_ZSUSD_Before, '0')

    const B_BalBeforeREdemption = await zsusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await zsusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawZSUSD(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check ZSUSD fee value in event is non-zero
    const emittedZSUSDFee = toBN(th.getZSUSDFeeFromZSUSDBorrowingEvent(tx))
    assert.isTrue(emittedZSUSDFee.gt(toBN('0')))
    
    // Check ZSUSD fee per unit staked did not increase, is still zero
    const F_ZSUSD_After = await zeroStaking.F_ZSUSD()
    assert.equal(F_ZSUSD_After, '0')
  })

  it("ZERO Staking: A single staker earns all SOV and ZERO fees that occur", async () => {
    await openTrove({ extraZSUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraZSUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraZSUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraZSUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraZSUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer ZERO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers ZERO to staker A
    await zeroToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await zeroToken.approve(zeroStaking.address, dec(100, 18), {from: A})
    await zeroStaking.stake(dec(100, 18), {from: A})

    const B_BalBeforeREdemption = await zsusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await zsusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check SOV fee 1 emitted in event is non-zero
    const emittedSOVFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedSOVFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await zsusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await zsusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check SOV fee 2 emitted in event is non-zero
     const emittedSOVFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedSOVFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawZSUSD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check ZSUSD fee value in event is non-zero
    const emittedZSUSDFee_1 = toBN(th.getZSUSDFeeFromZSUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedZSUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawZSUSD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check ZSUSD fee value in event is non-zero
    const emittedZSUSDFee_2 = toBN(th.getZSUSDFeeFromZSUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedZSUSDFee_2.gt(toBN('0')))

    // 100% sent to SovFeeCollector address
    const ethFeeToSovCollector_1 = emittedSOVFee_1
    const ethFeeToZeroStalking_1 = emittedSOVFee_1.sub(ethFeeToSovCollector_1)
    const ethFeeToSovCollector_2 = emittedSOVFee_2
    const rethFeeToZeroStalking_2 = emittedSOVFee_2.sub(ethFeeToSovCollector_2)
    const expectedTotalSOVGain = ethFeeToZeroStalking_1.add(rethFeeToZeroStalking_2)

    // 100% sent to SovFeeCollector address
    const zsusdFeeToSovCollector_1 = emittedZSUSDFee_1
    const zsusdFeeToZeroStalking_1 = emittedZSUSDFee_1.sub(zsusdFeeToSovCollector_1)
    const zsusdFeeToSovCollector_2 = emittedZSUSDFee_2
    const zsusdFeeToZeroStalking_2 = emittedZSUSDFee_2.sub(zsusdFeeToSovCollector_2)
    const expectedTotalZSUSDGain = zsusdFeeToZeroStalking_1.add(zsusdFeeToZeroStalking_2)

    const A_SOVBalance_Before = await sovToken.balanceOf(A)
    const A_ZSUSDBalance_Before = toBN(await zsusdToken.balanceOf(A))

    // A un-stakes
    await zeroStaking.unstake(dec(100, 18), {from: A, gasPrice: 0})

    const A_SOVBalance_After = await sovToken.balanceOf(A)
    const A_ZSUSDBalance_After = toBN(await zsusdToken.balanceOf(A))


    const A_SOVGain = A_SOVBalance_After.sub(A_SOVBalance_Before)
    const A_ZSUSDGain = A_ZSUSDBalance_After.sub(A_ZSUSDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalSOVGain, A_SOVGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalZSUSDGain, A_ZSUSDGain), 1000)
  })

  it("stake(): Top-up sends out all accumulated SOV and ZSUSD gains to the staker", async () => { 
    await openTrove({ extraZSUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraZSUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraZSUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraZSUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraZSUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer ZERO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers ZERO to staker A
    await zeroToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await zeroToken.approve(zeroStaking.address, dec(100, 18), {from: A})
    await zeroStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await zsusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await zsusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check SOV fee 1 emitted in event is non-zero
    const emittedSOVFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedSOVFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await zsusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await zsusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check SOV fee 2 emitted in event is non-zero
     const emittedSOVFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedSOVFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawZSUSD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check ZSUSD fee value in event is non-zero
    const emittedZSUSDFee_1 = toBN(th.getZSUSDFeeFromZSUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedZSUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawZSUSD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check ZSUSD fee value in event is non-zero
    const emittedZSUSDFee_2 = toBN(th.getZSUSDFeeFromZSUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedZSUSDFee_2.gt(toBN('0')))


    // 100% sent to SovFeeCollector address
    const ethFeeToSovCollector_1 = emittedSOVFee_1
    const ethFeeToZeroStalking_1 = emittedSOVFee_1.sub(ethFeeToSovCollector_1)
    const ethFeeToSovCollector_2 = emittedSOVFee_2
    const ethFeeToZeroStalking_2 = emittedSOVFee_2.sub(ethFeeToSovCollector_2)
    const expectedTotalSOVGain = ethFeeToZeroStalking_1.add(ethFeeToZeroStalking_2)

    // 100% sent to SovFeeCollector address
    const zsusdFeeToSovCollector_1 = emittedZSUSDFee_1
    const zsusdFeeToZeroStalking_1 = emittedZSUSDFee_1.sub(zsusdFeeToSovCollector_1)
    const zsusdDFeeToSovCollector_2 = emittedZSUSDFee_2
    const zsusdFeeToZeroStalking_2 = emittedZSUSDFee_2.sub(zsusdDFeeToSovCollector_2)
    const expectedTotalZSUSDGain = zsusdFeeToZeroStalking_1.add(zsusdFeeToZeroStalking_2)

    const A_SOVBalance_Before = await sovToken.balanceOf(A)
    const A_ZSUSDBalance_Before = toBN(await zsusdToken.balanceOf(A))

    // A tops up
    await zeroStaking.stake(dec(50, 18), {from: A, gasPrice: 0})

    const A_SOVBalance_After = await sovToken.balanceOf(A)
    const A_ZSUSDBalance_After = toBN(await zsusdToken.balanceOf(A))

    const A_SOVGain = A_SOVBalance_After.sub(A_SOVBalance_Before)
    const A_ZSUSDGain = A_ZSUSDBalance_After.sub(A_ZSUSDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalSOVGain, A_SOVGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalZSUSDGain, A_ZSUSDGain), 1000)
  })

  it("getPendingSOVGain(): Returns the staker's correct pending SOV gain", async () => { 
    await openTrove({ extraZSUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraZSUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraZSUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraZSUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraZSUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer ZERO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers ZERO to staker A
    await zeroToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await zeroToken.approve(zeroStaking.address, dec(100, 18), {from: A})
    await zeroStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await zsusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await zsusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check SOV fee 1 emitted in event is non-zero
    const emittedSOVFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedSOVFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await zsusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await zsusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check SOV fee 2 emitted in event is non-zero
     const emittedSOVFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedSOVFee_2.gt(toBN('0')))

    // 100% sent to SovFeeCollector address
    const ethFeeToSovCollector_1 = emittedSOVFee_1
    const ethFeeToZeroStalking_1 = emittedSOVFee_1.sub(ethFeeToSovCollector_1)
    const ethFeeToSovCollector_2 = emittedSOVFee_2
    const ethFeeToZeroStalking_2 = emittedSOVFee_2.sub(ethFeeToSovCollector_2)
    const expectedTotalSOVGain = ethFeeToZeroStalking_1.add(ethFeeToZeroStalking_2)

    const A_SOVGain = await zeroStaking.getPendingSOVGain(A)

    assert.isAtMost(th.getDifference(expectedTotalSOVGain, A_SOVGain), 1000)
  })

  it("getPendingZSUSDGain(): Returns the staker's correct pending ZSUSD gain", async () => { 
    await openTrove({ extraZSUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraZSUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraZSUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraZSUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraZSUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer ZERO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers ZERO to staker A
    await zeroToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await zeroToken.approve(zeroStaking.address, dec(100, 18), {from: A})
    await zeroStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await zsusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18))
    
    const B_BalAfterRedemption = await zsusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check SOV fee 1 emitted in event is non-zero
    const emittedSOVFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedSOVFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await zsusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18))
    
    const C_BalAfterRedemption = await zsusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check SOV fee 2 emitted in event is non-zero
     const emittedSOVFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedSOVFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawZSUSD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check ZSUSD fee value in event is non-zero
    const emittedZSUSDFee_1 = toBN(th.getZSUSDFeeFromZSUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedZSUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawZSUSD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check ZSUSD fee value in event is non-zero
    const emittedZSUSDFee_2 = toBN(th.getZSUSDFeeFromZSUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedZSUSDFee_2.gt(toBN('0')))

    // 100% sent to SovFeeCollector address
    const zsusdFeeToSovCollector_1 = emittedZSUSDFee_1
    const zsusdFeeToZeroStalking_1 = emittedZSUSDFee_1.sub(zsusdFeeToSovCollector_1)
    const zsusdDFeeToSovCollector_2 = emittedZSUSDFee_2
    const zsusdFeeToZeroStalking_2 = emittedZSUSDFee_2.sub(zsusdDFeeToSovCollector_2)
    const expectedTotalZSUSDGain = zsusdFeeToZeroStalking_1.add(zsusdFeeToZeroStalking_2)
    const A_ZSUSDGain = await zeroStaking.getPendingZSUSDGain(A)

    assert.isAtMost(th.getDifference(expectedTotalZSUSDGain, A_ZSUSDGain), 1000)
  })

  // - multi depositors, several rewards
  it("ZERO Staking: Multiple stakers earn the correct share of all SOV and ZERO fees, based on their stake size", async () => {
    await openTrove({ extraZSUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraZSUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraZSUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraZSUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraZSUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    await openTrove({ extraZSUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
    await openTrove({ extraZSUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })
    await openTrove({ extraZSUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: G } })

    // FF time one year so owner can transfer ZERO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers ZERO to staker A, B, C
    await zeroToken.transfer(A, dec(100, 18), {from: multisig})
    await zeroToken.transfer(B, dec(200, 18), {from: multisig})
    await zeroToken.transfer(C, dec(300, 18), {from: multisig})

    // A, B, C make stake
    await zeroToken.approve(zeroStaking.address, dec(100, 18), {from: A})
    await zeroToken.approve(zeroStaking.address, dec(200, 18), {from: B})
    await zeroToken.approve(zeroStaking.address, dec(300, 18), {from: C})
    await zeroStaking.stake(dec(100, 18), {from: A})
    await zeroStaking.stake(dec(200, 18), {from: B})
    await zeroStaking.stake(dec(300, 18), {from: C})

    // Confirm staking contract holds 600 ZERO
    // console.log(`zero staking ZERO bal: ${await zeroToken.balanceOf(zeroStaking.address)}`)
    assert.equal(await zeroToken.balanceOf(zeroStaking.address), dec(600, 18))
    assert.equal(await zeroStaking.totalZEROStaked(), dec(600, 18))

    // F redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(F, contracts, dec(45, 18))
    const emittedSOVFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedSOVFee_1.gt(toBN('0')))

     // G redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(G, contracts, dec(197, 18))
     const emittedSOVFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedSOVFee_2.gt(toBN('0')))

    // F draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawZSUSD(th._100pct, dec(104, 18), F, F, {from: F})
    const emittedZSUSDFee_1 = toBN(th.getZSUSDFeeFromZSUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedZSUSDFee_1.gt(toBN('0')))

    // G draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawZSUSD(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedZSUSDFee_2 = toBN(th.getZSUSDFeeFromZSUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedZSUSDFee_2.gt(toBN('0')))

    // D obtains ZERO from owner and makes a stake
    await zeroToken.transfer(D, dec(50, 18), {from: multisig})
    await zeroToken.approve(zeroStaking.address, dec(50, 18), {from: D})
    await zeroStaking.stake(dec(50, 18), {from: D})

    // Confirm staking contract holds 650 ZERO
    assert.equal(await zeroToken.balanceOf(zeroStaking.address), dec(650, 18))
    assert.equal(await zeroStaking.totalZEROStaked(), dec(650, 18))

     // G redeems
     const redemptionTx_3 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(197, 18))
     const emittedSOVFee_3 = toBN((await th.getEmittedRedemptionValues(redemptionTx_3))[3])
     assert.isTrue(emittedSOVFee_3.gt(toBN('0')))

     // G draws debt
    const borrowingTx_3 = await borrowerOperations.withdrawZSUSD(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedZSUSDFee_3 = toBN(th.getZSUSDFeeFromZSUSDBorrowingEvent(borrowingTx_3))
    assert.isTrue(emittedZSUSDFee_3.gt(toBN('0')))
     
    /*  
    Expected rewards:

    A_SOV: (100* SOVFee_1)/600 + (100* SOVFee_2)/600 + (100*SOV_Fee_3)/650
    B_SOV: (200* SOVFee_1)/600 + (200* SOVFee_2)/600 + (200*SOV_Fee_3)/650
    C_SOV: (300* SOVFee_1)/600 + (300* SOVFee_2)/600 + (300*SOV_Fee_3)/650
    D_SOV:                                             (100*SOV_Fee_3)/650

    A_ZSUSD: (100*ZSUSDFee_1 )/600 + (100* ZSUSDFee_2)/600 + (100*ZSUSDFee_3)/650
    B_ZSUSD: (200* ZSUSDFee_1)/600 + (200* ZSUSDFee_2)/600 + (200*ZSUSDFee_3)/650
    C_ZSUSD: (300* ZSUSDFee_1)/600 + (300* ZSUSDFee_2)/600 + (300*ZSUSDFee_3)/650
    D_ZSUSD:                                               (100*ZSUSDFee_3)/650
    */

    // Expected SOV gains

    // 100% sent to SovFeeCollector address
    const ethFeeToSovCollector_1 = emittedSOVFee_1
    const ethFeeToZeroStalking_1 = emittedSOVFee_1.sub(ethFeeToSovCollector_1)
    const ethFeeToSovCollector_2 = emittedSOVFee_2
    const ethFeeToZeroStalking_2 = emittedSOVFee_2.sub(ethFeeToSovCollector_2)
    const ethFeeToSovCollector_3 = emittedSOVFee_3
    const ethFeeToZeroStalking_3 = emittedSOVFee_3.sub(ethFeeToSovCollector_3)
    const expectedSOVGain_A = toBN('100').mul(ethFeeToZeroStalking_1).div( toBN('600'))
                            .add(toBN('100').mul(ethFeeToZeroStalking_2).div( toBN('600')))
                            .add(toBN('100').mul(ethFeeToZeroStalking_3).div( toBN('650')))

    const expectedSOVGain_B = toBN('200').mul(ethFeeToZeroStalking_1).div( toBN('600'))
                            .add(toBN('200').mul(ethFeeToZeroStalking_2).div( toBN('600')))
                            .add(toBN('200').mul(ethFeeToZeroStalking_3).div( toBN('650')))

    const expectedSOVGain_C = toBN('300').mul(ethFeeToZeroStalking_1).div( toBN('600'))
                            .add(toBN('300').mul(ethFeeToZeroStalking_2).div( toBN('600')))
                            .add(toBN('300').mul(ethFeeToZeroStalking_3).div( toBN('650')))

    const expectedSOVGain_D = toBN('50').mul(ethFeeToZeroStalking_3).div( toBN('650'))

    // Expected ZSUSD gains:

    // 100% sent to SovFeeCollector address
    const zsusdFeeToSovCollector_1 = emittedZSUSDFee_1
    const zsusdFeeToZeroStalking_1 = emittedZSUSDFee_1.sub(zsusdFeeToSovCollector_1)
    const zsusdFeeToSovCollector_2 = emittedZSUSDFee_2
    const zsusdFeeToZeroStalking_2 = emittedZSUSDFee_2.sub(zsusdFeeToSovCollector_2)
    const zsusdFeeToSovCollector_3 = emittedZSUSDFee_3
    const zsusdFeeToZeroStalking_3 = emittedZSUSDFee_3.sub(zsusdFeeToSovCollector_3)
    const expectedZSUSDGain_A = toBN('100').mul(zsusdFeeToZeroStalking_1).div( toBN('600'))
                            .add(toBN('100').mul(zsusdFeeToZeroStalking_2).div( toBN('600')))
                            .add(toBN('100').mul(zsusdFeeToZeroStalking_3).div( toBN('650')))

    const expectedZSUSDGain_B = toBN('200').mul(zsusdFeeToZeroStalking_1).div( toBN('600'))
                            .add(toBN('200').mul(zsusdFeeToZeroStalking_2).div( toBN('600')))
                            .add(toBN('200').mul(zsusdFeeToZeroStalking_3).div( toBN('650')))

    const expectedZSUSDGain_C = toBN('300').mul(zsusdFeeToZeroStalking_1).div( toBN('600'))
                            .add(toBN('300').mul(zsusdFeeToZeroStalking_2).div( toBN('600')))
                            .add(toBN('300').mul(zsusdFeeToZeroStalking_3).div( toBN('650')))
    
    const expectedZSUSDGain_D = toBN('50').mul(zsusdFeeToZeroStalking_3).div( toBN('650'))


    const A_SOVBalance_Before = await sovToken.balanceOf(A)
    const A_ZSUSDBalance_Before = toBN(await zsusdToken.balanceOf(A))
    const B_SOVBalance_Before = await sovToken.balanceOf(B)
    const B_ZSUSDBalance_Before = toBN(await zsusdToken.balanceOf(B))
    const C_SOVBalance_Before = await sovToken.balanceOf(C)
    const C_ZSUSDBalance_Before = toBN(await zsusdToken.balanceOf(C))
    const D_SOVBalance_Before = await sovToken.balanceOf(D)
    const D_ZSUSDBalance_Before = toBN(await zsusdToken.balanceOf(D))

    // A-D un-stake
    const unstake_A = await zeroStaking.unstake(dec(100, 18), {from: A, gasPrice: 0})
    const unstake_B = await zeroStaking.unstake(dec(200, 18), {from: B, gasPrice: 0})
    const unstake_C = await zeroStaking.unstake(dec(400, 18), {from: C, gasPrice: 0})
    const unstake_D = await zeroStaking.unstake(dec(50, 18), {from: D, gasPrice: 0})

    // Confirm all depositors could withdraw

    //Confirm pool Size is now 0
    assert.equal((await zeroToken.balanceOf(zeroStaking.address)), '0')
    assert.equal((await zeroStaking.totalZEROStaked()), '0')

    // Get A-D SOV and ZSUSD balances
    const A_SOVBalance_After = await sovToken.balanceOf(A)
    const A_ZSUSDBalance_After = toBN(await zsusdToken.balanceOf(A))
    const B_SOVBalance_After = await sovToken.balanceOf(B)
    const B_ZSUSDBalance_After = toBN(await zsusdToken.balanceOf(B))
    const C_SOVBalance_After = await sovToken.balanceOf(C)
    const C_ZSUSDBalance_After = toBN(await zsusdToken.balanceOf(C))
    const D_SOVBalance_After = await sovToken.balanceOf(D)
    const D_ZSUSDBalance_After = toBN(await zsusdToken.balanceOf(D))

    // Get SOV and ZSUSD gains
    const A_SOVGain = A_SOVBalance_After.sub(A_SOVBalance_Before)
    const A_ZSUSDGain = A_ZSUSDBalance_After.sub(A_ZSUSDBalance_Before)
    const B_SOVGain = B_SOVBalance_After.sub(B_SOVBalance_Before)
    const B_ZSUSDGain = B_ZSUSDBalance_After.sub(B_ZSUSDBalance_Before)
    const C_SOVGain = C_SOVBalance_After.sub(C_SOVBalance_Before)
    const C_ZSUSDGain = C_ZSUSDBalance_After.sub(C_ZSUSDBalance_Before)
    const D_SOVGain = D_SOVBalance_After.sub(D_SOVBalance_Before)
    const D_ZSUSDGain = D_ZSUSDBalance_After.sub(D_ZSUSDBalance_Before)

    // Check gains match expected amounts
    assert.isAtMost(th.getDifference(expectedSOVGain_A, A_SOVGain), 1000)
    assert.isAtMost(th.getDifference(expectedZSUSDGain_A, A_ZSUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedSOVGain_B, B_SOVGain), 1000)
    assert.isAtMost(th.getDifference(expectedZSUSDGain_B, B_ZSUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedSOVGain_C, C_SOVGain), 1000)
    assert.isAtMost(th.getDifference(expectedZSUSDGain_C, C_ZSUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedSOVGain_D, D_SOVGain), 1000)
    assert.isAtMost(th.getDifference(expectedZSUSDGain_D, D_ZSUSDGain), 1000)
  })

  it("receive(): reverts when it receives SOV from an address that is not the Active Pool",  async () => { 
    const ethSendTxPromise1 = web3.eth.sendTransaction({to: zeroStaking.address, from: A, value: dec(1, 'ether')})
    const ethSendTxPromise2 = web3.eth.sendTransaction({to: zeroStaking.address, from: owner, value: dec(1, 'ether')})

    await assertRevert(ethSendTxPromise1)
    await assertRevert(ethSendTxPromise2)
  })

  it("unstake(): reverts if user has no stake",  async () => {  
    const unstakeTxPromise1 = zeroStaking.unstake(1, {from: A})
    const unstakeTxPromise2 = zeroStaking.unstake(1, {from: owner})

    await assertRevert(unstakeTxPromise1)
    await assertRevert(unstakeTxPromise2)
  })

  it('Test requireCallerIsTroveManager', async () => {
    const zeroStakingTester = await ZEROStakingTester.new()
    await assertRevert(zeroStakingTester.requireCallerIsFeeDistributor(), 'ZEROStaking: caller is not FeeDistributor')
  })
})
