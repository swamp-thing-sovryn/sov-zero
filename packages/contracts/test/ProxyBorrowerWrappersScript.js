const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const timeMachine = require('ganache-time-traveler');

const TroveManagerTester = artifacts.require("TroveManagerTester")
const ZEROTokenTester = artifacts.require("ZEROTokenTester")

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const ZERO_ADDRESS = th.ZERO_ADDRESS
const assertRevert = th.assertRevert

const {
  buildUserProxies,
  BorrowerOperationsProxy,
  BorrowerWrappersProxy,
  TroveManagerProxy,
  StabilityPoolProxy,
  SortedTrovesProxy,
  TokenProxy,
  ZEROStakingProxy
} = require('../utils/proxyHelpers.js')

contract('BorrowerWrappers', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E,
    defaulter_1, defaulter_2,
    // frontEnd_1, frontEnd_2, frontEnd_3
  ] = accounts;

  const multisig = accounts[999];

  let priceFeed
  let zusdToken
  let sortedTroves
  let troveManagerOriginal
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let collSurplusPool
  let borrowerOperations
  let borrowerWrappers
  let zeroTokenOriginal
  let zeroToken
  let zeroStaking
  let wrbtcToken
  let sovFeeCollector
  let sovToken

  let contracts

  let ZUSD_GAS_COMPENSATION

  const getOpenTroveZUSDAmount = async (totalDebt) => th.getOpenTroveZUSDAmount(contracts, totalDebt)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts)
  const getNetBorrowingAmount = async (debtWithFee) => th.getNetBorrowingAmount(contracts, debtWithFee)
  const openTrove = async (params) => th.openTrove(contracts, params)

  before(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployZUSDToken(contracts)
    const ZEROContracts = await deploymentHelper.deployZEROTesterContractsHardhat(multisig)

    await deploymentHelper.connectZEROContracts(ZEROContracts)
    await deploymentHelper.connectCoreContracts(contracts, ZEROContracts)
    await deploymentHelper.connectZEROContractsToCore(ZEROContracts, contracts, owner)

    await ZEROContracts.zeroToken.unprotectedMint(owner,toBN(dec(30,24)))
    await ZEROContracts.zeroToken.approve(ZEROContracts.communityIssuance.address, toBN(dec(30,24)))
    await ZEROContracts.communityIssuance.receiveZero(owner, toBN(dec(30,24)))

    troveManagerOriginal = contracts.troveManager
    zeroTokenOriginal = ZEROContracts.zeroToken

    const users = [ alice, bob, carol, dennis, whale, A, B, C, D, E, defaulter_1, defaulter_2 ]
    await deploymentHelper.deployProxyScripts(contracts, ZEROContracts, owner, users)

    priceFeed = contracts.priceFeedTestnet
    zusdToken = contracts.zusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    collSurplusPool = contracts.collSurplusPool
    borrowerOperations = contracts.borrowerOperations
    borrowerWrappers = contracts.borrowerWrappers
    zeroStaking = ZEROContracts.zeroStaking
    zeroToken = ZEROContracts.zeroToken
    wrbtcToken = contracts.wrbtcTokenTester
    sovFeeCollector = ZEROContracts.mockFeeSharingProxy.address
    sovToken = contracts.sovTokenTester

    ZUSD_GAS_COMPENSATION = await borrowerOperations.ZUSD_GAS_COMPENSATION()

    for (account of accounts.slice(0, 20)) {
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

  it('proxy owner can recover SOV', async () => {
    const amount = toBN(dec(1, 18))
    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)

    // send some SOV to proxy
    await sovToken.transfer(proxyAddress, amount)
    assert.equal(await sovToken.balanceOf(proxyAddress), amount.toString())

    const balanceBefore = await sovToken.balanceOf(alice)

    // recover SOV
    await borrowerWrappers.transferSOV(alice, amount, { from: alice, gasPrice: 0 })
    const balanceAfter = await sovToken.balanceOf(alice)

    assert.equal(balanceAfter.sub(balanceBefore), amount.toString())
  })

  it('non proxy owner cannot recover SOV', async () => {
    const amount = toBN(dec(1, 18))
    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)

     // send some SOV to proxy
     await sovToken.transfer(proxyAddress, amount)
     assert.equal(await sovToken.balanceOf(proxyAddress), amount.toString())
 
     const balanceBefore = await sovToken.balanceOf(alice)

    // try to recover SOV
    const proxy = borrowerWrappers.getProxyFromUser(alice)
    const signature = 'transferSOV(address,uint256)'
    const calldata = th.getTransactionData(signature, [alice, amount])
    await assertRevert(proxy.methods["execute(address,bytes)"](borrowerWrappers.scriptAddress, calldata, { from: bob }), 'ds-auth-unauthorized')

    assert.equal(await sovToken.balanceOf(proxyAddress), amount.toString())

    const balanceAfter = await sovToken.balanceOf(alice)
    assert.equal(balanceAfter, balanceBefore.toString())
  })

  // --- claimCollateralAndOpenTrove ---

  it('claimCollateralAndOpenTrove(): reverts if nothing to claim', async () => {
    // Whale opens Trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(whale), toBN(dec(10000, 30)), { from: whale })
    await openTrove({ ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    // alice opens Trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(alice), toBN(dec(10000, 30)), { from: alice })
    const { zusdAmount, collateral } = await openTrove({ ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
    assert.equal(await sovToken.balanceOf(proxyAddress), '0')

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // alice claims collateral and re-opens the trove
    await assertRevert(
      borrowerWrappers.claimCollateralAndOpenTrove(th._100pct, zusdAmount, alice, alice, 0, { from: alice }),
      'CollSurplusPool: No collateral available to claim'
    )

    // check everything remain the same
    assert.equal(await sovToken.balanceOf(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await zusdToken.balanceOf(proxyAddress), zusdAmount)
    assert.equal(await troveManager.getTroveStatus(proxyAddress), 1)
    th.assertIsApproximatelyEqual(await troveManager.getTroveColl(proxyAddress), collateral)
  })

  it('claimCollateralAndOpenTrove(): without sending any value', async () => {
    // alice opens Trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(alice), toBN(dec(10000, 30)), { from: alice })
    const { zusdAmount, netDebt: redeemAmount, collateral } = await openTrove({extraZUSDAmount: 0, ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
    // Whale opens Trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(whale), toBN(dec(10000, 30)), { from: whale })
    await openTrove({ extraZUSDAmount: redeemAmount, ICR: toBN(dec(5, 18)), extraParams: { from: whale } })

    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
    assert.equal(await sovToken.balanceOf(proxyAddress), '0')

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 150 ZUSD
    await th.redeemCollateral(whale, contracts, redeemAmount)
    assert.equal(await sovToken.balanceOf(proxyAddress), '0')

    // surplus: 5 - 150/200
    const price = await priceFeed.getPrice();
    const expectedSurplus = collateral.sub(redeemAmount.mul(mv._1e18BN).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), expectedSurplus)
    assert.equal(await troveManager.getTroveStatus(proxyAddress), 4) // closed by redemption

    // alice claims collateral and re-opens the trove
    await borrowerWrappers.claimCollateralAndOpenTrove(th._100pct, zusdAmount, alice, alice, 0, { from: alice })

    assert.equal(await sovToken.balanceOf(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await zusdToken.balanceOf(proxyAddress), zusdAmount.mul(toBN(2)))
    assert.equal(await troveManager.getTroveStatus(proxyAddress), 1)
    th.assertIsApproximatelyEqual(await troveManager.getTroveColl(proxyAddress), expectedSurplus)
  })

  it('claimCollateralAndOpenTrove(): sending value in the transaction', async () => {
    // alice opens Trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(alice), toBN(dec(10000, 30)), { from: alice })
    const { zusdAmount, netDebt: redeemAmount, collateral } = await openTrove({ extraParams: { from: alice } })
    // Whale opens Trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(whale), toBN(dec(10000, 30)), { from: whale })
    await openTrove({ extraZUSDAmount: redeemAmount, ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
    assert.equal(await sovToken.balanceOf(proxyAddress), '0')

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 150 ZUSD
    await th.redeemCollateral(whale, contracts, redeemAmount)
    assert.equal(await sovToken.balanceOf(proxyAddress), '0')

    // surplus: 5 - 150/200
    const price = await priceFeed.getPrice();
    const expectedSurplus = collateral.sub(redeemAmount.mul(mv._1e18BN).div(price))
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), expectedSurplus)
    assert.equal(await troveManager.getTroveStatus(proxyAddress), 4) // closed by redemption

    // alice claims collateral and re-opens the trove
    await borrowerWrappers.claimCollateralAndOpenTrove(th._100pct, zusdAmount, alice, alice, collateral, { from: alice })

    assert.equal(await sovToken.balanceOf(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await collSurplusPool.getCollateral(proxyAddress), '0')
    th.assertIsApproximatelyEqual(await zusdToken.balanceOf(proxyAddress), zusdAmount.mul(toBN(2)))
    assert.equal(await troveManager.getTroveStatus(proxyAddress), 1)
    th.assertIsApproximatelyEqual(await troveManager.getTroveColl(proxyAddress), expectedSurplus.add(collateral))
  })

  // --- claimSPRewardsAndRecycle ---

  it('claimSPRewardsAndRecycle(): only owner can call it', async () => {
    // Whale opens Trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(whale), toBN(dec(10000, 30)), { from: whale })
    await openTrove({ extraZUSDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
    // Whale deposits 1850 ZUSD in StabilityPool
    await stabilityPool.provideToSP(dec(1850, 18), ZERO_ADDRESS, { from: whale })

    // alice opens trove and provides 150 ZUSD to StabilityPool
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(alice), toBN(dec(10000, 30)), { from: alice })
    await openTrove({ extraZUSDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // Defaulter Trove opened
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(defaulter_1), toBN(dec(10000, 30)), { from: defaulter_1 })
    await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })

    // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price);

    // Defaulter trove closed
    const liquidationTX_1 = await troveManager.liquidate(defaulter_1, { from: owner })
    const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)

    // Bob tries to claims SP rewards in behalf of Alice
    const proxy = borrowerWrappers.getProxyFromUser(alice)
    const signature = 'claimSPRewardsAndRecycle(uint256,address,address)'
    const calldata = th.getTransactionData(signature, [th._100pct, alice, alice])
    await assertRevert(proxy.methods["execute(address,bytes)"](borrowerWrappers.scriptAddress, calldata, { from: bob }), 'ds-auth-unauthorized')
  })

  it('claimSPRewardsAndRecycle():', async () => {
    // Whale opens Trove
    const whaleDeposit = toBN(dec(2350, 18))
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(whale), toBN(dec(10000, 30)), { from: whale })
    await openTrove({ extraZUSDAmount: whaleDeposit, ICR: toBN(dec(4, 18)), extraParams: { from: whale } })
    // Whale deposits 1850 ZUSD in StabilityPool
    await stabilityPool.provideToSP(whaleDeposit, ZERO_ADDRESS, { from: whale })

    // alice opens trove and provides 150 ZUSD to StabilityPool
    const aliceDeposit = toBN(dec(150, 18))
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(alice), toBN(dec(10000, 30)), { from: alice })
    await openTrove({ extraZUSDAmount: aliceDeposit, ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
    await stabilityPool.provideToSP(aliceDeposit, ZERO_ADDRESS, { from: alice })

    // Defaulter Trove opened
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(defaulter_1), toBN(dec(10000, 30)), { from: defaulter_1 })
    const { zusdAmount, netDebt, collateral } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })

    // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
    const price = toBN(dec(100, 18))
    await priceFeed.setPrice(price);

    // Defaulter trove closed
    const liquidationTX_1 = await troveManager.liquidate(defaulter_1, { from: owner })
    const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1)

    // Alice ZUSDLoss is ((150/2500) * liquidatedDebt)
    const totalDeposits = whaleDeposit.add(aliceDeposit)
    const expectedZUSDLoss_A = liquidatedDebt_1.mul(aliceDeposit).div(totalDeposits)

    const expectedCompoundedZUSDDeposit_A = toBN(dec(150, 18)).sub(expectedZUSDLoss_A)
    const compoundedZUSDDeposit_A = await stabilityPool.getCompoundedZUSDDeposit(alice)
    // collateral * 150 / 2500 * 0.995
    const expectedSOVGain_A = collateral.mul(aliceDeposit).div(totalDeposits).mul(toBN(dec(995, 15))).div(mv._1e18BN)

    assert.isAtMost(th.getDifference(expectedCompoundedZUSDDeposit_A, compoundedZUSDDeposit_A), 1000)

    const sovBalanceBefore = await sovToken.balanceOf(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollBefore = await troveManager.getTroveColl(alice)
    const zusdBalanceBefore = await zusdToken.balanceOf(alice)
    const troveDebtBefore = await troveManager.getTroveDebt(alice)
    const zeroBalanceBefore = await zeroToken.balanceOf(alice)
    const ICRBefore = await troveManager.getCurrentICR(alice, price)
    const depositBefore = (await stabilityPool.deposits(alice))[0]
    const stakeBefore = await zeroStaking.stakes(alice)

    
    const proportionalZUSD = expectedSOVGain_A.mul(price).div(ICRBefore)
    const borrowingRate = await troveManagerOriginal.getBorrowingRateWithDecay()
    const netDebtChange = proportionalZUSD.mul(mv._1e18BN).div(mv._1e18BN.add(borrowingRate))

    // to force ZERO issuance
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)
    const expectedZEROGain_A = toBN('0')

    await priceFeed.setPrice(price.mul(toBN(2)));

    // Alice claims SP rewards and puts them back in the system through the proxy
    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
    await borrowerWrappers.claimSPRewardsAndRecycle(th._100pct, alice, alice, { from: alice })

    const sovBalanceAfter = await sovToken.balanceOf(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollAfter = await troveManager.getTroveColl(alice)
    const zusdBalanceAfter = await zusdToken.balanceOf(alice)
    const troveDebtAfter = await troveManager.getTroveDebt(alice)
    const zeroBalanceAfter = await zeroToken.balanceOf(alice)
    const ICRAfter = await troveManager.getCurrentICR(alice, price)
    const depositAfter = (await stabilityPool.deposits(alice))[0]
    const stakeAfter = await zeroStaking.stakes(alice)

    // check proxy balances remain the same
    assert.equal(sovBalanceAfter.toString(), sovBalanceBefore.toString())
    assert.equal(zusdBalanceAfter.toString(), zusdBalanceBefore.toString())
    assert.equal(zeroBalanceAfter.toString(), zeroBalanceBefore.toString())
    // check trove has increased debt by the ICR proportional amount to SOV gain
    th.assertIsApproximatelyEqual(troveDebtAfter, troveDebtBefore.add(proportionalZUSD))
    // check trove has increased collateral by the SOV gain
    th.assertIsApproximatelyEqual(troveCollAfter, troveCollBefore.add(expectedSOVGain_A))
    // check that ICR remains constant
    th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
    // check that Stability Pool deposit
    th.assertIsApproximatelyEqual(depositAfter, depositBefore.sub(expectedZUSDLoss_A).add(netDebtChange))
    // check zero balance remains the same
    th.assertIsApproximatelyEqual(zeroBalanceAfter, zeroBalanceBefore)

    // ZERO staking
    th.assertIsApproximatelyEqual(stakeAfter, stakeBefore.add(expectedZEROGain_A), 1e13)

    // Expect Alice has withdrawn all SOV gain
    const alice_pendingSOVGain = await stabilityPool.getDepositorSOVGain(alice)
    assert.equal(alice_pendingSOVGain, 0)
  })


  // --- claimStakingGainsAndRecycle ---

  it('claimStakingGainsAndRecycle(): only owner can call it', async () => {
    // Whale opens Trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(whale), toBN(dec(10000, 30)), { from: whale })
    await openTrove({ extraZUSDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    // alice opens trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(alice), toBN(dec(10000, 30)), { from: alice })
    await openTrove({ extraZUSDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })

    // mint some ZERO
    await zeroTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(whale), dec(1850, 18))
    await zeroTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(alice), dec(150, 18))

    // stake ZERO
    await zeroStaking.stake(dec(1850, 18), { from: whale })
    await zeroStaking.stake(dec(150, 18), { from: alice })

    // Defaulter Trove opened
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(defaulter_1), toBN(dec(10000, 30)), { from: defaulter_1 })
    const { zusdAmount, netDebt, totalDebt, collateral } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 100 ZUSD
    const redeemedAmount = toBN(dec(100, 18))
    await th.redeemCollateral(whale, contracts, redeemedAmount)

    // Bob tries to claims staking gains in behalf of Alice
    const proxy = borrowerWrappers.getProxyFromUser(alice)
    const signature = 'claimStakingGainsAndRecycle(uint256,address,address)'
    const calldata = th.getTransactionData(signature, [th._100pct, alice, alice])
    await assertRevert(proxy.methods["execute(address,bytes)"](borrowerWrappers.scriptAddress, calldata, { from: bob }), 'ds-auth-unauthorized')
  })

  it('claimStakingGainsAndRecycle(): with only SOV gain', async () => {
    const price = toBN(dec(200, 18))
  
    // Whale opens Trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(whale), toBN(dec(10000, 30)), { from: whale })
    await openTrove({ extraZUSDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    const sovFeeCollectorZUSDBalanceBefore = await zusdToken.balanceOf(sovFeeCollector)
  
    // Defaulter Trove opened
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(defaulter_1), toBN(dec(10000, 30)), { from: defaulter_1 })
    const { zusdAmount, netDebt, collateral } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })
    const borrowingFee = netDebt.sub(zusdAmount)
    // 100% sent to SovFeeCollector address
    const borrowingFeeToSovCollector = borrowingFee
    const sovFeeCollectorZUSDBalanceAfter = await zusdToken.balanceOf(sovFeeCollector)
  
    // alice opens trove and provides 150 ZUSD to StabilityPool
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(alice), toBN(dec(10000, 30)), { from: alice })
    await openTrove({ extraZUSDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // mint some ZERO
    await zeroTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(whale), dec(1850, 18))
    await zeroTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(alice), dec(150, 18))

    // stake ZERO
    await zeroStaking.stake(dec(1850, 18), { from: whale })
    await zeroStaking.stake(dec(150, 18), { from: alice })

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 100 ZUSD
    const redeemedAmount = toBN(dec(100, 18))
    const sovFeeCollectorBalanceBefore = await sovToken.balanceOf(sovFeeCollector)
    await th.redeemCollateral(whale, contracts, redeemedAmount)
    const sovFeeCollectorBalanceAfter = await sovToken.balanceOf(sovFeeCollector)
 
    // Alice SOV gain is ((150/2000) * (redemption fee over redeemedAmount) / price)
    const redemptionFee = await troveManager.getRedemptionFeeWithDecay(redeemedAmount)
    // 100% sent to SovFeeCollector address
    const redemptionFeeToSovCollector = redemptionFee
    const expectedSOVGainSovCollector = redemptionFeeToSovCollector.mul(mv._1e18BN).div(price)

    const redemptionFeeToZeroStalking = redemptionFee.sub(redemptionFeeToSovCollector)
    const expectedSOVGain_A = redemptionFeeToZeroStalking.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18))).mul(mv._1e18BN).div(price)

    const sovBalanceBefore = await sovToken.balanceOf(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollBefore = await troveManager.getTroveColl(alice)
    const zusdBalanceBefore = await zusdToken.balanceOf(alice)
    const troveDebtBefore = await troveManager.getTroveDebt(alice)
    const zeroBalanceBefore = await zeroToken.balanceOf(alice)
    const ICRBefore = await troveManager.getCurrentICR(alice, price)
    const depositBefore = (await stabilityPool.deposits(alice))[0]
    const stakeBefore = await zeroStaking.stakes(alice)

    const proportionalZUSD = expectedSOVGain_A.mul(price).div(ICRBefore)
    const borrowingRate = await troveManagerOriginal.getBorrowingRateWithDecay()
    const netDebtChange = proportionalZUSD.mul(toBN(dec(1, 18))).div(toBN(dec(1, 18)).add(borrowingRate))

    const expectedZEROGain_A = toBN('0')

    const proxyAddress = borrowerWrappers.getProxyAddressFromUser(alice)
    // Alice claims staking rewards and puts them back in the system through the proxy
    await borrowerWrappers.claimStakingGainsAndRecycle(th._100pct, alice, alice, { from: alice })

    // Alice new ZUSD gain due to her own Trove adjustment: ((150/2000) * (borrowing fee over netDebtChange))
    const newBorrowingFee = await troveManagerOriginal.getBorrowingFeeWithDecay(netDebtChange)
    // 100% sent to SovFeeCollector address
    const newBorrowingFeeToSovCollector = newBorrowingFee
    const newBorrowingFeeToZeroStalking = newBorrowingFee.sub(newBorrowingFeeToSovCollector)
    const expectedNewZUSDGain_A = newBorrowingFeeToZeroStalking.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18)))

    const sovBalanceAfter = await sovToken.balanceOf(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollAfter = await troveManager.getTroveColl(alice)
    const zusdBalanceAfter = await zusdToken.balanceOf(alice)
    const troveDebtAfter = await troveManager.getTroveDebt(alice)
    const zeroBalanceAfter = await zeroToken.balanceOf(alice)
    const ICRAfter = await troveManager.getCurrentICR(alice, price)
    const depositAfter = (await stabilityPool.deposits(alice))[0]
    const stakeAfter = await zeroStaking.stakes(alice)

    // check proxy balances remain the same
    assert.equal(sovBalanceAfter.toString(), sovBalanceBefore.toString())
    assert.equal(zeroBalanceAfter.toString(), zeroBalanceBefore.toString())
    // check proxy zusd balance has increased by own adjust trove reward
    th.assertIsApproximatelyEqual(zusdBalanceAfter, zusdBalanceBefore.add(expectedNewZUSDGain_A))
    // check trove has increased debt by the ICR proportional amount to SOV gain
    th.assertIsApproximatelyEqual(troveDebtAfter, troveDebtBefore.add(proportionalZUSD), 10000)
    // check trove has increased collateral by the SOV gain
    th.assertIsApproximatelyEqual(troveCollAfter, troveCollBefore.add(expectedSOVGain_A))
    // check that ICR remains constant
    th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
    // check that Stability Pool deposit
    th.assertIsApproximatelyEqual(depositAfter, depositBefore.add(netDebtChange), 10000)
    // check zero balance remains the same
    th.assertIsApproximatelyEqual(zeroBalanceBefore, zeroBalanceAfter)

    // ZERO staking
    th.assertIsApproximatelyEqual(stakeAfter, stakeBefore.add(expectedZEROGain_A), 1e14)

    // check sovFeeCollector has increased ZUSD balance
    th.assertIsApproximatelyEqual(sovFeeCollectorZUSDBalanceAfter, sovFeeCollectorZUSDBalanceBefore.add(borrowingFeeToSovCollector), 10000)
    // check sovFeeCollector has increased SOV balance
    th.assertIsApproximatelyEqual(sovFeeCollectorBalanceAfter, sovFeeCollectorBalanceBefore.add(expectedSOVGainSovCollector), 10000)

    // Expect Alice has withdrawn all SOV gain
    const alice_pendingSOVGain = await stabilityPool.getDepositorSOVGain(alice)
    assert.equal(alice_pendingSOVGain, 0)
  })

  it('claimStakingGainsAndRecycle(): with only ZUSD gain', async () => {
    const price = toBN(dec(200, 18))

    // Whale opens Trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(whale), toBN(dec(10000, 30)), { from: whale })
    await openTrove({ extraZUSDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    // alice opens trove and provides 150 ZUSD to StabilityPool
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(alice), toBN(dec(10000, 30)), { from: alice })
    await openTrove({ extraZUSDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // mint some ZERO
    await zeroTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(whale), dec(1850, 18))
    await zeroTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(alice), dec(150, 18))

    // stake ZERO
    await zeroStaking.stake(dec(1850, 18), { from: whale })
    await zeroStaking.stake(dec(150, 18), { from: alice })

    const sovFeeCollectorZUSDBalanceBefore = await zusdToken.balanceOf(sovFeeCollector)

    // Defaulter Trove opened
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(defaulter_1), toBN(dec(10000, 30)), { from: defaulter_1 })
    const { zusdAmount, netDebt, collateral } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })
    const borrowingFee = netDebt.sub(zusdAmount)

    // 100% sent to SovFeeCollector address
    const borrowingFeeToSovCollector = borrowingFee
    const sovFeeCollectorZUSDBalanceAfter = await zusdToken.balanceOf(sovFeeCollector)
    const borrowingFeeToZeroStalking = borrowingFee.sub(borrowingFeeToSovCollector)

    // Alice ZUSD gain is ((150/2000) * borrowingFee)
    const expectedZUSDGain_A = borrowingFeeToZeroStalking.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18)))

    const sovBalanceBefore = await sovToken.balanceOf(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollBefore = await troveManager.getTroveColl(alice)
    const zusdBalanceBefore = await zusdToken.balanceOf(alice)
    const troveDebtBefore = await troveManager.getTroveDebt(alice)
    const zeroBalanceBefore = await zeroToken.balanceOf(alice)
    const ICRBefore = await troveManager.getCurrentICR(alice, price)
    const depositBefore = (await stabilityPool.deposits(alice))[0]
    const stakeBefore = await zeroStaking.stakes(alice)

    const borrowingRate = await troveManagerOriginal.getBorrowingRateWithDecay()

    // Alice claims staking rewards and puts them back in the system through the proxy
    await borrowerWrappers.claimStakingGainsAndRecycle(th._100pct, alice, alice, { from: alice })

    const sovBalanceAfter = await sovToken.balanceOf(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollAfter = await troveManager.getTroveColl(alice)
    const zusdBalanceAfter = await zusdToken.balanceOf(alice)
    const troveDebtAfter = await troveManager.getTroveDebt(alice)
    const zeroBalanceAfter = await zeroToken.balanceOf(alice)
    const ICRAfter = await troveManager.getCurrentICR(alice, price)
    const depositAfter = (await stabilityPool.deposits(alice))[0]
    const stakeAfter = await zeroStaking.stakes(alice)

    // check proxy balances remain the same
    assert.equal(sovBalanceAfter.toString(), sovBalanceBefore.toString())
    assert.equal(zeroBalanceAfter.toString(), zeroBalanceBefore.toString())
    // check proxy zusd balance has increased by own adjust trove reward
    th.assertIsApproximatelyEqual(zusdBalanceAfter, zusdBalanceBefore)
    // check trove has increased debt by the ICR proportional amount to ETH gain
    th.assertIsApproximatelyEqual(troveDebtAfter, troveDebtBefore, 10000)
    // check trove has increased collateral by the ETH gain
    th.assertIsApproximatelyEqual(troveCollAfter, troveCollBefore)
    // check that ICR remains constant
    th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
    // check that Stability Pool deposit
    th.assertIsApproximatelyEqual(depositAfter, depositBefore.add(expectedZUSDGain_A), 10000)
    // check zero balance remains the same
    th.assertIsApproximatelyEqual(zeroBalanceBefore, zeroBalanceAfter)
    // check sovFeeCollector has increased ZUSD balance
    th.assertIsApproximatelyEqual(sovFeeCollectorZUSDBalanceAfter, sovFeeCollectorZUSDBalanceBefore.add(borrowingFeeToSovCollector), 10000)

    // Expect Alice has withdrawn all SOV gain
    const alice_pendingSOVGain = await stabilityPool.getDepositorSOVGain(alice)
    assert.equal(alice_pendingSOVGain, 0)
  })

  it('claimStakingGainsAndRecycle(): with both SOV and ZUSD gains', async () => {
    const price = toBN(dec(200, 18))

    // Whale opens Trove
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(whale), toBN(dec(10000, 30)), { from: whale })
    await openTrove({ extraZUSDAmount: toBN(dec(1850, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })

    // alice opens trove and provides 150 ZUSD to StabilityPool
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(alice), toBN(dec(10000, 30)), { from: alice })
    await openTrove({ extraZUSDAmount: toBN(dec(150, 18)), extraParams: { from: alice } })
    await stabilityPool.provideToSP(dec(150, 18), ZERO_ADDRESS, { from: alice })

    // mint some ZERO
    await zeroTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(whale), dec(1850, 18))
    await zeroTokenOriginal.unprotectedMint(borrowerOperations.getProxyAddressFromUser(alice), dec(150, 18))

    // stake ZERO
    await zeroStaking.stake(dec(1850, 18), { from: whale })
    await zeroStaking.stake(dec(150, 18), { from: alice })

    const sovFeeCollectorZUSDBalanceBefore = await zusdToken.balanceOf(sovFeeCollector)

    // Defaulter Trove opened
    await sovToken.approve(borrowerOperations.getProxyAddressFromUser(defaulter_1), toBN(dec(10000, 30)), { from: defaulter_1 })
    const { zusdAmount, netDebt, collateral } = await openTrove({ ICR: toBN(dec(210, 16)), extraParams: { from: defaulter_1 } })
    const borrowingFee = netDebt.sub(zusdAmount)

    // 100% sent to SovFeeCollector address
    const borrowingFeeToSovCollector = borrowingFee
    const sovFeeCollectorZUSDBalanceAfter = await zusdToken.balanceOf(sovFeeCollector)
    const borrowingFeeToZeroStalking = borrowingFee.sub(borrowingFeeToSovCollector)

    // Alice ZUSD gain is ((150/2000) * borrowingFee)
    const expectedZUSDGain_A = borrowingFeeToZeroStalking.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18)))

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

    // whale redeems 100 ZUSD
    const redeemedAmount = toBN(dec(100, 18))
    const sovFeeCollectorBalanceBefore = await sovToken.balanceOf(sovFeeCollector)
    await th.redeemCollateral(whale, contracts, redeemedAmount)
    const sovFeeCollectorBalanceAfter = await sovToken.balanceOf(sovFeeCollector)

    // Alice ETH gain is ((150/2000) * (redemption fee over redeemedAmount) / price)
    const redemptionFee = await troveManager.getRedemptionFeeWithDecay(redeemedAmount)
    // 100% sent to SovFeeCollector address
    const redemptionFeeToSovCollector = redemptionFee
    const expectedSOVGainSovCollector = redemptionFeeToSovCollector.mul(mv._1e18BN).div(price)

    const redemptionFeeToZeroStalking = redemptionFee.sub(redemptionFeeToSovCollector)
    const expectedSOVGain_A = redemptionFeeToZeroStalking.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18))).mul(mv._1e18BN).div(price)

    const sovBalanceBefore = await sovToken.balanceOf(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollBefore = await troveManager.getTroveColl(alice)
    const zusdBalanceBefore = await zusdToken.balanceOf(alice)
    const troveDebtBefore = await troveManager.getTroveDebt(alice)
    const zeroBalanceBefore = await zeroToken.balanceOf(alice)
    const ICRBefore = await troveManager.getCurrentICR(alice, price)
    const depositBefore = (await stabilityPool.deposits(alice))[0]
    const stakeBefore = await zeroStaking.stakes(alice)

    const proportionalZUSD = expectedSOVGain_A.mul(price).div(ICRBefore)
    const borrowingRate = await troveManagerOriginal.getBorrowingRateWithDecay()
    const netDebtChange = proportionalZUSD.mul(toBN(dec(1, 18))).div(toBN(dec(1, 18)).add(borrowingRate))
    const expectedTotalZUSD = expectedZUSDGain_A.add(netDebtChange)

    const expectedZEROGain_A = toBN('0')

    // Alice claims staking rewards and puts them back in the system through the proxy
    await borrowerWrappers.claimStakingGainsAndRecycle(th._100pct, alice, alice, { from: alice })

    // Alice new ZUSD gain due to her own Trove adjustment: ((150/2000) * (borrowing fee over netDebtChange))
    const newBorrowingFee = await troveManagerOriginal.getBorrowingFeeWithDecay(netDebtChange)
    // 100% sent to SovFeeCollector address
    const newBorrowingFeeToSovCollector = newBorrowingFee
    const newBorrowingFeeToZeroStalking = newBorrowingFee.sub(newBorrowingFeeToSovCollector)
    const expectedNewZUSDGain_A = newBorrowingFeeToZeroStalking.mul(toBN(dec(150, 18))).div(toBN(dec(2000, 18)))

    const sovBalanceAfter = await sovToken.balanceOf(borrowerOperations.getProxyAddressFromUser(alice))
    const troveCollAfter = await troveManager.getTroveColl(alice)
    const zusdBalanceAfter = await zusdToken.balanceOf(alice)
    const troveDebtAfter = await troveManager.getTroveDebt(alice)
    const zeroBalanceAfter = await zeroToken.balanceOf(alice)
    const ICRAfter = await troveManager.getCurrentICR(alice, price)
    const depositAfter = (await stabilityPool.deposits(alice))[0]
    const stakeAfter = await zeroStaking.stakes(alice)

    // check proxy balances remain the same
    assert.equal(sovBalanceAfter.toString(), sovBalanceBefore.toString())
    assert.equal(zeroBalanceAfter.toString(), zeroBalanceBefore.toString())
    // check proxy zusd balance has increased by own adjust trove reward
    th.assertIsApproximatelyEqual(zusdBalanceAfter, zusdBalanceBefore.add(expectedNewZUSDGain_A))
    // check trove has increased debt by the ICR proportional amount to SOV gain
    th.assertIsApproximatelyEqual(troveDebtAfter, troveDebtBefore.add(proportionalZUSD), 10000)
    // check trove has increased collateral by the SOV gain
    th.assertIsApproximatelyEqual(troveCollAfter, troveCollBefore.add(expectedSOVGain_A))
    // check that ICR remains constant
    th.assertIsApproximatelyEqual(ICRAfter, ICRBefore)
    // check that Stability Pool deposit
    th.assertIsApproximatelyEqual(depositAfter, depositBefore.add(expectedTotalZUSD), 10000)
    // check zero balance remains the same
    th.assertIsApproximatelyEqual(zeroBalanceBefore, zeroBalanceAfter)

    // ZERO staking
    th.assertIsApproximatelyEqual(stakeAfter, stakeBefore.add(expectedZEROGain_A), 1e14)

    // check sovFeeCollector has increased ZUSD balance
    th.assertIsApproximatelyEqual(sovFeeCollectorZUSDBalanceAfter, sovFeeCollectorZUSDBalanceBefore.add(borrowingFeeToSovCollector), 10000)
    // check sovFeeCollector has increased SOV balance
    th.assertIsApproximatelyEqual(sovFeeCollectorBalanceAfter, sovFeeCollectorBalanceBefore.add(expectedSOVGainSovCollector), 10000)

    // Expect Alice has withdrawn all SOV gain
    const alice_pendingSOVGain = await stabilityPool.getDepositorSOVGain(alice)
    assert.equal(alice_pendingSOVGain, 0)
  })

})
