const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const timeMachine = require('ganache-time-traveler');
const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference

const TroveManagerTester = artifacts.require("TroveManagerTester")
const ZSUSDToken = artifacts.require("ZSUSDToken")

contract('StabilityPool - ZERO Rewards', async accounts => {

  const [
    owner,
    whale,
    A, B, C, D, E, F, G, H,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4, defaulter_5, defaulter_6,
    frontEnd_1, frontEnd_2, frontEnd_3, sovFeeCollector
  ] = accounts;

  const multisig = accounts[997];

  let contracts

  let priceFeed
  let stabilityPool
  let sortedTroves
  let troveManager
  let borrowerOperations
  let zeroToken
  let communityIssuanceTester

  let communityZEROSupply
  let issuance_M1
  let issuance_M2
  let issuance_M3
  let issuance_M4
  let issuance_M5
  let issuance_M6

  let sovToken

  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const getOpenTroveZSUSDAmount = async (totalDebt) => th.getOpenTroveZSUSDAmount(contracts, totalDebt)

  const openTrove = async (params) => th.openTrove(contracts, params)
  describe("ZERO Rewards", async () => {

    before(async () => {
      contracts = await deploymentHelper.deployLiquityCore()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.zsusdToken = await ZSUSDToken.new()
      await contracts.zsusdToken.initialize(
        contracts.troveManager.address,
        contracts.stabilityPool.address,
        contracts.borrowerOperations.address
      )
      const ZEROContracts = await deploymentHelper.deployZEROTesterContractsHardhat(multisig)

      priceFeed = contracts.priceFeedTestnet
      zsusdToken = contracts.zsusdToken
      stabilityPool = contracts.stabilityPool
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      stabilityPool = contracts.stabilityPool
      borrowerOperations = contracts.borrowerOperations
      sovToken = contracts.sovTokenTester

      zeroToken = ZEROContracts.zeroToken
      communityIssuanceTester = ZEROContracts.communityIssuance

      await deploymentHelper.connectZEROContracts(ZEROContracts)
      await deploymentHelper.connectCoreContracts(contracts, ZEROContracts)
      await deploymentHelper.connectZEROContractsToCore(ZEROContracts, contracts, owner)

      await zeroToken.unprotectedMint(owner,toBN(dec(30,24)))
      await zeroToken.approve(communityIssuanceTester.address, toBN(dec(30,24)))
      await communityIssuanceTester.receiveZero(owner, toBN(dec(30,24)))

      // Check community issuance starts with 30 million ZERO
      communityZEROSupply = toBN(await zeroToken.balanceOf(communityIssuanceTester.address))
      assert.isAtMost(getDifference(communityZEROSupply, '30000000000000000000000000'), 1000)

      /* Monthly ZERO issuance
  
        Expected fraction of total supply issued per month, for a yearly halving schedule
        (issuance in each month, not cumulative):
    
        Month 1: 0.055378538087966600
        Month 2: 0.052311755607206100
        Month 3: 0.049414807056864200
        Month 4: 0.046678287282156100
        Month 5: 0.044093311972020200
        Month 6: 0.041651488815552900
      */

      issuance_M1 = toBN('0')
      issuance_M2 = toBN('0')
      issuance_M3 = toBN('0')
      issuance_M4 = toBN('0')
      issuance_M5 = toBN('0')
      issuance_M6 = toBN('0')


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

    it("liquidation < 1 minute after a deposit does not change totalZEROIssued", async () => {
      
      
      await openTrove({ extraZSUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: {from: A } })
      await openTrove({ extraZSUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: {from: B } })

      // A, B provide to SP
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: A })
      await stabilityPool.provideToSP(dec(5000, 18), ZERO_ADDRESS, { from: B })

      await th.fastForwardTime(timeValues.MINUTES_IN_ONE_WEEK, web3.currentProvider)

      await priceFeed.setPrice(dec(105, 18))

      // B adjusts, triggering ZERO issuance for all
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: B })
      const blockTimestamp_1 = th.toBN(await th.getLatestBlockTimestamp(web3))

      // Check ZERO has been issued
      const totalZEROIssued_1 = await communityIssuanceTester.totalZEROIssued()
      assert.isTrue(totalZEROIssued_1.eq(toBN('0')))
      
      await troveManager.liquidate(B)
      const blockTimestamp_2 = th.toBN(await th.getLatestBlockTimestamp(web3))

      assert.isFalse(await sortedTroves.contains(B))

      const totalZEROIssued_2 = await communityIssuanceTester.totalZEROIssued()

      console.log(`totalZEROIssued_1: ${totalZEROIssued_1}`)
      console.log(`totalZEROIssued_2: ${totalZEROIssued_2}`)

      // check blockTimestamp diff < 60s
      const timestampDiff = blockTimestamp_2.sub(blockTimestamp_1)
      assert.isTrue(timestampDiff.lt(toBN(60)))

      // Check that the liquidation did not alter total ZERO issued
      assert.isTrue(totalZEROIssued_2.eq(totalZEROIssued_1))

      // Check that depositor B has no ZERO gain
      const B_pendingZEROGain = toBN('0')
      assert.equal(B_pendingZEROGain, '0')

      // Check depositor B has a pending SOV gain
      const B_pendingSOVGain = await stabilityPool.getDepositorSOVGain(B)
      assert.isTrue(B_pendingSOVGain.gt(toBN('0')))
    })


    it("withdrawFromSP(): reward term G does not update when no ZERO is issued", async () => {
      await sovToken.approve(borrowerOperations.address, dec(1000, 'ether'), { from: A })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), A, A, dec(1000, 'ether'), { from: A })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: A })

      const A_initialDeposit = ((await stabilityPool.deposits(A))[0]).toString()
      assert.equal(A_initialDeposit, dec(10000, 18))

      // defaulter opens trove
      await sovToken.approve(borrowerOperations.address, dec(1000, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })

      // SOV drops
      await priceFeed.setPrice(dec(100, 18))

      await th.fastForwardTime(timeValues.MINUTES_IN_ONE_WEEK, web3.currentProvider)

      // Liquidate d1. Triggers issuance.
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(defaulter_1))

      // Get G and communityIssuance before
      const G_Before = await stabilityPool.epochToScaleToG(0, 0)
      const ZEROIssuedBefore = await communityIssuanceTester.totalZEROIssued()

      //  A withdraws some deposit. Triggers issuance.
      const tx = await stabilityPool.withdrawFromSP(1000, { from: A, gasPrice: 0 })
      assert.isTrue(tx.receipt.status)

      // Check G and ZEROIssued do not increase, since <1 minute has passed between issuance triggers
      const G_After = await stabilityPool.epochToScaleToG(0, 0)
      const ZEROIssuedAfter = await communityIssuanceTester.totalZEROIssued()

      assert.isTrue(G_After.eq(G_Before))
      assert.isTrue(ZEROIssuedAfter.eq(ZEROIssuedBefore))
    })

    // using the result of this to advance time by the desired amount from the deployment time, whether or not some extra time has passed in the meanwhile
    const getDuration = async (expectedDuration) => {
      const deploymentTime = (await communityIssuanceTester.deploymentTime()).toNumber()
      const currentTime = await th.getLatestBlockTimestamp(web3)
      const duration = Math.max(expectedDuration - (currentTime - deploymentTime), 0)

      return duration
    }

    // Simple case: 3 depositors, equal stake. No liquidations. No front-end.
    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct ZERO gain. No liquidations. No front end.", async () => {
      const initialIssuance = await communityIssuanceTester.totalZEROIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens Trove with 10k SOV
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), whale, whale, dec(10000, 'ether'), { from: whale })

      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: A })
      await borrowerOperations.openTrove(th._100pct, dec(1, 22), A, A, dec(100, 'ether'), { from: A })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: B })
      await borrowerOperations.openTrove(th._100pct, dec(1, 22), B, B, dec(100, 'ether'), { from: B })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: C })
      await borrowerOperations.openTrove(th._100pct, dec(1, 22), C, C, dec(100, 'ether'), { from: C })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: D })
      await borrowerOperations.openTrove(th._100pct, dec(1, 22), D, D, dec(100, 'ether'), { from: D })

      // Check all ZERO balances are initially 0
      assert.equal(await zeroToken.balanceOf(A), 0)
      assert.equal(await zeroToken.balanceOf(B), 0)
      assert.equal(await zeroToken.balanceOf(C), 0)

      // A, B, C deposit
      await stabilityPool.provideToSP(dec(1, 22), ZERO_ADDRESS, { from: A })
      await stabilityPool.provideToSP(dec(1, 22), ZERO_ADDRESS, { from: B })
      await stabilityPool.provideToSP(dec(1, 22), ZERO_ADDRESS, { from: C })

      // One year passes
      await th.fastForwardTime(await getDuration(timeValues.SECONDS_IN_ONE_YEAR), web3.currentProvider)

      // D deposits, triggering ZERO gains for A,B,C. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: D })

      // Expected gains for each depositor after 1 year (50% total issued).  Each deposit gets 1/3 of issuance.
      const expectedZEROGain_1yr = toBN('0')

      // Check ZERO gain
      const A_ZEROGain_1yr = toBN('0')
      const B_ZEROGain_1yr = toBN('0')
      const C_ZEROGain_1yr = toBN('0')

      // Check gains are correct, error tolerance = 1e-6 of a token

      assert.isAtMost(getDifference(A_ZEROGain_1yr, expectedZEROGain_1yr), 1e12)
      assert.isAtMost(getDifference(B_ZEROGain_1yr, expectedZEROGain_1yr), 1e12)
      assert.isAtMost(getDifference(C_ZEROGain_1yr, expectedZEROGain_1yr), 1e12)

      // Another year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // D deposits, triggering ZERO gains for A,B,C. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: D })

      // Expected gains for each depositor after 2 years (75% total issued).  Each deposit gets 1/3 of issuance.
      const expectedZEROGain_2yr = toBN('0')

      // Check ZERO gain
      const A_ZEROGain_2yr = toBN('0')
      const B_ZEROGain_2yr = toBN('0')
      const C_ZEROGain_2yr = toBN('0')

      // Check gains are correct, error tolerance = 1e-6 of a token
      assert.isAtMost(getDifference(A_ZEROGain_2yr, expectedZEROGain_2yr), 1e12)
      assert.isAtMost(getDifference(B_ZEROGain_2yr, expectedZEROGain_2yr), 1e12)
      assert.isAtMost(getDifference(C_ZEROGain_2yr, expectedZEROGain_2yr), 1e12)

      // Each depositor fully withdraws
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(100, 18), { from: C })

      // Check ZERO balances increase by correct amount
      assert.isAtMost(getDifference((await zeroToken.balanceOf(A)), expectedZEROGain_2yr), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(B)), expectedZEROGain_2yr), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(C)), expectedZEROGain_2yr), 1e12)
    })

    // 3 depositors, varied stake. No liquidations. No front-end.
    it("withdrawFromSP(): Depositors with varying initial deposit withdraw correct ZERO gain. No liquidations. No front end.", async () => {
      const initialIssuance = await communityIssuanceTester.totalZEROIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens Trove with 10k SOV
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), whale, whale, dec(10000, 'ether'), { from: whale })

      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: A })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), A, A, dec(200, 'ether'), { from: A })
      await sovToken.approve(borrowerOperations.address, dec(300, 'ether'), { from: B })
      await borrowerOperations.openTrove(th._100pct, dec(20000, 18), B, B, dec(300, 'ether'), { from: B })
      await sovToken.approve(borrowerOperations.address, dec(400, 'ether'), { from: C })
      await borrowerOperations.openTrove(th._100pct, dec(30000, 18), C, C, dec(400, 'ether'), { from: C })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: D })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), D, D, dec(100, 'ether'), { from: D })

      // Check all ZERO balances are initially 0
      assert.equal(await zeroToken.balanceOf(A), 0)
      assert.equal(await zeroToken.balanceOf(B), 0)
      assert.equal(await zeroToken.balanceOf(C), 0)

      // A, B, C deposit
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: A })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: B })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: C })

      // One year passes
      await th.fastForwardTime(await getDuration(timeValues.SECONDS_IN_ONE_YEAR), web3.currentProvider)

      // D deposits, triggering ZERO gains for A,B,C. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: D })

      // Expected gains for each depositor after 1 year (50% total issued)
      const A_expectedZEROGain_1yr = toBN('0')

      const B_expectedZEROGain_1yr = toBN('0')

      const C_expectedZEROGain_1yr = toBN('0')

      // Check ZERO gain
      const A_ZEROGain_1yr = toBN('0')
      const B_ZEROGain_1yr = toBN('0')
      const C_ZEROGain_1yr = toBN('0')

      // Check gains are correct, error tolerance = 1e-6 of a toke
      assert.isAtMost(getDifference(A_ZEROGain_1yr, A_expectedZEROGain_1yr), 1e12)
      assert.isAtMost(getDifference(B_ZEROGain_1yr, B_expectedZEROGain_1yr), 1e12)
      assert.isAtMost(getDifference(C_ZEROGain_1yr, C_expectedZEROGain_1yr), 1e12)

      // Another year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // D deposits, triggering ZERO gains for A,B,C. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: D })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: D })

      // Expected gains for each depositor after 2 years (75% total issued).
      const A_expectedZEROGain_2yr = toBN('0')

      const B_expectedZEROGain_2yr = toBN('0')

      const C_expectedZEROGain_2yr = toBN('0')

      // Check ZERO gain
      const A_ZEROGain_2yr = toBN('0')
      const B_ZEROGain_2yr = toBN('0')
      const C_ZEROGain_2yr = toBN('0')

      // Check gains are correct, error tolerance = 1e-6 of a token
      assert.isAtMost(getDifference(A_ZEROGain_2yr, A_expectedZEROGain_2yr), 1e12)
      assert.isAtMost(getDifference(B_ZEROGain_2yr, B_expectedZEROGain_2yr), 1e12)
      assert.isAtMost(getDifference(C_ZEROGain_2yr, C_expectedZEROGain_2yr), 1e12)

      // Each depositor fully withdraws
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: C })

      // Check ZERO balances increase by correct amount
      assert.isAtMost(getDifference((await zeroToken.balanceOf(A)), A_expectedZEROGain_2yr), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(B)), B_expectedZEROGain_2yr), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(C)), C_expectedZEROGain_2yr), 1e12)
    })

    // A, B, C deposit. Varied stake. 1 Liquidation. D joins.
    it("withdrawFromSP(): Depositors with varying initial deposit withdraw correct ZERO gain. No liquidations. No front end.", async () => {
      const initialIssuance = await communityIssuanceTester.totalZEROIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens Trove with 10k SOV
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), whale, whale, dec(10000, 'ether'), { from: whale })

      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: A })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), A, A, dec(200, 'ether'), { from: A })
      await sovToken.approve(borrowerOperations.address, dec(300, 'ether'), { from: B })
      await borrowerOperations.openTrove(th._100pct, dec(20000, 18), B, B, dec(300, 'ether'), { from: B })
      await sovToken.approve(borrowerOperations.address, dec(400, 'ether'), { from: C })
      await borrowerOperations.openTrove(th._100pct, dec(30000, 18), C, C, dec(400, 'ether'), { from: C })
      await sovToken.approve(borrowerOperations.address, dec(500, 'ether'), { from: D })
      await borrowerOperations.openTrove(th._100pct, dec(40000, 18), D, D, dec(500, 'ether'), { from: D })
      await sovToken.approve(borrowerOperations.address, dec(600, 'ether'), { from: E })
      await borrowerOperations.openTrove(th._100pct, dec(40000, 18), E, E, dec(600, 'ether'), { from: E })

      await sovToken.approve(borrowerOperations.address, dec(300, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(30000, 18)), defaulter_1, defaulter_1, dec(300, 'ether'), { from: defaulter_1 })

      // Check all ZERO balances are initially 0
      assert.equal(await zeroToken.balanceOf(A), 0)
      assert.equal(await zeroToken.balanceOf(B), 0)
      assert.equal(await zeroToken.balanceOf(C), 0)
      assert.equal(await zeroToken.balanceOf(D), 0)

      // A, B, C deposit
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: A })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: B })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: C })

      // Year 1 passes
      await th.fastForwardTime(await getDuration(timeValues.SECONDS_IN_ONE_YEAR), web3.currentProvider)

      assert.equal(await stabilityPool.getTotalZSUSDDeposits(), dec(60000, 18))

      // Price Drops, defaulter1 liquidated. Stability Pool size drops by 50%
      await priceFeed.setPrice(dec(100, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(defaulter_1))

      // Confirm SP dropped from 60k to 30k
      assert.isAtMost(getDifference(await stabilityPool.getTotalZSUSDDeposits(), dec(30000, 18)), 1000)

      // Expected gains for each depositor after 1 year (50% total issued)
      const A_expectedZEROGain_Y1 = toBN('0')

      const B_expectedZEROGain_Y1 = toBN('0')

      const C_expectedZEROGain_Y1 = toBN('0')

      // Check ZERO gain
      const A_ZEROGain_Y1 = toBN('0')
      const B_ZEROGain_Y1 = toBN('0')
      const C_ZEROGain_Y1 = toBN('0')

      // Check gains are correct, error tolerance = 1e-6 of a toke
      assert.isAtMost(getDifference(A_ZEROGain_Y1, A_expectedZEROGain_Y1), 1e12)
      assert.isAtMost(getDifference(B_ZEROGain_Y1, B_expectedZEROGain_Y1), 1e12)
      assert.isAtMost(getDifference(C_ZEROGain_Y1, C_expectedZEROGain_Y1), 1e12)

      // D deposits 40k
      await stabilityPool.provideToSP(dec(40000, 18), ZERO_ADDRESS, { from: D })

      // Year 2 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // E deposits and withdraws, creating ZERO issuance
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: E })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: E })

      // Expected gains for each depositor during Y2:
      const A_expectedZEROGain_Y2 = toBN('0')
      const B_expectedZEROGain_Y2 = toBN('0')
      const C_expectedZEROGain_Y2 = toBN('0')
      const D_expectedZEROGain_Y2 = toBN('0')
      // Check ZERO gain
      const A_ZEROGain_AfterY2 = toBN('0')
      const B_ZEROGain_AfterY2 = toBN('0')
      const C_ZEROGain_AfterY2 = toBN('0')
      const D_ZEROGain_AfterY2 = toBN('0')

      const A_expectedTotalGain = A_expectedZEROGain_Y1.add(A_expectedZEROGain_Y2)
      const B_expectedTotalGain = B_expectedZEROGain_Y1.add(B_expectedZEROGain_Y2)
      const C_expectedTotalGain = C_expectedZEROGain_Y1.add(C_expectedZEROGain_Y2)
      const D_expectedTotalGain = D_expectedZEROGain_Y2

      // Check gains are correct, error tolerance = 1e-6 of a token
      assert.isAtMost(getDifference(A_ZEROGain_AfterY2, A_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference(B_ZEROGain_AfterY2, B_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference(C_ZEROGain_AfterY2, C_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference(D_ZEROGain_AfterY2, D_expectedTotalGain), 1e12)

      // Each depositor fully withdraws
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(20000, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(30000, 18), { from: C })
      await stabilityPool.withdrawFromSP(dec(40000, 18), { from: D })

      // Check ZERO balances increase by correct amount
      assert.isAtMost(getDifference((await zeroToken.balanceOf(A)), A_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(B)), B_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(C)), C_expectedTotalGain), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(D)), D_expectedTotalGain), 1e12)
    })

    //--- Serial pool-emptying liquidations ---

    /* A, B deposit 100C
    L1 cancels 200C
    B, C deposits 100C
    L2 cancels 200C
    E, F deposit 100C
    L3 cancels 200C
    G,H deposits 100C
    L4 cancels 200C

    Expect all depositors withdraw  1/2 of 1 month's ZERO issuance */
    it('withdrawFromSP(): Depositor withdraws correct ZERO gain after serial pool-emptying liquidations. No front-ends.', async () => {
      const initialIssuance = await communityIssuanceTester.totalZEROIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens Trove with 10k SOV
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), whale, whale, dec(10000, 'ether'), { from: whale })

      const allDepositors = [A, B, C, D, E, F, G, H]
      // 4 Defaulters open trove with 200ZSUSD debt, and 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(20000, 18)), defaulter_1, defaulter_1, dec(200, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(20000, 18)), defaulter_2, defaulter_2, dec(200, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(20000, 18)), defaulter_3, defaulter_3, dec(200, 'ether'), { from: defaulter_3 })
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: defaulter_4 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(20000, 18)), defaulter_4, defaulter_4, dec(200, 'ether'), { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Check all would-be depositors have 0 ZERO balance
      for (depositor of allDepositors) {
        assert.equal(await zeroToken.balanceOf(depositor), '0')
      }

      // A, B each deposit 10k ZSUSD
      const depositors_1 = [A, B]
      for (account of depositors_1) {
        await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: account })
        await borrowerOperations.openTrove(th._100pct, dec(10000, 18), account, account, dec(200, 'ether'), { from: account })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(await getDuration(timeValues.SECONDS_IN_ONE_MONTH), web3.currentProvider)

      // Defaulter 1 liquidated. 20k ZSUSD fully offset with pool.
      await troveManager.liquidate(defaulter_1, { from: owner });

      // C, D each deposit 10k ZSUSD
      const depositors_2 = [C, D]
      for (account of depositors_2) {
        await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: account })
        await borrowerOperations.openTrove(th._100pct, dec(10000, 18), account, account, dec(200, 'ether'), { from: account })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 2 liquidated. 10k ZSUSD offset
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Erin, Flyn each deposit 100 ZSUSD
      const depositors_3 = [E, F]
      for (account of depositors_3) {
        await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: account })
        await borrowerOperations.openTrove(th._100pct, dec(10000, 18), account, account, dec(200, 'ether'), { from: account })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 3 liquidated. 100 ZSUSD offset
      await troveManager.liquidate(defaulter_3, { from: owner });

      // Graham, Harriet each deposit 10k ZSUSD
      const depositors_4 = [G, H]
      for (account of depositors_4) {
        await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: account })
        await borrowerOperations.openTrove(th._100pct, dec(10000, 18), account, account, dec(200, 'ether'), { from: account })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 4 liquidated. 100 ZSUSD offset
      await troveManager.liquidate(defaulter_4, { from: owner });

      // All depositors withdraw from SP
      for (depositor of allDepositors) {
        await stabilityPool.withdrawFromSP(dec(10000, 18), { from: depositor })
      }

      /* Each depositor constitutes 50% of the pool from the time they deposit, up until the liquidation.
      Therefore, divide monthly issuance by 2 to get the expected per-depositor ZERO gain.*/
      const expectedZEROGain_M1 = toBN('0')
      const expectedZEROGain_M2 = toBN('0')
      const expectedZEROGain_M3 = toBN('0')
      const expectedZEROGain_M4 = toBN('0')

      // Check A, B only earn issuance from month 1. Error tolerance = 1e-3 tokens
      for (depositor of [A, B]) {
        const ZEROBalance = await zeroToken.balanceOf(depositor)
        assert.isAtMost(getDifference(ZEROBalance, expectedZEROGain_M1), 1e15)
      }

      // Check C, D only earn issuance from month 2.  Error tolerance = 1e-3 tokens
      for (depositor of [C, D]) {
        const ZEROBalance = await zeroToken.balanceOf(depositor)
        assert.isAtMost(getDifference(ZEROBalance, expectedZEROGain_M2), 1e15)
      }

      // Check E, F only earn issuance from month 3.  Error tolerance = 1e-3 tokens
      for (depositor of [E, F]) {
        const ZEROBalance = await zeroToken.balanceOf(depositor)
        assert.isAtMost(getDifference(ZEROBalance, expectedZEROGain_M3), 1e15)
      }

      // Check G, H only earn issuance from month 4.  Error tolerance = 1e-3 tokens
      for (depositor of [G, H]) {
        const ZEROBalance = await zeroToken.balanceOf(depositor)
        assert.isAtMost(getDifference(ZEROBalance, expectedZEROGain_M4), 1e15)
      }

      const finalEpoch = (await stabilityPool.currentEpoch()).toString()
      assert.equal(finalEpoch, 4)
    })

    it('ZERO issuance for a given period is not obtainable if the SP was empty during the period', async () => {
      const CIBalanceBefore = await zeroToken.balanceOf(communityIssuanceTester.address)

      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: A })
      await borrowerOperations.openTrove(th._100pct, dec(16000, 18), A, A, dec(200, 'ether') , { from: A })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: B })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), B, B, dec(100, 'ether') , { from: B })
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: C })
      await borrowerOperations.openTrove(th._100pct, dec(16000, 18), C, C, dec(200, 'ether') , { from: C })

      const totalZEROissuance_0 = await communityIssuanceTester.totalZEROIssued()
      const G_0 = await stabilityPool.epochToScaleToG(0, 0)  // epochs and scales will not change in this test: no liquidations
      assert.equal(totalZEROissuance_0, '0')
      assert.equal(G_0, '0')

      // 1 month passes (M1)
      await th.fastForwardTime(await getDuration(timeValues.SECONDS_IN_ONE_MONTH), web3.currentProvider)

      // ZERO issuance event triggered: A deposits
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: A })

      // Check G is not updated, since SP was empty prior to A's deposit
      const G_1 = await stabilityPool.epochToScaleToG(0, 0)
      assert.isTrue(G_1.eq(G_0))

      // Check total ZERO issued is updated
      const totalZEROissuance_1 = await communityIssuanceTester.totalZEROIssued()
      assert.isTrue(totalZEROissuance_1.eq(totalZEROissuance_0))

      // 1 month passes (M2)
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      //ZERO issuance event triggered: A withdraws. 
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: A })

      // Check G is updated, since SP was not empty prior to A's withdrawal
      const G_2 = await stabilityPool.epochToScaleToG(0, 0)
      assert.isTrue(G_2.eq(G_1))

      // Check total ZERO issued is updated
      const totalZEROissuance_2 = await communityIssuanceTester.totalZEROIssued()
      assert.isTrue(totalZEROissuance_2.eq(totalZEROissuance_1))

      // 1 month passes (M3)
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // ZERO issuance event triggered: C deposits
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: C })

      // Check G is not updated, since SP was empty prior to C's deposit
      const G_3 = await stabilityPool.epochToScaleToG(0, 0)
      assert.isTrue(G_3.eq(G_2))

      // Check total ZERO issued is updated
      const totalZEROissuance_3 = await communityIssuanceTester.totalZEROIssued()
      assert.isTrue(totalZEROissuance_3.eq(totalZEROissuance_2))

      // 1 month passes (M4)
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // C withdraws
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: C })

      // Check G is increased, since SP was not empty prior to C's withdrawal
      const G_4 = await stabilityPool.epochToScaleToG(0, 0)
      assert.isTrue(G_4.eq(G_3))

      // Check total ZERO issued is increased
      const totalZEROissuance_4 = await communityIssuanceTester.totalZEROIssued()
      assert.isTrue(totalZEROissuance_4.eq(totalZEROissuance_3))

      // Get ZERO Gains
      const A_ZEROGain = await zeroToken.balanceOf(A)
      const C_ZEROGain = await zeroToken.balanceOf(C)

      // Check A earns gains from M2 only
      assert.isAtMost(getDifference(A_ZEROGain, issuance_M2), 1e15)

      // Check C earns gains from M4 only
      assert.isAtMost(getDifference(C_ZEROGain, issuance_M4), 1e15)

      // Check totalZEROIssued = M1 + M2 + M3 + M4.  1e-3 error tolerance.
      const expectedIssuance4Months = issuance_M1.add(issuance_M2).add(issuance_M3).add(issuance_M4)
      assert.isAtMost(getDifference(expectedIssuance4Months, totalZEROissuance_4), 1e15)

      // Check CI has only transferred out tokens for M2 + M4.  1e-3 error tolerance.
      const expectedZEROSentOutFromCI = issuance_M2.add(issuance_M4)
      const CIBalanceAfter = await zeroToken.balanceOf(communityIssuanceTester.address)
      const CIBalanceDifference = CIBalanceBefore.sub(CIBalanceAfter)
      assert.isAtMost(getDifference(CIBalanceDifference, expectedZEROSentOutFromCI), 1e15)
    })


    // --- Scale factor changes ---

    /* Serial scale changes

    A make deposit 10k ZSUSD
    1 month passes. L1 decreases P: P = 1e-5 P. L1:   9999.9 ZSUSD, 100 SOV
    B makes deposit 9999.9
    1 month passes. L2 decreases P: P =  1e-5 P. L2:  9999.9 ZSUSD, 100 SOV
    C makes deposit  9999.9
    1 month passes. L3 decreases P: P = 1e-5 P. L3:  9999.9 ZSUSD, 100 SOV
    D makes deposit  9999.9
    1 month passes. L4 decreases P: P = 1e-5 P. L4:  9999.9 ZSUSD, 100 SOV
    E makes deposit  9999.9
    1 month passes. L5 decreases P: P = 1e-5 P. L5:  9999.9 ZSUSD, 100 SOV
    =========
    F makes deposit 100
    1 month passes. L6 empties the Pool. L6:  10000 ZSUSD, 100 SOV

    expect A, B, C, D each withdraw ~1 month's worth of ZERO */
    it("withdrawFromSP(): Several deposits of 100 ZSUSD span one scale factor change. Depositors withdraw correct ZERO gains", async () => {
      // Whale opens Trove with 100 SOV
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), whale, whale, dec(100, 'ether'), { from: whale })

      const fiveDefaulters = [defaulter_1, defaulter_2, defaulter_3, defaulter_4, defaulter_5]

      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: A })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), ZERO_ADDRESS, ZERO_ADDRESS, dec(10000, 'ether'), { from: A })
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: B })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), ZERO_ADDRESS, ZERO_ADDRESS, dec(10000, 'ether'), { from: B })
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: C })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), ZERO_ADDRESS, ZERO_ADDRESS, dec(10000, 'ether'), { from: C })
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: D })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), ZERO_ADDRESS, ZERO_ADDRESS, dec(10000, 'ether'), { from: D })
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: E })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), ZERO_ADDRESS, ZERO_ADDRESS, dec(10000, 'ether'), { from: E })
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: F })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), ZERO_ADDRESS, ZERO_ADDRESS, dec(10000, 'ether'), { from: F })

      for (const defaulter of fiveDefaulters) {
        // Defaulters 1-5 each withdraw to 9999.9 debt (including gas comp)
        await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter })
        await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('9999900000000000000000'), defaulter, defaulter, dec(100, 'ether'), { from: defaulter })
      }

      // Defaulter 6 withdraws to 10k debt (inc. gas comp)
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_6 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_6, defaulter_6, dec(100, 'ether'), { from: defaulter_6 })

      // Confirm all depositors have 0 ZERO
      for (const depositor of [A, B, C, D, E, F]) {
        assert.equal(await zeroToken.balanceOf(depositor), '0')
      }
      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Check scale is 0
      // assert.equal(await stabilityPool.currentScale(), '0')

      // A provides to SP
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: A })

      // 1 month passes
      await th.fastForwardTime(await getDuration(timeValues.SECONDS_IN_ONE_MONTH) , web3.currentProvider)

      // Defaulter 1 liquidated.  Value of P updated to  to 1e-5
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.isFalse(await sortedTroves.contains(defaulter_1))
      assert.isTrue(txL1.receipt.status)

      // Check scale is 0
      assert.equal(await stabilityPool.currentScale(), '0')
      assert.equal(await stabilityPool.P(), dec(1, 13)) //P decreases: P = 1e(18-5) = 1e13

      // B provides to SP
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: B })

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isFalse(await sortedTroves.contains(defaulter_2))
      assert.isTrue(txL2.receipt.status)

      // Check scale is 1
      assert.equal(await stabilityPool.currentScale(), '1')
      assert.equal(await stabilityPool.P(), dec(1, 17)) //Scale changes and P changes: P = 1e(13-5+9) = 1e17

      // C provides to SP
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: C })

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 3 liquidated
      const txL3 = await troveManager.liquidate(defaulter_3, { from: owner });
      assert.isFalse(await sortedTroves.contains(defaulter_3))
      assert.isTrue(txL3.receipt.status)

      // Check scale is 1
      assert.equal(await stabilityPool.currentScale(), '1')
      assert.equal(await stabilityPool.P(), dec(1, 12)) //P decreases: P 1e(17-5) = 1e12

      // D provides to SP
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: D })

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 4 liquidated
      const txL4 = await troveManager.liquidate(defaulter_4, { from: owner });
      assert.isFalse(await sortedTroves.contains(defaulter_4))
      assert.isTrue(txL4.receipt.status)

      // Check scale is 2
      assert.equal(await stabilityPool.currentScale(), '2')
      assert.equal(await stabilityPool.P(), dec(1, 16)) //Scale changes and P changes:: P = 1e(12-5+9) = 1e16

      // E provides to SP
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: E })

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 5 liquidated
      const txL5 = await troveManager.liquidate(defaulter_5, { from: owner });
      assert.isFalse(await sortedTroves.contains(defaulter_5))
      assert.isTrue(txL5.receipt.status)

      // Check scale is 2
      assert.equal(await stabilityPool.currentScale(), '2')
      assert.equal(await stabilityPool.P(), dec(1, 11)) // P decreases: P = 1e(16-5) = 1e11

      // F provides to SP
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: F })

      // 1 month passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      assert.equal(await stabilityPool.currentEpoch(), '0')

      // Defaulter 6 liquidated
      const txL6 = await troveManager.liquidate(defaulter_6, { from: owner });
      assert.isFalse(await sortedTroves.contains(defaulter_6))
      assert.isTrue(txL6.receipt.status)

      // Check scale is 0, epoch is 1
      assert.equal(await stabilityPool.currentScale(), '0')
      assert.equal(await stabilityPool.currentEpoch(), '1')
      assert.equal(await stabilityPool.P(), dec(1, 18)) // P resets to 1e18 after pool-emptying

      // price doubles
      await priceFeed.setPrice(dec(200, 18));

      /* All depositors withdraw fully from SP.  Withdraw in reverse order, so that the largest remaining
      deposit (F) withdraws first, and does not get extra ZERO gains from the periods between withdrawals */
      for (depositor of [F, E, D, C, B, A]) {
        await stabilityPool.withdrawFromSP(dec(10000, 18), { from: depositor })
      }

      const ZEROGain_A = await zeroToken.balanceOf(A)
      const ZEROGain_B = await zeroToken.balanceOf(B)
      const ZEROGain_C = await zeroToken.balanceOf(C)
      const ZEROGain_D = await zeroToken.balanceOf(D)
      const ZEROGain_E = await zeroToken.balanceOf(E)
      const ZEROGain_F = await zeroToken.balanceOf(F)

      /* Expect each deposit to have earned 100% of the ZERO issuance for the month in which it was active, prior
     to the liquidation that mostly depleted it.  Error tolerance = 1e-3 tokens.*/
     

      const expectedGainA = issuance_M1.add(issuance_M2.div(toBN('100000')))
      const expectedGainB = issuance_M2.add(issuance_M3.div(toBN('100000'))).mul(toBN('99999')).div(toBN('100000'))
      const expectedGainC = issuance_M3.add(issuance_M4.div(toBN('100000'))).mul(toBN('99999')).div(toBN('100000'))
      const expectedGainD = issuance_M4.add(issuance_M5.div(toBN('100000'))).mul(toBN('99999')).div(toBN('100000'))
      const expectedGainE = issuance_M5.add(issuance_M6.div(toBN('100000'))).mul(toBN('99999')).div(toBN('100000'))
      const expectedGainF = issuance_M6.mul(toBN('99999')).div(toBN('100000'))

      assert.isAtMost(getDifference(expectedGainA, ZEROGain_A), 1e15)
      assert.isAtMost(getDifference(expectedGainB, ZEROGain_B), 1e15)
      assert.isAtMost(getDifference(expectedGainC, ZEROGain_C), 1e15)
      assert.isAtMost(getDifference(expectedGainD, ZEROGain_D), 1e15)

      assert.isAtMost(getDifference(expectedGainE, ZEROGain_E), 1e15)
      assert.isAtMost(getDifference(expectedGainF, ZEROGain_F), 1e15)
    })

    // --- FrontEnds and kickback rates

    // Simple case: 4 depositors, equal stake. No liquidations.
    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct ZERO gain. No liquidations. Front ends and kickback rates.", async () => {
      // Register 2 front ends
      const kickbackRate_F1 = toBN(dec(5, 17)) // F1 kicks 50% back to depositor
      const kickbackRate_F2 = toBN(dec(80, 16)) // F2 kicks 80% back to depositor

      await stabilityPool.registerFrontEnd(kickbackRate_F1, { from: frontEnd_1 })
      await stabilityPool.registerFrontEnd(kickbackRate_F2, { from: frontEnd_2 })

      const initialIssuance = await communityIssuanceTester.totalZEROIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens Trove with 10k SOV
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), whale, whale, dec(10000, 'ether'), { from: whale })

      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: A })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), A, A, dec(100, 'ether'), { from: A })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: B })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), B, B, dec(100, 'ether'), { from: B })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: C })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), C, C, dec(100, 'ether'), { from: C })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: D })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), D, D, dec(100, 'ether'), { from: D })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: E })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), E, E, dec(100, 'ether'), { from: E })

      // Check all ZERO balances are initially 0
      assert.equal(await zeroToken.balanceOf(A), 0)
      assert.equal(await zeroToken.balanceOf(B), 0)
      assert.equal(await zeroToken.balanceOf(C), 0)
      assert.equal(await zeroToken.balanceOf(D), 0)
      assert.equal(await zeroToken.balanceOf(frontEnd_1), 0)
      assert.equal(await zeroToken.balanceOf(frontEnd_2), 0)

      // A, B, C, D deposit
      await stabilityPool.provideToSP(dec(10000, 18), frontEnd_1, { from: A })
      await stabilityPool.provideToSP(dec(10000, 18), frontEnd_2, { from: B })
      await stabilityPool.provideToSP(dec(10000, 18), frontEnd_2, { from: C })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: D })

      // Check initial frontEnd stakes are correct:
      F1_stake = await stabilityPool.frontEndStakes(frontEnd_1)
      F2_stake = await stabilityPool.frontEndStakes(frontEnd_2)

      assert.equal(F1_stake, dec(10000, 18))
      assert.equal(F2_stake, dec(20000, 18))

      // One year passes
      await th.fastForwardTime(await getDuration(timeValues.SECONDS_IN_ONE_YEAR), web3.currentProvider)

      // E deposits, triggering ZERO gains for A,B,C,D,F1,F2. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: E })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: E })

      // Expected issuance for year 1 is 50% of total supply.
      const expectedIssuance_Y1 = toBN('0')
      
      // Get actual ZERO gains
      const A_ZEROGain_Y1 = toBN('0')
      const B_ZEROGain_Y1 = toBN('0')
      const C_ZEROGain_Y1 = toBN('0')
      const D_ZEROGain_Y1 = toBN('0')
      const F1_ZEROGain_Y1 = toBN('0')
      const F2_ZEROGain_Y1 = toBN('0')

      // Expected depositor and front-end gains
      const A_expectedGain_Y1 = toBN('0')
      const B_expectedGain_Y1 = toBN('0')
      const C_expectedGain_Y1 = toBN('0')
      const D_expectedGain_Y1 = toBN('0')

      const F1_expectedGain_Y1 = toBN('0')

      const F2_expectedGain_Y1 = toBN('0')

      // Check gains are correct, error tolerance = 1e-6 of a token
      assert.isAtMost(getDifference(A_ZEROGain_Y1, A_expectedGain_Y1), 1e12)
      assert.isAtMost(getDifference(B_ZEROGain_Y1, B_expectedGain_Y1), 1e12)
      assert.isAtMost(getDifference(C_ZEROGain_Y1, C_expectedGain_Y1), 1e12)
      assert.isAtMost(getDifference(D_ZEROGain_Y1, D_expectedGain_Y1), 1e12)

      assert.isAtMost(getDifference(F1_ZEROGain_Y1, F1_expectedGain_Y1), 1e12)
      assert.isAtMost(getDifference(F2_ZEROGain_Y1, F2_expectedGain_Y1), 1e12)

      // Another year passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // E deposits, triggering ZERO gains for A,B,CD,F1, F2. Withdraws immediately after
      await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: E })
      await stabilityPool.withdrawFromSP(dec(1, 18), { from: E })

      // Expected gains for each depositor in Y2(25% total issued).  .
      const expectedIssuance_Y2 = toBN('0')

      const expectedFinalIssuance = expectedIssuance_Y1.add(expectedIssuance_Y2)

      // Expected final gains
      const A_expectedFinalGain = toBN('0')
      const B_expectedFinalGain = toBN('0')
      const C_expectedFinalGain = toBN('0')
      const D_expectedFinalGain = toBN('0')

      const F1_expectedFinalGain = toBN('0')

      const F2_expectedFinalGain = toBN('0')

      // Each depositor fully withdraws
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: A })
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: B })
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: C })
      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: D })

      // Check ZERO balances increase by correct amount
      assert.isAtMost(getDifference((await zeroToken.balanceOf(A)), A_expectedFinalGain), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(B)), B_expectedFinalGain), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(C)), C_expectedFinalGain), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(D)), D_expectedFinalGain), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(frontEnd_1)), F1_expectedFinalGain), 1e12)
      assert.isAtMost(getDifference((await zeroToken.balanceOf(frontEnd_2)), F2_expectedFinalGain), 1e12)
    })

    // A, B, C, D deposit 10k,20k,30k,40k.
    // F1: A
    // F2: B, C
    // D makes a naked deposit (no front end)
    // Pool size: 100k
    // 1 month passes. 1st liquidation: 500. All deposits reduced by 500/1000 = 50%.  A:5000,   B:10000, C:15000,   D:20000
    // Pool size: 50k
    // E deposits 30k via F1                                                          A:5000,   B:10000, C:15000,   D:20000, E:30000
    // Pool size: 80k
    // 1 month passes. 2nd liquidation: 20k. All deposits reduced by 200/800 = 25%    A:3750, B:7500,  C:11250, D:15000, E:22500
    // Pool size: 60k
    // B tops up 40k                                                                  A:3750, B:47500, C:11250, D:1500, E:22500
    // Pool size: 100k
    // 1 month passes. 3rd liquidation: 10k. All deposits reduced by 10%.             A:3375, B:42750, C:10125, D:13500, E:20250
    // Pool size 90k
    // C withdraws 10k                                                                A:3375, B:42750, C:125, D:13500, E:20250
    // Pool size 80k
    // 1 month passes.
    // All withdraw
    it("withdrawFromSP(): Depositors with varying initial deposit withdraw correct ZERO gain. Front ends and kickback rates", async () => {
      // Register 2 front ends
      const F1_kickbackRate = toBN(dec(5, 17)) // F1 kicks 50% back to depositor
      const F2_kickbackRate = toBN(dec(80, 16)) // F2 kicks 80% back to depositor

      await stabilityPool.registerFrontEnd(F1_kickbackRate, { from: frontEnd_1 })
      await stabilityPool.registerFrontEnd(F2_kickbackRate, { from: frontEnd_2 })

      const initialIssuance = await communityIssuanceTester.totalZEROIssued()
      assert.equal(initialIssuance, 0)

      // Whale opens Trove with 10k SOV
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), whale, whale, dec(10000, 'ether'), { from: whale })

      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: A })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), A, A, dec(200, 'ether'), { from: A })
      await sovToken.approve(borrowerOperations.address, dec(800, 'ether'), { from: B })
      await borrowerOperations.openTrove(th._100pct, dec(60000, 18), B, B, dec(800, 'ether'), { from: B })
      await sovToken.approve(borrowerOperations.address, dec(400, 'ether'), { from: C })
      await borrowerOperations.openTrove(th._100pct, dec(30000, 18), C, C, dec(400, 'ether'), { from: C })
      await sovToken.approve(borrowerOperations.address, dec(500, 'ether'), { from: D })
      await borrowerOperations.openTrove(th._100pct, dec(40000, 18), D, D, dec(500, 'ether'), { from: D })

      await sovToken.approve(borrowerOperations.address, dec(400, 'ether'), { from: E })
      await borrowerOperations.openTrove(th._100pct, dec(30000, 18), E, E, dec(400, 'ether'), { from: E })

      // D1, D2, D3 open troves with total debt 50k, 30k, 10k respectively (inc. gas comp)
      await sovToken.approve(borrowerOperations.address, dec(500, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(50000, 18)), defaulter_1, defaulter_1, dec(500, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(20000, 18)), defaulter_2, defaulter_2, dec(200, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_3, defaulter_3, dec(100, 'ether'), { from: defaulter_3 })

      // Check all ZERO balances are initially 0
      assert.equal(await zeroToken.balanceOf(A), 0)
      assert.equal(await zeroToken.balanceOf(B), 0)
      assert.equal(await zeroToken.balanceOf(C), 0)
      assert.equal(await zeroToken.balanceOf(D), 0)
      assert.equal(await zeroToken.balanceOf(frontEnd_1), 0)
      assert.equal(await zeroToken.balanceOf(frontEnd_2), 0)

      // A, B, C, D deposit
      await stabilityPool.provideToSP(dec(10000, 18), frontEnd_1, { from: A })
      await stabilityPool.provideToSP(dec(20000, 18), frontEnd_2, { from: B })
      await stabilityPool.provideToSP(dec(30000, 18), frontEnd_2, { from: C })
      await stabilityPool.provideToSP(dec(40000, 18), ZERO_ADDRESS, { from: D })

      // Price Drops, defaulters become undercollateralized
      await priceFeed.setPrice(dec(105, 18))
      assert.isFalse(await th.checkRecoveryMode(contracts))

      // Check initial frontEnd stakes are correct:
      F1_stake = await stabilityPool.frontEndStakes(frontEnd_1)
      F2_stake = await stabilityPool.frontEndStakes(frontEnd_2)

      assert.equal(F1_stake, dec(10000, 18))
      assert.equal(F2_stake, dec(50000, 18))

      // Month 1 passes
      await th.fastForwardTime(await getDuration(timeValues.SECONDS_IN_ONE_MONTH), web3.currentProvider)

      assert.equal(await stabilityPool.getTotalZSUSDDeposits(), dec(100000, 18)) // total 100k

      // LIQUIDATION 1
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(defaulter_1))

      th.assertIsApproximatelyEqual(await stabilityPool.getTotalZSUSDDeposits(), dec(50000, 18))  // 50k

      // --- CHECK GAINS AFTER L1 ---

      // During month 1, deposit sizes are: A:10000, B:20000, C:30000, D:40000.  Total: 100000
      // Expected gains for each depositor after month 1 
      const A_share_M1 = toBN('0')
      const A_expectedZEROGain_M1 = toBN('0')

      const B_share_M1 = toBN('0')
      const B_expectedZEROGain_M1 = toBN('0')

      const C_share_M1 = toBN('0')
      const C_expectedZEROGain_M1 = toBN('0')

      const D_share_M1 = toBN('0')
      const D_expectedZEROGain_M1 = D_share_M1

      // F1's stake = A 
      const F1_expectedZEROGain_M1 = toBN('0')

      // F2's stake = B + C
      const F2_expectedZEROGain_M1 = toBN('0')

      // Check ZERO gain
      const A_ZEROGain_M1 = toBN('0')
      const B_ZEROGain_M1 = toBN('0')
      const C_ZEROGain_M1 = toBN('0')
      const D_ZEROGain_M1 = toBN('0')
      const F1_ZEROGain_M1 = toBN('0')
      const F2_ZEROGain_M1 = toBN('0')

      // Check gains are correct, error tolerance = 1e-3 of a token
      assert.isAtMost(getDifference(A_ZEROGain_M1, A_expectedZEROGain_M1), 1e15)
      assert.isAtMost(getDifference(B_ZEROGain_M1, B_expectedZEROGain_M1), 1e15)
      assert.isAtMost(getDifference(C_ZEROGain_M1, C_expectedZEROGain_M1), 1e15)
      assert.isAtMost(getDifference(D_ZEROGain_M1, D_expectedZEROGain_M1), 1e15)
      assert.isAtMost(getDifference(F1_ZEROGain_M1, F1_expectedZEROGain_M1), 1e15)
      assert.isAtMost(getDifference(F2_ZEROGain_M1, F2_expectedZEROGain_M1), 1e15)

      // E deposits 30k via F1
      await stabilityPool.provideToSP(dec(30000, 18), frontEnd_1, { from: E })

      th.assertIsApproximatelyEqual(await stabilityPool.getTotalZSUSDDeposits(), dec(80000, 18))

      // Month 2 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // LIQUIDATION 2
      await troveManager.liquidate(defaulter_2)
      assert.isFalse(await sortedTroves.contains(defaulter_2))

      th.assertIsApproximatelyEqual(await stabilityPool.getTotalZSUSDDeposits(), dec(60000, 18))

      const startTime = await communityIssuanceTester.deploymentTime()
      const currentTime = await th.getLatestBlockTimestamp(web3)
      const timePassed = toBN(currentTime).sub(startTime)

      // --- CHECK GAINS AFTER L2 ---

      // During month 2, deposit sizes:  A:5000,   B:10000, C:15000,  D:20000, E:30000. Total: 80000

      // Expected gains for each depositor after month 2 
      const A_share_M2 = toBN('0')
      const A_expectedZEROGain_M2 = toBN('0')

      const B_share_M2 = toBN('0')
      const B_expectedZEROGain_M2 = toBN('0')

      const C_share_M2 = toBN('0')
      const C_expectedZEROGain_M2 = toBN('0')

      const D_share_M2 = toBN('0')
      const D_expectedZEROGain_M2 = D_share_M2

      const E_share_M2 = toBN('0')
      const E_expectedZEROGain_M2 = toBN('0')

      // F1's stake = A + E
      const F1_expectedZEROGain_M2 = toBN('0')

      // F2's stake = B + C
      const F2_expectedZEROGain_M2 = toBN('0')

      // Check ZERO gains after month 2
      const A_ZEROGain_After_M2 = toBN('0')
      const B_ZEROGain_After_M2 = toBN('0')
      const C_ZEROGain_After_M2 = toBN('0')
      const D_ZEROGain_After_M2 = toBN('0')
      const E_ZEROGain_After_M2 = toBN('0')
      const F1_ZEROGain_After_M2 = toBN('0')
      const F2_ZEROGain_After_M2 = toBN('0')

      assert.isAtMost(getDifference(A_ZEROGain_After_M2, A_expectedZEROGain_M2.add(A_expectedZEROGain_M1)), 1e15)
      assert.isAtMost(getDifference(B_ZEROGain_After_M2, B_expectedZEROGain_M2.add(B_expectedZEROGain_M1)), 1e15)
      assert.isAtMost(getDifference(C_ZEROGain_After_M2, C_expectedZEROGain_M2.add(C_expectedZEROGain_M1)), 1e15)
      assert.isAtMost(getDifference(D_ZEROGain_After_M2, D_expectedZEROGain_M2.add(D_expectedZEROGain_M1)), 1e15)
      assert.isAtMost(getDifference(E_ZEROGain_After_M2, E_expectedZEROGain_M2), 1e15)

      // Check F1 balance is his M1 gain (it was paid out when E joined through F1)
      const F1_ZEROBalance_After_M2 = await zeroToken.balanceOf(frontEnd_1)
      assert.isAtMost(getDifference(F1_ZEROBalance_After_M2, F1_expectedZEROGain_M1), 1e15)

      // Check F1's ZERO gain in system after M2: Just their gain due to M2
      assert.isAtMost(getDifference(F1_ZEROGain_After_M2, F1_expectedZEROGain_M2), 1e15)

      // Check F2 ZERO gain in system after M2: the sum of their gains from M1 + M2
      assert.isAtMost(getDifference(F2_ZEROGain_After_M2, F2_expectedZEROGain_M2.add(F2_expectedZEROGain_M1)), 1e15)


      // B tops up 40k via F2
      await stabilityPool.provideToSP(dec(40000, 18), frontEnd_2, { from: B })

      th.assertIsApproximatelyEqual(await stabilityPool.getTotalZSUSDDeposits(), dec(100000, 18))

      // Month 3 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // LIQUIDATION 3
      await troveManager.liquidate(defaulter_3)
      assert.isFalse(await sortedTroves.contains(defaulter_3))

      th.assertIsApproximatelyEqual(await stabilityPool.getTotalZSUSDDeposits(), dec(90000, 18))

      // --- CHECK GAINS AFTER L3 ---

      // During month 3, deposit sizes: A:3750, B:47500, C:11250, D:15000, E:22500, Total: 100000

      // Expected gains for each depositor after month 3 
      const A_share_M3 = toBN('0')
      const A_expectedZEROGain_M3 = toBN('0')

      const B_share_M3 = toBN('0')
      const B_expectedZEROGain_M3 = toBN('0')

      const C_share_M3 = toBN('0')
      const C_expectedZEROGain_M3 = toBN('0')

      const D_share_M3 = toBN('0')
      const D_expectedZEROGain_M3 = D_share_M3

      const E_share_M3 = toBN('0')
      const E_expectedZEROGain_M3 = toBN('0')

      // F1's stake = A + E
      const F1_expectedZEROGain_M3 = toBN('0')

      // F2's stake = B + C
      const F2_expectedZEROGain_M3 = toBN('0')

      // Check ZERO gains after month 3
      const A_ZEROGain_After_M3 = toBN('0')
      const B_ZEROGain_After_M3 = toBN('0')
      const C_ZEROGain_After_M3 = toBN('0')
      const D_ZEROGain_After_M3 = toBN('0')
      const E_ZEROGain_After_M3 = toBN('0')
      const F1_ZEROGain_After_M3 = toBN('0')
      const F2_ZEROGain_After_M3 = toBN('0')

      // Expect A, C, D ZERO system gains to equal their gains from (M1 + M2 + M3)
      assert.isAtMost(getDifference(A_ZEROGain_After_M3, A_expectedZEROGain_M3.add(A_expectedZEROGain_M2).add(A_expectedZEROGain_M1)), 1e15)
      assert.isAtMost(getDifference(C_ZEROGain_After_M3, C_expectedZEROGain_M3.add(C_expectedZEROGain_M2).add(C_expectedZEROGain_M1)), 1e15)
      assert.isAtMost(getDifference(D_ZEROGain_After_M3, D_expectedZEROGain_M3.add(D_expectedZEROGain_M2).add(D_expectedZEROGain_M1)), 1e15)

      // Expect E's ZERO system gain to equal their gains from (M2 + M3)
      assert.isAtMost(getDifference(E_ZEROGain_After_M3, E_expectedZEROGain_M3.add(E_expectedZEROGain_M2)), 1e15)

      // Expect B ZERO system gains to equal gains just from M3 (his topup paid out his gains from M1 + M2)
      assert.isAtMost(getDifference(B_ZEROGain_After_M3, B_expectedZEROGain_M3), 1e15)

      // Expect B ZERO balance to equal gains from (M1 + M2)
      const B_ZEROBalance_After_M3 = await await zeroToken.balanceOf(B)
      assert.isAtMost(getDifference(B_ZEROBalance_After_M3, B_expectedZEROGain_M2.add(B_expectedZEROGain_M1)), 1e15)

      // Expect F1 ZERO system gains to equal their gain from (M2 + M3)
      assert.isAtMost(getDifference(F1_ZEROGain_After_M3, F1_expectedZEROGain_M3.add(F1_expectedZEROGain_M2)), 1e15)

      // Expect F1 ZERO balance to equal their M1 gain
      const F1_ZEROBalance_After_M3 = await zeroToken.balanceOf(frontEnd_1)
      assert.isAtMost(getDifference(F1_ZEROBalance_After_M3, F1_expectedZEROGain_M1), 1e15)

      // Expect F2 ZERO system gains to equal their gain from M3
      assert.isAtMost(getDifference(F2_ZEROGain_After_M3, F2_expectedZEROGain_M3), 1e15)

      // Expect F2 ZERO balance to equal their gain from M1 + M2
      const F2_ZEROBalance_After_M3 = await zeroToken.balanceOf(frontEnd_2)
      assert.isAtMost(getDifference(F2_ZEROBalance_After_M3, F2_expectedZEROGain_M2.add(F2_expectedZEROGain_M1)), 1e15)

      // Expect deposit C now to be 10125 ZSUSD
      const C_compoundedZSUSDDeposit = await stabilityPool.getCompoundedZSUSDDeposit(C)
      assert.isAtMost(getDifference(C_compoundedZSUSDDeposit, dec(10125, 18)), 1000)

      // --- C withdraws ---

      th.assertIsApproximatelyEqual(await stabilityPool.getTotalZSUSDDeposits(), dec(90000, 18))

      await stabilityPool.withdrawFromSP(dec(10000, 18), { from: C })

      th.assertIsApproximatelyEqual(await stabilityPool.getTotalZSUSDDeposits(), dec(80000, 18))

      // Month 4 passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // All depositors fully withdraw
      for (depositor of [A, B, C, D, E]) {
        await stabilityPool.withdrawFromSP(dec(100000, 18), { from: depositor })
        const compoundedZSUSDDeposit = await stabilityPool.getCompoundedZSUSDDeposit(depositor)
        assert.equal(compoundedZSUSDDeposit, '0')
      }

      // During month 4, deposit sizes: A:3375, B:42750, C:125, D:13500, E:20250, Total: 80000

      // Expected gains for each depositor after month 4
      const A_share_M4 = toBN('0')
      const A_expectedZEROGain_M4 = toBN('0')

      const B_share_M4 = toBN('0')
      const B_expectedZEROGain_M4 = toBN('0')

      const C_share_M4 = toBN('0')
      const C_expectedZEROGain_M4 = toBN('0')

      const D_share_M4 = toBN('0')
      const D_expectedZEROGain_M4 = D_share_M4

      const E_share_M4 = toBN('0')
      const E_expectedZEROGain_M4 = toBN('0')

      // F1's stake = A + E
      const F1_expectedZEROGain_M4 = toBN('0')

      // F2's stake = B + C
      const F2_expectedZEROGain_M4 = toBN('0')

      // Get final ZERO balances
      const A_FinalZEROBalance = await zeroToken.balanceOf(A)
      const B_FinalZEROBalance = await zeroToken.balanceOf(B)
      const C_FinalZEROBalance = await zeroToken.balanceOf(C)
      const D_FinalZEROBalance = await zeroToken.balanceOf(D)
      const E_FinalZEROBalance = await zeroToken.balanceOf(E)
      const F1_FinalZEROBalance = await zeroToken.balanceOf(frontEnd_1)
      const F2_FinalZEROBalance = await zeroToken.balanceOf(frontEnd_2)

      const A_expectedFinalZEROBalance = A_expectedZEROGain_M1
        .add(A_expectedZEROGain_M2)
        .add(A_expectedZEROGain_M3)
        .add(A_expectedZEROGain_M4)

      const B_expectedFinalZEROBalance = B_expectedZEROGain_M1
        .add(B_expectedZEROGain_M2)
        .add(B_expectedZEROGain_M3)
        .add(B_expectedZEROGain_M4)

      const C_expectedFinalZEROBalance = C_expectedZEROGain_M1
        .add(C_expectedZEROGain_M2)
        .add(C_expectedZEROGain_M3)
        .add(C_expectedZEROGain_M4)

      const D_expectedFinalZEROBalance = D_expectedZEROGain_M1
        .add(D_expectedZEROGain_M2)
        .add(D_expectedZEROGain_M3)
        .add(D_expectedZEROGain_M4)

      const E_expectedFinalZEROBalance = E_expectedZEROGain_M2
        .add(E_expectedZEROGain_M3)
        .add(E_expectedZEROGain_M4)

      const F1_expectedFinalZEROBalance = F1_expectedZEROGain_M1
        .add(F1_expectedZEROGain_M2)
        .add(F1_expectedZEROGain_M3)
        .add(F1_expectedZEROGain_M4)

      const F2_expectedFinalZEROBalance = F2_expectedZEROGain_M1
        .add(F2_expectedZEROGain_M2)
        .add(F2_expectedZEROGain_M3)
        .add(F2_expectedZEROGain_M4)

      assert.isAtMost(getDifference(A_FinalZEROBalance, A_expectedFinalZEROBalance), 1e15)
      assert.isAtMost(getDifference(B_FinalZEROBalance, B_expectedFinalZEROBalance), 1e15)
      assert.isAtMost(getDifference(C_FinalZEROBalance, C_expectedFinalZEROBalance), 1e15)
      assert.isAtMost(getDifference(D_FinalZEROBalance, D_expectedFinalZEROBalance), 1e15)
      assert.isAtMost(getDifference(E_FinalZEROBalance, E_expectedFinalZEROBalance), 1e15)
      assert.isAtMost(getDifference(F1_FinalZEROBalance, F1_expectedFinalZEROBalance), 1e15)
      assert.isAtMost(getDifference(F2_FinalZEROBalance, F2_expectedFinalZEROBalance), 1e15)
    })

    /* Serial scale changes, with one front end

    F1 kickbackRate: 80%

    A, B make deposit 5000 ZSUSD via F1
    1 month passes. L1 depletes P: P = 1e-5*P L1:  9999.9 ZSUSD, 1 SOV.  scale = 0
    C makes deposit 10000  via F1
    1 month passes. L2 depletes P: P = 1e-5*P L2:  9999.9 ZSUSD, 1 SOV  scale = 1
    D makes deposit 10000 via F1
    1 month passes. L3 depletes P: P = 1e-5*P L3:  9999.9 ZSUSD, 1 SOV scale = 1
    E makes deposit 10000 via F1
    1 month passes. L3 depletes P: P = 1e-5*P L4:  9999.9 ZSUSD, 1 SOV scale = 2
    A, B, C, D, E withdraw

    =========
    Expect front end withdraws ~3 month's worth of ZERO */

    it("withdrawFromSP(): Several deposits of 10k ZSUSD span one scale factor change. Depositors withdraw correct ZERO gains", async () => {
      const kickbackRate = toBN(dec(80, 16)) // F1 kicks 80% back to depositor
      await stabilityPool.registerFrontEnd(kickbackRate, { from: frontEnd_1 })

      // Whale opens Trove with 10k SOV
      await sovToken.approve(borrowerOperations.address, dec(10000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, dec(10000, 18), whale, whale, dec(10000, 'ether'), { from: whale })

      const _4_Defaulters = [defaulter_1, defaulter_2, defaulter_3, defaulter_4]

      for (const defaulter of _4_Defaulters) {
        // Defaulters 1-4 each withdraw to 9999.9 debt (including gas comp)
        await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter })
        await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(99999, 17)), defaulter, defaulter, dec(100, 'ether'), { from: defaulter })
      }

      // Confirm all would-be depositors have 0 ZERO
      for (const depositor of [A, B, C, D, E]) {
        assert.equal(await zeroToken.balanceOf(depositor), '0')
      }
      assert.equal(await zeroToken.balanceOf(frontEnd_1), '0')

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Check scale is 0
      assert.equal(await stabilityPool.currentScale(), '0')

      // A, B provides 5000 ZSUSD to SP
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: A })
      await borrowerOperations.openTrove(th._100pct, dec(5000, 18), A, A, dec(200, 'ether'), { from: A })
      await stabilityPool.provideToSP(dec(5000, 18), frontEnd_1, { from: A })
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: B })
      await borrowerOperations.openTrove(th._100pct, dec(5000, 18), B, B, dec(200, 'ether'), { from: B })
      await stabilityPool.provideToSP(dec(5000, 18), frontEnd_1, { from: B })

      // 1 month passes (M1)
      await th.fastForwardTime(await getDuration(timeValues.SECONDS_IN_ONE_MONTH), web3.currentProvider)

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.isFalse(await sortedTroves.contains(defaulter_1))
      assert.isTrue(txL1.receipt.status)

      // Check scale is 0
      assert.equal(await stabilityPool.currentScale(), '0')

      // C provides to SP
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: C })
      await borrowerOperations.openTrove(th._100pct, dec(99999, 17), C, C, dec(200, 'ether'), { from: C })
      await stabilityPool.provideToSP(dec(99999, 17), frontEnd_1, { from: C })

      // 1 month passes (M2)
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isFalse(await sortedTroves.contains(defaulter_2))
      assert.isTrue(txL2.receipt.status)

      // Check scale is 1
      assert.equal(await stabilityPool.currentScale(), '1')

      // D provides to SP
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: D })
      await borrowerOperations.openTrove(th._100pct, dec(99999, 17), D, D, dec(200, 'ether'), { from: D })
      await stabilityPool.provideToSP(dec(99999, 17), frontEnd_1, { from: D })

      // 1 month passes (M3)
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 3 liquidated
      const txL3 = await troveManager.liquidate(defaulter_3, { from: owner });
      assert.isFalse(await sortedTroves.contains(defaulter_3))
      assert.isTrue(txL3.receipt.status)

      // Check scale is 1
      assert.equal(await stabilityPool.currentScale(), '1')

      // E provides to SP
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: E })
      await borrowerOperations.openTrove(th._100pct, dec(99999, 17), E, E, dec(200, 'ether'), { from: E })
      await stabilityPool.provideToSP(dec(99999, 17), frontEnd_1, { from: E })

      // 1 month passes (M4)
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Defaulter 4 liquidated
      const txL4 = await troveManager.liquidate(defaulter_4, { from: owner });
      assert.isFalse(await sortedTroves.contains(defaulter_4))
      assert.isTrue(txL4.receipt.status)

      // Check scale is 2
      assert.equal(await stabilityPool.currentScale(), '2')

      /* All depositors withdraw fully from SP.  Withdraw in reverse order, so that the largest remaining
      deposit (F) withdraws first, and does not get extra ZERO gains from the periods between withdrawals */
      for (depositor of [E, D, C, B, A]) {
        await stabilityPool.withdrawFromSP(dec(10000, 18), { from: depositor })
      }

      const ZEROGain_A = await zeroToken.balanceOf(A)
      const ZEROGain_B = await zeroToken.balanceOf(B)
      const ZEROGain_C = await zeroToken.balanceOf(C)
      const ZEROGain_D = await zeroToken.balanceOf(D)
      const ZEROGain_E = await zeroToken.balanceOf(E)

      const ZEROGain_F1 = await zeroToken.balanceOf(frontEnd_1)

      /* Expect each deposit to have earned ZERO issuance for the month in which it was active, prior
     to the liquidation that mostly depleted it:
     
     expectedZEROGain_A:  (k * M1 / 2) + (k * M2 / 2) / 100000   
     expectedZEROGain_B:  (k * M1 / 2) + (k * M2 / 2) / 100000                           

     expectedZEROGain_C:  ((k * M2)  + (k * M3) / 100000) * 9999.9/10000   
     expectedZEROGain_D:  ((k * M3)  + (k * M4) / 100000) * 9999.9/10000 
     expectedZEROGain_E:  (k * M4) * 9999.9/10000 

     expectedZEROGain_F1:  (1 - k) * (M1 + M2 + M3 + M4)
     */

      const expectedZEROGain_A_and_B = toBN('0')

      const expectedZEROGain_C = toBN('0')

      const expectedZEROGain_D = toBN('0')

      const expectedZEROGain_E = toBN('0')

      const issuance1st4Months = toBN('0')
      
      const expectedZEROGain_F1 = toBN('0')

      assert.isAtMost(getDifference(expectedZEROGain_A_and_B, ZEROGain_A), 1e15)
      assert.isAtMost(getDifference(expectedZEROGain_A_and_B, ZEROGain_B), 1e15)
      assert.isAtMost(getDifference(expectedZEROGain_C, ZEROGain_C), 1e15)
      assert.isAtMost(getDifference(expectedZEROGain_D, ZEROGain_D), 1e15)
      assert.isAtMost(getDifference(expectedZEROGain_E, ZEROGain_E), 1e15)
      assert.isAtMost(getDifference(expectedZEROGain_F1, ZEROGain_F1), 1e15)
    })

  })
})

contract('Reset chain state', async accounts => { })
