const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const timeMachine = require('ganache-time-traveler');
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")

const { dec, toBN } = testHelpers.TestHelper
const th = testHelpers.TestHelper

contract('StabilityPool - Withdrawal of stability deposit - Reward calculations', async accounts => {

  const [owner,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    defaulter_4,
    defaulter_5,
    defaulter_6,
    whale,
    // whale_2,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
    graham,
    harriet,
    A,
    B,
    C,
    D,
    E,
    F,
    sovFeeCollector
  ] = accounts;

  const multisig = accounts[999];

  let contracts

  let priceFeed
  let zsusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations

  let gasPriceInWei
  let sovToken

  const ZERO_ADDRESS = th.ZERO_ADDRESS

  const getOpenTroveZSUSDAmount = async (totalDebt) => th.getOpenTroveZSUSDAmount(contracts, totalDebt)

  describe("Stability Pool Withdrawal", async () => {

    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice()
      contracts = await deploymentHelper.deployLiquityCore()
      const ZEROContracts = await deploymentHelper.deployZEROContracts(multisig)
      contracts.troveManager = await TroveManagerTester.new()
      contracts = await deploymentHelper.deployZSUSDToken(contracts)

      priceFeed = contracts.priceFeedTestnet
      zsusdToken = contracts.zsusdToken
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      sovToken = contracts.sovTokenTester

      await deploymentHelper.connectZEROContracts(ZEROContracts)
      await deploymentHelper.connectCoreContracts(contracts, ZEROContracts)
      await deploymentHelper.connectZEROContractsToCore(ZEROContracts, contracts, owner)

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
    // --- Compounding tests ---

    // --- withdrawFromSP()

    // --- Identical deposits, identical liquidation amounts---
    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and SOV Gain after one liquidation", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale})

      // Whale transfers 10k ZSUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter opens trove with 200% ICR and 10k ZSUSD net debt
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });

      // Check depositors' compounded deposit is 6666.66 ZSUSD and SOV Gain is 33.16 SOV
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '6666666666666666666666'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '6666666666666666666666'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '6666666666666666666666'), 10000)

      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, '33166666666666666667'), 10000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, '33166666666666666667'), 10000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, '33166666666666666667'), 10000)
    })

    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and SOV Gain after two identical liquidations", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Whale transfers 10k ZSUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit is 3333.33 ZSUSD and SOV Gain is 66.33 SOV
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })
      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '3333333333333333333333'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '3333333333333333333333'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '3333333333333333333333'), 10000)

      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, '66333333333333333333'), 10000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, '66333333333333333333'), 10000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, '66333333333333333333'), 10000)
    })

    it("withdrawFromSP():  Depositors with equal initial deposit withdraw correct compounded deposit and SOV Gain after three identical liquidations", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Whale transfers 10k ZSUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_3, defaulter_3, dec(100, 'ether'), { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });
      await troveManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit is 0 ZSUSD and SOV Gain is 99.5 SOV 
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '0'), 10000)

      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, dec(99500, 15)), 10000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, dec(99500, 15)), 10000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, dec(99500, 15)), 10000)
    })

    // --- Identical deposits, increasing liquidation amounts ---
    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and SOV Gain after two liquidations of increasing ZSUSD", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Whale transfers 10k ZSUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, '50000000000000000000', { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(5000, 18)), defaulter_1, defaulter_1, '50000000000000000000', { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, '70000000000000000000', { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(7000, 18)), defaulter_2, defaulter_2, '70000000000000000000', { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Check depositors' compounded deposit
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '6000000000000000000000'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '6000000000000000000000'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '6000000000000000000000'), 10000)

      // (0.5 + 0.7) * 99.5 / 3
      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, dec(398, 17)), 10000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, dec(398, 17)), 10000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, dec(398, 17)), 10000)
    })

    it("withdrawFromSP(): Depositors with equal initial deposit withdraw correct compounded deposit and SOV Gain after three liquidations of increasing ZSUSD", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Whale transfers 10k ZSUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, '50000000000000000000', { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(5000, 18)), defaulter_1, defaulter_1, '50000000000000000000', { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, '60000000000000000000', { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(6000, 18)), defaulter_2, defaulter_2, '60000000000000000000', { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, '70000000000000000000', { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(7000, 18)), defaulter_3, defaulter_3, '70000000000000000000', { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });
      await troveManager.liquidate(defaulter_3, { from: owner });

      // Check depositors' compounded deposit
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '4000000000000000000000'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '4000000000000000000000'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '4000000000000000000000'), 10000)

      // (0.5 + 0.6 + 0.7) * 99.5 / 3
      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, dec(597, 17)), 10000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, dec(597, 17)), 10000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, dec(597, 17)), 10000)
    })

    // --- Increasing deposits, identical liquidation amounts ---
    it("withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and SOV Gain after two identical liquidations", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Whale transfers 10k, 20k, 30k ZSUSD to A, B and C respectively who then deposit it to the SP
      await zsusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })
      await zsusdToken.transfer(bob, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: bob })
      await zsusdToken.transfer(carol, dec(30000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: carol })

      // 2 Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(20000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(30000, 18), { from: carol })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '6666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '13333333333333333333333'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '20000000000000000000000'), 100000)

      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, '33166666666666666667'), 100000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, '66333333333333333333'), 100000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, dec(995, 17)), 100000)
    })

    it("withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and SOV Gain after three identical liquidations", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Whale transfers 10k, 20k, 30k ZSUSD to A, B and C respectively who then deposit it to the SP
      await zsusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })
      await zsusdToken.transfer(bob, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: bob })
      await zsusdToken.transfer(carol, dec(30000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: carol })

      // Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_3, defaulter_3, dec(100, 'ether'), { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });
      await troveManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(20000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(30000, 18), { from: carol })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '5000000000000000000000'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '10000000000000000000000'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '15000000000000000000000'), 100000)

      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, '49750000000000000000'), 100000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, '149250000000000000000'), 100000)
    })

    // --- Varied deposits and varied liquidation amount ---
    it("withdrawFromSP(): Depositors with varying deposits withdraw correct compounded deposit and SOV Gain after three varying liquidations", async () => {
      // Whale opens Trove with 1m SOV
      await sovToken.approve(borrowerOperations.address, dec(1000000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(1000000, 18)), whale, whale, dec(1000000, 'ether'), { from: whale })

      /* Depositors provide:-
      Alice:  2000 ZSUSD
      Bob:  456000 ZSUSD
      Carol: 13100 ZSUSD */
      // Whale transfers ZSUSD to  A, B and C respectively who then deposit it to the SP
      await zsusdToken.transfer(alice, dec(2000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(2000, 18), ZERO_ADDRESS, { from: alice })
      await zsusdToken.transfer(bob, dec(456000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(456000, 18), ZERO_ADDRESS, { from: bob })
      await zsusdToken.transfer(carol, dec(13100, 18), { from: whale })
      await stabilityPool.provideToSP(dec(13100, 18), ZERO_ADDRESS, { from: carol })

      /* Defaulters open troves
     
      Defaulter 1: 207000 ZSUSD & 2160 SOV
      Defaulter 2: 5000 ZSUSD & 50 SOV
      Defaulter 3: 46700 ZSUSD & 500 SOV
      */
      await sovToken.approve(borrowerOperations.address, dec(2160, 18), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('207000000000000000000000'), defaulter_1, defaulter_1, dec(2160, 18), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(50, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(5, 21)), defaulter_2, defaulter_2, dec(50, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(500, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('46700000000000000000000'), defaulter_3, defaulter_3, dec(500, 'ether'), { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Three defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });
      await troveManager.liquidate(defaulter_3, { from: owner });

      // Depositors attempt to withdraw everything
      const txA = await stabilityPool.withdrawFromSP(dec(500000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(500000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(500000, 18), { from: carol })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      // ()
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '901719380174061000000'), 100000000000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '205592018679686000000000'), 10000000000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '5906261940140100000000'), 10000000000)

      // 2710 * 0.995 * {2000, 456000, 13100}/4711
      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, '11447463383570366500'), 10000000000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, '2610021651454043834000'), 10000000000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, '74980885162385912900'), 10000000000)
    })

    // --- Deposit enters at t > 0

    it("withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 1 liquidation. All deposits and liquidations = 100 ZSUSD.  A, B, C, D withdraw correct ZSUSD deposit and SOV Gain", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether') , { from: whale })

      // Whale transfers 10k ZSUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_3, defaulter_3, dec(100, 'ether'), { from: defaulter_3 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Whale transfers 10k to Dennis who then provides to SP
      await zsusdToken.transfer(dennis, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: dennis })

      // Third defaulter liquidated
      await troveManager.liquidate(defaulter_3, { from: owner });

      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })
      const txD = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: dennis })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()
      const dennis_SOVWithdrawn = th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()

      console.log()
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '1666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '1666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '1666666666666666666666'), 100000)

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), '5000000000000000000000'), 100000)

      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, '82916666666666666667'), 100000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, '82916666666666666667'), 100000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, '82916666666666666667'), 100000)

      assert.isAtMost(th.getDifference(dennis_SOVWithdrawn, '49750000000000000000'), 100000)
    })

    it("withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. All deposits and liquidations = 100 ZSUSD.  A, B, C, D withdraw correct ZSUSD deposit and SOV Gain", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Whale transfers 10k ZSUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_3, defaulter_3, dec(100, 'ether'), { from: defaulter_3 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_4 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_4, defaulter_4, dec(100, 'ether'), { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Dennis opens a trove and provides to SP
      await zsusdToken.transfer(dennis, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: dennis })

      // Third and fourth defaulters liquidated
      await troveManager.liquidate(defaulter_3, { from: owner });
      await troveManager.liquidate(defaulter_4, { from: owner });

      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })
      const txD = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: dennis })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()
      const dennis_SOVWithdrawn = th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), '0'), 100000)

      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(dennis_SOVWithdrawn, dec(995, 17)), 100000)
    })

    it("withdrawFromSP(): A, B, C Deposit -> 2 liquidations -> D deposits -> 2 liquidations. Various deposit and liquidation vals.  A, B, C, D withdraw correct ZSUSD deposit and SOV Gain", async () => {
      // Whale opens Trove with 1m SOV
      await sovToken.approve(borrowerOperations.address, dec(1000000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(1000000, 18)), whale, whale, dec(1000000, 'ether'), { from: whale })

      /* Depositors open troves and make SP deposit:
      Alice: 60000 ZSUSD
      Bob: 20000 ZSUSD
      Carol: 15000 ZSUSD
      */
      // Whale transfers ZSUSD to  A, B and C respectively who then deposit it to the SP
      await zsusdToken.transfer(alice, dec(60000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(60000, 18), ZERO_ADDRESS, { from: alice })
      await zsusdToken.transfer(bob, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: bob })
      await zsusdToken.transfer(carol, dec(15000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(15000, 18), ZERO_ADDRESS, { from: carol })

      /* Defaulters open troves:
      Defaulter 1:  10000 ZSUSD, 100 SOV
      Defaulter 2:  25000 ZSUSD, 250 SOV
      Defaulter 3:  5000 ZSUSD, 50 SOV
      Defaulter 4:  40000 ZSUSD, 400 SOV
      */
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, '250000000000000000000', { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(25000, 18)), defaulter_2, defaulter_2, '250000000000000000000', { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, '50000000000000000000', { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(5000, 18)), defaulter_3, defaulter_3, '50000000000000000000', { from: defaulter_3 })
      await sovToken.approve(borrowerOperations.address, dec(400, 'ether'), { from: defaulter_4 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(40000, 18)), defaulter_4, defaulter_4, dec(400, 'ether'), { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Dennis provides 25000 ZSUSD
      await zsusdToken.transfer(dennis, dec(25000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(25000, 18), ZERO_ADDRESS, { from: dennis })

      // Last two defaulters liquidated
      await troveManager.liquidate(defaulter_3, { from: owner });
      await troveManager.liquidate(defaulter_4, { from: owner });

      // Each depositor withdraws as much as possible
      const txA = await stabilityPool.withdrawFromSP(dec(100000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(100000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(100000, 18), { from: carol })
      const txD = await stabilityPool.withdrawFromSP(dec(100000, 18), { from: dennis })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()
      const dennis_SOVWithdrawn = th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '17832817337461300000000'), 100000000000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '5944272445820430000000'), 100000000000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '4458204334365320000000'), 100000000000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), '11764705882352900000000'), 100000000000)

      // 3.5*0.995 * {60000,20000,15000,0} / 95000 + 450*0.995 * {60000/950*{60000,20000,15000},25000} / (120000-35000)
      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, '419563467492260055900'), 100000000000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, '139854489164086692700'), 100000000000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, '104890866873065014000'), 100000000000)
      assert.isAtMost(th.getDifference(dennis_SOVWithdrawn, '131691176470588233700'), 100000000000)
    })

    // --- Depositor leaves ---

    it("withdrawFromSP(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. All deposits and liquidations = 100 ZSUSD.  A, B, C, D withdraw correct ZSUSD deposit and SOV Gain", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether') , { from: whale })

      // Whale transfers 10k ZSUSD to A, B and C who then deposit it to the SP
      const depositors = [alice, bob, carol, dennis]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_3, defaulter_3, dec(100, 'ether'), { from: defaulter_3 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_4 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_4, defaulter_4, dec(100, 'ether'), { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Dennis withdraws his deposit and SOV gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txD = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: dennis })
      await priceFeed.setPrice(dec(100, 18))

      const dennis_SOVWithdrawn = th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), '5000000000000000000000'), 100000)
      assert.isAtMost(th.getDifference(dennis_SOVWithdrawn, '49750000000000000000'), 100000)

      // Two more defaulters are liquidated
      await troveManager.liquidate(defaulter_3, { from: owner });
      await troveManager.liquidate(defaulter_4, { from: owner });

      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '0'), 1000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '0'), 1000)

      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, dec(995, 17)), 100000)
    })

    it("withdrawFromSP(): A, B, C, D deposit -> 2 liquidations -> D withdraws -> 2 liquidations. Various deposit and liquidation vals. A, B, C, D withdraw correct ZSUSD deposit and SOV Gain", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      /* Initial deposits:
      Alice: 20000 ZSUSD
      Bob: 25000 ZSUSD
      Carol: 12500 ZSUSD
      Dennis: 40000 ZSUSD
      */
      // Whale transfers ZSUSD to  A, B,C and D respectively who then deposit it to the SP
      await zsusdToken.transfer(alice, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: alice })
      await zsusdToken.transfer(bob, dec(25000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(25000, 18), ZERO_ADDRESS, { from: bob })
      await zsusdToken.transfer(carol, dec(12500, 18), { from: whale })
      await stabilityPool.provideToSP(dec(12500, 18), ZERO_ADDRESS, { from: carol })
      await zsusdToken.transfer(dennis, dec(40000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(40000, 18), ZERO_ADDRESS, { from: dennis })

      /* Defaulters open troves:
      Defaulter 1: 10000 ZSUSD
      Defaulter 2: 20000 ZSUSD
      Defaulter 3: 30000 ZSUSD
      Defaulter 4: 5000 ZSUSD
      */
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(20000, 18)), defaulter_2, defaulter_2, dec(200, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(300, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(30000, 18)), defaulter_3, defaulter_3, dec(300, 'ether'), { from: defaulter_3 })
      await sovToken.approve(borrowerOperations.address, '50000000000000000000', { from: defaulter_4 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(5000, 18)), defaulter_4, defaulter_4, '50000000000000000000', { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Dennis withdraws his deposit and SOV gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txD = await stabilityPool.withdrawFromSP(dec(40000, 18), { from: dennis })
      await priceFeed.setPrice(dec(100, 18))

      const dennis_SOVWithdrawn = th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), '27692307692307700000000'), 100000000000)
      // 300*0.995 * 40000/97500
      assert.isAtMost(th.getDifference(dennis_SOVWithdrawn, '122461538461538466100'), 100000000000)

      // Two more defaulters are liquidated
      await troveManager.liquidate(defaulter_3, { from: owner });
      await troveManager.liquidate(defaulter_4, { from: owner });

      const txA = await stabilityPool.withdrawFromSP(dec(100000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(100000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(100000, 18), { from: carol })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '1672240802675590000000'), 10000000000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '2090301003344480000000'), 100000000000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '1045150501672240000000'), 100000000000)

      // 300*0.995 * {20000,25000,12500}/97500 + 350*0.995 * {20000,25000,12500}/57500
      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, '182361204013377919900'), 100000000000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, '227951505016722411000'), 100000000000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, '113975752508361205500'), 100000000000)
    })

    // --- One deposit enters at t > 0, and another leaves later ---
    it("withdrawFromSP(): A, B, D deposit -> 2 liquidations -> C makes deposit -> 1 liquidation -> D withdraws -> 1 liquidation. All deposits: 100 ZSUSD. Liquidations: 100,100,100,50.  A, B, C, D withdraw correct ZSUSD deposit and SOV Gain", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Whale transfers 10k ZSUSD to A, B and D who then deposit it to the SP
      const depositors = [alice, bob, dennis]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulters open troves
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_3, defaulter_3, dec(100, 'ether'), { from: defaulter_3 })
      await sovToken.approve(borrowerOperations.address, '50000000000000000000', { from: defaulter_4 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(5000, 18)), defaulter_4, defaulter_4, '50000000000000000000', { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // First two defaulters liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Carol makes deposit
      await zsusdToken.transfer(carol, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: carol })

      await troveManager.liquidate(defaulter_3, { from: owner });

      // Dennis withdraws his deposit and SOV gain
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txD = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: dennis })
      await priceFeed.setPrice(dec(100, 18))

      const dennis_SOVWithdrawn = th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), '1666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference(dennis_SOVWithdrawn, '82916666666666666667'), 100000)

      await troveManager.liquidate(defaulter_4, { from: owner });

      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '2000000000000000000000'), 100000)

      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, '92866666666666666667'), 100000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, '92866666666666666667'), 100000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, '79600000000000000000'), 100000)
    })

    // --- Tests for full offset - Pool empties to 0 ---

    // A, B deposit 10000
    // L1 cancels 20000, 200
    // C, D deposit 10000
    // L2 cancels 10000,100

    // A, B withdraw 0ZSUSD & 100e
    // C, D withdraw 5000ZSUSD  & 500e
    it("withdrawFromSP(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Whale transfers 10k ZSUSD to A, B who then deposit it to the SP
      const depositors = [alice, bob]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // 2 Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(20000, 18)), defaulter_1, defaulter_1, dec(200, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated. 20000 ZSUSD fully offset with pool.
      await troveManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 10000 ZSUSD
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 2 liquidated. 10000 ZSUSD offset
      await troveManager.liquidate(defaulter_2, { from: owner });

      // await borrowerOperations.openTrove(th._100pct, dec(1, 18), account, account, { from: erin, value: dec(2, 'ether') })
      // await stabilityPool.provideToSP(dec(1, 18), ZERO_ADDRESS, { from: erin })

      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })
      const txD = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: dennis })

      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()
      const dennis_SOVWithdrawn = th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()

      // Expect Alice And Bob's compounded deposit to be 0 ZSUSD
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '0'), 10000)

      // Expect Alice and Bob's SOV Gain to be 100 SOV
      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, dec(995, 17)), 100000)

      // Expect Carol And Dennis' compounded deposit to be 50 ZSUSD
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '5000000000000000000000'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), '5000000000000000000000'), 100000)

      // Expect Carol and and Dennis SOV Gain to be 50 SOV
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, '49750000000000000000'), 100000)
      assert.isAtMost(th.getDifference(dennis_SOVWithdrawn, '49750000000000000000'), 100000)
    })

    // A, B deposit 10000
    // L1 cancels 10000, 1
    // L2 10000, 200 empties Pool
    // C, D deposit 10000
    // L3 cancels 10000, 1 
    // L2 20000, 200 empties Pool
    it("withdrawFromSP(): Pool-emptying liquidation increases epoch by one, resets scaleFactor to 0, and resets P to 1e18", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Whale transfers 10k ZSUSD to A, B who then deposit it to the SP
      const depositors = [alice, bob]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // 4 Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_3, defaulter_3, dec(100, 'ether'), { from: defaulter_3 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_4 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_4, defaulter_4, dec(100, 'ether'), { from: defaulter_4 })

      // price drops by 50%: defaulter ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      const epoch_0 = (await stabilityPool.currentEpoch()).toString()
      const scale_0 = (await stabilityPool.currentScale()).toString()
      const P_0 = (await stabilityPool.P()).toString()

      assert.equal(epoch_0, '0')
      assert.equal(scale_0, '0')
      assert.equal(P_0, dec(1, 18))

      // Defaulter 1 liquidated. 10--0 ZSUSD fully offset, Pool remains non-zero
      await troveManager.liquidate(defaulter_1, { from: owner });

      //Check epoch, scale and sum
      const epoch_1 = (await stabilityPool.currentEpoch()).toString()
      const scale_1 = (await stabilityPool.currentScale()).toString()
      const P_1 = (await stabilityPool.P()).toString()

      assert.equal(epoch_1, '0')
      assert.equal(scale_1, '0')
      assert.isAtMost(th.getDifference(P_1, dec(5, 17)), 1000)

      // Defaulter 2 liquidated. 1--00 ZSUSD, empties pool
      await troveManager.liquidate(defaulter_2, { from: owner });

      //Check epoch, scale and sum
      const epoch_2 = (await stabilityPool.currentEpoch()).toString()
      const scale_2 = (await stabilityPool.currentScale()).toString()
      const P_2 = (await stabilityPool.P()).toString()

      assert.equal(epoch_2, '1')
      assert.equal(scale_2, '0')
      assert.equal(P_2, dec(1, 18))

      // Carol, Dennis each deposit 10000 ZSUSD
      const depositors_2 = [carol, dennis]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 3 liquidated. 10000 ZSUSD fully offset, Pool remains non-zero
      await troveManager.liquidate(defaulter_3, { from: owner });

      //Check epoch, scale and sum
      const epoch_3 = (await stabilityPool.currentEpoch()).toString()
      const scale_3 = (await stabilityPool.currentScale()).toString()
      const P_3 = (await stabilityPool.P()).toString()

      assert.equal(epoch_3, '1')
      assert.equal(scale_3, '0')
      assert.isAtMost(th.getDifference(P_3, dec(5, 17)), 1000)

      // Defaulter 4 liquidated. 10000 ZSUSD, empties pool
      await troveManager.liquidate(defaulter_4, { from: owner });

      //Check epoch, scale and sum
      const epoch_4 = (await stabilityPool.currentEpoch()).toString()
      const scale_4 = (await stabilityPool.currentScale()).toString()
      const P_4 = (await stabilityPool.P()).toString()

      assert.equal(epoch_4, '2')
      assert.equal(scale_4, '0')
      assert.equal(P_4, dec(1, 18))
    })


    // A, B deposit 10000
    // L1 cancels 20000, 200
    // C, D, E deposit 10000, 20000, 30000
    // L2 cancels 10000,100 

    // A, B withdraw 0 ZSUSD & 100e
    // C, D withdraw 5000 ZSUSD  & 50e
    it("withdrawFromSP(): Depositors withdraw correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether') , { from: whale })

      // Whale transfers 10k ZSUSD to A, B who then deposit it to the SP
      const depositors = [alice, bob]
      for (account of depositors) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // 2 Defaulters open trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(20000, 18)), defaulter_1, defaulter_1, dec(200, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated. 20000 ZSUSD fully offset with pool.
      await troveManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis, Erin each deposit 10000, 20000, 30000 ZSUSD respectively
      await zsusdToken.transfer(carol, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: carol })

      await zsusdToken.transfer(dennis, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: dennis })

      await zsusdToken.transfer(erin, dec(30000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: erin })

      // Defaulter 2 liquidated. 10000 ZSUSD offset
      await troveManager.liquidate(defaulter_2, { from: owner });

      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })
      const txD = await stabilityPool.withdrawFromSP(dec(20000, 18), { from: dennis })
      const txE = await stabilityPool.withdrawFromSP(dec(30000, 18), { from: erin })

      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()
      const dennis_SOVWithdrawn = th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()
      const erin_SOVWithdrawn = th.getEventArgByName(txE, 'SOVGainWithdrawn', '_SOV').toString()

      // Expect Alice And Bob's compounded deposit to be 0 ZSUSD
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '0'), 10000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '0'), 10000)

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '8333333333333333333333'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), '16666666666666666666666'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(erin)).toString(), '25000000000000000000000'), 100000)

      //Expect Alice and Bob's SOV Gain to be 1 SOV
      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, dec(995, 17)), 100000)

      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, '16583333333333333333'), 100000)
      assert.isAtMost(th.getDifference(dennis_SOVWithdrawn, '33166666666666666667'), 100000)
      assert.isAtMost(th.getDifference(erin_SOVWithdrawn, '49750000000000000000'), 100000)
    })

    // A deposits 10000
    // L1, L2, L3 liquidated with 10000 ZSUSD each
    // A withdraws all
    // Expect A to withdraw 0 deposit and ether only from reward L1
    it("withdrawFromSP(): single deposit fully offset. After subsequent liquidations, depositor withdraws 0 deposit and *only* the SOV Gain from one liquidation", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      await zsusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1,2,3 withdraw 10000 ZSUSD
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(10000, 18)), defaulter_3, defaulter_3, dec(100, 'ether'), { from: defaulter_3 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1, 2  and 3 liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });
      await troveManager.liquidate(defaulter_2, { from: owner });
      await troveManager.liquidate(defaulter_3, { from: owner });

      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), 0), 100000)
      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, dec(995, 17)), 100000)
    })

    //--- Serial full offsets ---

    // A,B deposit 10000 ZSUSD
    // L1 cancels 20000 ZSUSD, 2E
    // B,C deposits 10000 ZSUSD
    // L2 cancels 20000 ZSUSD, 2E
    // E,F deposit 10000 ZSUSD
    // L3 cancels 20000, 200E
    // G,H deposits 10000
    // L4 cancels 20000, 200E

    // Expect all depositors withdraw 0 ZSUSD and 100 SOV

    it("withdrawFromSP(): Depositor withdraws correct compounded deposit after liquidation empties the pool", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // 4 Defaulters open trove with 200% ICR
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

      // Alice, Bob each deposit 10k ZSUSD
      const depositors_1 = [alice, bob]
      for (account of depositors_1) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 1 liquidated. 20k ZSUSD fully offset with pool.
      await troveManager.liquidate(defaulter_1, { from: owner });

      // Carol, Dennis each deposit 10000 ZSUSD
      const depositors_2 = [carol, dennis]
      for (account of depositors_2) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 2 liquidated. 10000 ZSUSD offset
      await troveManager.liquidate(defaulter_2, { from: owner });

      // Erin, Flyn each deposit 10000 ZSUSD
      const depositors_3 = [erin, flyn]
      for (account of depositors_3) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 3 liquidated. 10000 ZSUSD offset
      await troveManager.liquidate(defaulter_3, { from: owner });

      // Graham, Harriet each deposit 10000 ZSUSD
      const depositors_4 = [graham, harriet]
      for (account of depositors_4) {
        await zsusdToken.transfer(account, dec(10000, 18), { from: whale })
        await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: account })
      }

      // Defaulter 4 liquidated. 10k ZSUSD offset
      await troveManager.liquidate(defaulter_4, { from: owner });

      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })
      const txD = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: dennis })
      const txE = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: erin })
      const txF = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: flyn })
      const txG = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: graham })
      const txH = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: harriet })

      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()
      const dennis_SOVWithdrawn = th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()
      const erin_SOVWithdrawn = th.getEventArgByName(txE, 'SOVGainWithdrawn', '_SOV').toString()
      const flyn_SOVWithdrawn = th.getEventArgByName(txF, 'SOVGainWithdrawn', '_SOV').toString()
      const graham_SOVWithdrawn = th.getEventArgByName(txG, 'SOVGainWithdrawn', '_SOV').toString()
      const harriet_SOVWithdrawn = th.getEventArgByName(txH, 'SOVGainWithdrawn', '_SOV').toString()

      // Expect all deposits to be 0 ZSUSD
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(alice)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(erin)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(flyn)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(graham)).toString(), '0'), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(harriet)).toString(), '0'), 100000)

      /* Expect all SOV gains to be 100 SOV:  Since each liquidation of empties the pool, depositors
      should only earn SOV from the single liquidation that cancelled with their deposit */
      assert.isAtMost(th.getDifference(alice_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(dennis_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(erin_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(flyn_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(graham_SOVWithdrawn, dec(995, 17)), 100000)
      assert.isAtMost(th.getDifference(harriet_SOVWithdrawn, dec(995, 17)), 100000)

      const finalEpoch = (await stabilityPool.currentEpoch()).toString()
      assert.equal(finalEpoch, 4)
    })

    // --- Scale factor tests ---

    // A deposits 10000
    // L1 brings P close to boundary, i.e. 9e-9: liquidate 9999.99991
    // A withdraws all
    // B deposits 10000
    // L2 of 9900 ZSUSD, should bring P slightly past boundary i.e. 1e-9 -> 1e-10

    // expect d(B) = d0(B)/100
    // expect correct SOV gain, i.e. all of the reward
    it("withdrawFromSP(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and SOV Gain after one liquidation", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      await zsusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 withdraws 'almost' 10000 ZSUSD:  9999.99991 ZSUSD
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('9999999910000000000000'), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })

      assert.equal(await stabilityPool.currentScale(), '0')

      // Defaulter 2 withdraws 9900 ZSUSD
      await sovToken.approve(borrowerOperations.address, dec(60, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(9900, 18)), defaulter_2, defaulter_2, dec(60, 'ether'), { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P reduced to 9e9.
      await troveManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await stabilityPool.P()).toString(), dec(9, 9))

      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      await priceFeed.setPrice(dec(100, 18))

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = await th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()

      await zsusdToken.transfer(bob, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: bob })

      // Defaulter 2 liquidated.  9900 ZSUSD liquidated. P altered by a factor of 1-(9900/10000) = 0.01.  Scale changed.
      await troveManager.liquidate(defaulter_2, { from: owner });

      assert.equal(await stabilityPool.currentScale(), '1')

      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const bob_SOVWithdrawn = await th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()

      // Expect Bob to withdraw 1% of initial deposit (100 ZSUSD) and all the liquidated SOV (60 ether)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), '100000000000000000000'), 100000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, '59700000000000000000'), 100000)
    })

    // A deposits 10000
    // L1 brings P close to boundary, i.e. 9e-9: liquidate 9999.99991 ZSUSD
    // A withdraws all
    // B, C, D deposit 10000, 20000, 30000
    // L2 of 59400, should bring P slightly past boundary i.e. 1e-9 -> 1e-10

    // expect d(B) = d0(B)/100
    // expect correct SOV gain, i.e. all of the reward
    it("withdrawFromSP(): Several deposits of varying amounts span one scale factor change. Depositors withdraw correct compounded deposit and SOV Gain after one liquidation", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      await zsusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 withdraws 'almost' 10k ZSUSD.
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('9999999910000000000000'), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })

      // Defaulter 2 withdraws 59400 ZSUSD
      await sovToken.approve(borrowerOperations.address, dec(330, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('59400000000000000000000'), defaulter_2, defaulter_2, dec(330, 'ether'), { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P reduced to 9e9
      await troveManager.liquidate(defaulter_1, { from: owner });
      assert.equal((await stabilityPool.P()).toString(), dec(9, 9))

      assert.equal(await stabilityPool.currentScale(), '0')

      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      await priceFeed.setPrice(dec(100, 18))

      //B, C, D deposit to Stability Pool
      await zsusdToken.transfer(bob, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: bob })

      await zsusdToken.transfer(carol, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: carol })

      await zsusdToken.transfer(dennis, dec(30000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: dennis })

      // 54000 ZSUSD liquidated.  P altered by a factor of 1-(59400/60000) = 0.01. Scale changed.
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      assert.equal(await stabilityPool.currentScale(), '1')

      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(20000, 18), { from: carol })
      const txD = await stabilityPool.withdrawFromSP(dec(30000, 18), { from: dennis })

      /* Expect depositors to withdraw 1% of their initial deposit, and an SOV gain 
      in proportion to their initial deposit:
     
      Bob:  1000 ZSUSD, 55 Ether
      Carol:  2000 ZSUSD, 110 Ether
      Dennis:  3000 ZSUSD, 165 Ether
     
      Total: 6000 ZSUSD, 300 Ether
      */
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), dec(100, 18)), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), dec(200, 18)), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), dec(300, 18)), 100000)

      const bob_SOVWithdrawn = await th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = await th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()
      const dennis_SOVWithdrawn = await th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()

      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, '54725000000000000000'), 100000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, '109450000000000000000'), 100000)
      assert.isAtMost(th.getDifference(dennis_SOVWithdrawn, '164175000000000000000'), 100000)
    })

    // Deposit's SOV reward spans one scale change - deposit reduced by correct amount

    // A make deposit 10000 ZSUSD
    // L1 brings P to 1e-5*P. L1:  9999.9000000000000000 ZSUSD
    // A withdraws
    // B makes deposit 10000 ZSUSD
    // L2 decreases P again by 1e-5, over the scale boundary: 9999.9000000000000000 (near to the 10000 ZSUSD total deposits)
    // B withdraws
    // expect d(B) = d0(B) * 1e-5
    // expect B gets entire SOV gain from L2
    it("withdrawFromSP(): deposit spans one scale factor change: Single depositor withdraws correct compounded deposit and SOV Gain after one liquidation", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      await zsusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 and default 2 each withdraw 9999.999999999 ZSUSD
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(99999, 17)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(99999, 17)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })

      // price drops by 50%: defaulter 1 ICR falls to 100%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P updated to  to 1e13
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 13))  // P decreases. P = 1e(18-5) = 1e13
      assert.equal(await stabilityPool.currentScale(), '0')

      // Alice withdraws
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      await priceFeed.setPrice(dec(100, 18))

      // Bob deposits 10k ZSUSD
      await zsusdToken.transfer(bob, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: bob })

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 17))  // Scale changes and P changes. P = 1e(13-5+9) = 1e17
      assert.equal(await stabilityPool.currentScale(), '1')

      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const bob_SOVWithdrawn = await th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()

      // Bob should withdraw 1e-5 of initial deposit: 0.1 ZSUSD and the full SOV gain of 100 ether
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), dec(1, 17)), 100000)
      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, dec(995, 17)), 100000000000)
    })

    // A make deposit 10000 ZSUSD
    // L1 brings P to 1e-5*P. L1:  9999.9000000000000000 ZSUSD
    // A withdraws
    // B,C D make deposit 10000, 20000, 30000
    // L2 decreases P again by 1e-5, over boundary. L2: 59999.4000000000000000  (near to the 60000 ZSUSD total deposits)
    // B withdraws
    // expect d(B) = d0(B) * 1e-5
    // expect B gets entire SOV gain from L2
    it("withdrawFromSP(): Several deposits of varying amounts span one scale factor change. Depositors withdraws correct compounded deposit and SOV Gain after one liquidation", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      await zsusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 and default 2 withdraw up to debt of 9999.9 ZSUSD and 59999.4 ZSUSD
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('9999900000000000000000'), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(600, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('59999400000000000000000'), defaulter_2, defaulter_2, dec(600, 'ether'), { from: defaulter_2 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // Defaulter 1 liquidated.  Value of P updated to  to 9999999, i.e. in decimal, ~1e-10
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.equal(await stabilityPool.P(), dec(1, 13))  // P decreases. P = 1e(18-5) = 1e13
      assert.equal(await stabilityPool.currentScale(), '0')

      // Alice withdraws
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txA = await stabilityPool.withdrawFromSP(dec(100, 18), { from: alice })
      await priceFeed.setPrice(dec(100, 18))

      // B, C, D deposit 10000, 20000, 30000 ZSUSD
      await zsusdToken.transfer(bob, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: bob })

      await zsusdToken.transfer(carol, dec(20000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(20000, 18), ZERO_ADDRESS, { from: carol })

      await zsusdToken.transfer(dennis, dec(30000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(30000, 18), ZERO_ADDRESS, { from: dennis })

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 17))  // P decreases. P = 1e(13-5+9) = 1e17
      assert.equal(await stabilityPool.currentScale(), '1')

      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const bob_SOVWithdrawn = await th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()

      const txC = await stabilityPool.withdrawFromSP(dec(20000, 18), { from: carol })
      const carol_SOVWithdrawn = await th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()

      const txD = await stabilityPool.withdrawFromSP(dec(30000, 18), { from: dennis })
      const dennis_SOVWithdrawn = await th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()

      // {B, C, D} should have a compounded deposit of {0.1, 0.2, 0.3} ZSUSD
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(bob)).toString(), dec(1, 17)), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(carol)).toString(), dec(2, 17)), 100000)
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), dec(3, 17)), 100000)

      assert.isAtMost(th.getDifference(bob_SOVWithdrawn, dec(995, 17)), 10000000000)
      assert.isAtMost(th.getDifference(carol_SOVWithdrawn, dec(1990, 17)), 100000000000)
      assert.isAtMost(th.getDifference(dennis_SOVWithdrawn, dec(2985, 17)), 100000000000)
    })

    // A make deposit 10000 ZSUSD
    // L1 brings P to (~1e-10)*P. L1: 9999.9999999000000000 ZSUSD
    // Expect A to withdraw 0 deposit
    it("withdrawFromSP(): Deposit that decreases to less than 1e-9 of it's original value is reduced to 0", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Defaulters 1 withdraws 9999.9999999 ZSUSD
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('9999999999900000000000'), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })

      // Price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      await zsusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 liquidated. P -> (~1e-10)*P
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      const aliceDeposit = (await stabilityPool.getCompoundedZSUSDDeposit(alice)).toString()
      console.log(`alice deposit: ${aliceDeposit}`)
      assert.equal(aliceDeposit, 0)
    })

    // --- Serial scale changes ---

    /* A make deposit 10000 ZSUSD
    L1 brings P to 0.0001P. L1:  9999.900000000000000000 ZSUSD, 1 SOV
    B makes deposit 9999.9, brings SP to 10k
    L2 decreases P by(~1e-5)P. L2:  9999.900000000000000000 ZSUSD, 1 SOV
    C makes deposit 9999.9, brings SP to 10k
    L3 decreases P by(~1e-5)P. L3:  9999.900000000000000000 ZSUSD, 1 SOV
    D makes deposit 9999.9, brings SP to 10k
    L4 decreases P by(~1e-5)P. L4:  9999.900000000000000000 ZSUSD, 1 SOV
    expect A, B, C, D each withdraw ~100 Ether
    */
    it("withdrawFromSP(): Several deposits of 10000 ZSUSD span one scale factor change. Depositors withdraws correct compounded deposit and SOV Gain after one liquidation", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale})

      // Defaulters 1-4 each withdraw 9999.9 ZSUSD
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('9999900000000000000000'), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('9999900000000000000000'), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2, })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('9999900000000000000000'), defaulter_3, defaulter_3, dec(100, 'ether'), { from: defaulter_3 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_4 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount('9999900000000000000000'), defaulter_4, defaulter_4, dec(100, 'ether'), { from: defaulter_4 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      await zsusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 liquidated. 
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 13)) // P decreases to 1e(18-5) = 1e13
      assert.equal(await stabilityPool.currentScale(), '0')

      // B deposits 9999.9 ZSUSD
      await zsusdToken.transfer(bob, dec(99999, 17), { from: whale })
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: bob })

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 17)) // Scale changes and P changes to 1e(13-5+9) = 1e17
      assert.equal(await stabilityPool.currentScale(), '1')

      // C deposits 9999.9 ZSUSD
      await zsusdToken.transfer(carol, dec(99999, 17), { from: whale })
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: carol })

      // Defaulter 3 liquidated
      const txL3 = await troveManager.liquidate(defaulter_3, { from: owner });
      assert.isTrue(txL3.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 12)) // P decreases to 1e(17-5) = 1e12
      assert.equal(await stabilityPool.currentScale(), '1')

      // D deposits 9999.9 ZSUSD
      await zsusdToken.transfer(dennis, dec(99999, 17), { from: whale })
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: dennis })

      // Defaulter 4 liquidated
      const txL4 = await troveManager.liquidate(defaulter_4, { from: owner });
      assert.isTrue(txL4.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 16)) // Scale changes and P changes to 1e(12-5+9) = 1e16
      assert.equal(await stabilityPool.currentScale(), '2')

      const txA = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: bob })
      const txC = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: carol })
      const txD = await stabilityPool.withdrawFromSP(dec(10000, 18), { from: dennis })

      const alice_SOVWithdrawn = await th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV').toString()
      const bob_SOVWithdrawn = await th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV').toString()
      const carol_SOVWithdrawn = await th.getEventArgByName(txC, 'SOVGainWithdrawn', '_SOV').toString()
      const dennis_SOVWithdrawn = await th.getEventArgByName(txD, 'SOVGainWithdrawn', '_SOV').toString()

      // A, B, C should withdraw 0 - their deposits have been completely used up
      assert.equal(await zsusdToken.balanceOf(alice), '0')
      assert.equal(await zsusdToken.balanceOf(alice), '0')
      assert.equal(await zsusdToken.balanceOf(alice), '0')
      // D should withdraw around 0.9999 ZSUSD, since his deposit of 9999.9 was reduced by a factor of 1e-5
      assert.isAtMost(th.getDifference((await zsusdToken.balanceOf(dennis)).toString(), dec(99999, 12)), 100000)

      // 99.5 SOV is offset at each L, 0.5 goes to gas comp
      // Each depositor gets SOV rewards of around 99.5 SOV - 1e17 error tolerance
      assert.isTrue(toBN(alice_SOVWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
      assert.isTrue(toBN(bob_SOVWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
      assert.isTrue(toBN(carol_SOVWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
      assert.isTrue(toBN(dennis_SOVWithdrawn).sub(toBN(dec(995, 17))).abs().lte(toBN(dec(1, 17))))
    })

    it("withdrawFromSP(): 2 depositors can withdraw after each receiving half of a pool-emptying liquidation", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Defaulters 1-3 each withdraw 24100, 24300, 24500 ZSUSD (inc gas comp)
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(24100, 18)), defaulter_1, defaulter_1, dec(200, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(24300, 18)), defaulter_2, defaulter_2, dec(200, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(200, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(24500, 18)), defaulter_3, defaulter_3, dec(200, 'ether'), { from: defaulter_3, })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      // A, B provide 10k ZSUSD 
      await zsusdToken.transfer(A, dec(10000, 18), { from: whale })
      await zsusdToken.transfer(B, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: A })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: B })

      // Defaulter 1 liquidated. SP emptied
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)

      // Check compounded deposits
      const A_deposit = await stabilityPool.getCompoundedZSUSDDeposit(A)
      const B_deposit = await stabilityPool.getCompoundedZSUSDDeposit(B)
      // console.log(`A_deposit: ${A_deposit}`)
      // console.log(`B_deposit: ${B_deposit}`)
      assert.equal(A_deposit, '0')
      assert.equal(B_deposit, '0')

      // Check SP tracker is zero
      const ZSUSDinSP_1 = await stabilityPool.getTotalZSUSDDeposits()
      // console.log(`ZSUSDinSP_1: ${ZSUSDinSP_1}`)
      assert.equal(ZSUSDinSP_1, '0')

      // Check SP ZSUSD balance is zero
      const SPZSUSDBalance_1 = await zsusdToken.balanceOf(stabilityPool.address)
      // console.log(`SPZSUSDBalance_1: ${SPZSUSDBalance_1}`)
      assert.equal(SPZSUSDBalance_1, '0')

      // Attempt withdrawals
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txA = await stabilityPool.withdrawFromSP(dec(1000, 18), { from: A })
      const txB = await stabilityPool.withdrawFromSP(dec(1000, 18), { from: B })
      await priceFeed.setPrice(dec(100, 18))

      assert.isTrue(txA.receipt.status)
      assert.isTrue(txB.receipt.status)

      // ==========

      // C, D provide 10k ZSUSD 
      await zsusdToken.transfer(C, dec(10000, 18), { from: whale })
      await zsusdToken.transfer(D, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: C })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: D })

      // Defaulter 2 liquidated.  SP emptied
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)

      // Check compounded deposits
      const C_deposit = await stabilityPool.getCompoundedZSUSDDeposit(C)
      const D_deposit = await stabilityPool.getCompoundedZSUSDDeposit(D)
      // console.log(`A_deposit: ${C_deposit}`)
      // console.log(`B_deposit: ${D_deposit}`)
      assert.equal(C_deposit, '0')
      assert.equal(D_deposit, '0')

      // Check SP tracker is zero
      const ZSUSDinSP_2 = await stabilityPool.getTotalZSUSDDeposits()
      // console.log(`ZSUSDinSP_2: ${ZSUSDinSP_2}`)
      assert.equal(ZSUSDinSP_2, '0')

      // Check SP ZSUSD balance is zero
      const SPZSUSDBalance_2 = await zsusdToken.balanceOf(stabilityPool.address)
      // console.log(`SPZSUSDBalance_2: ${SPZSUSDBalance_2}`)
      assert.equal(SPZSUSDBalance_2, '0')

      // Attempt withdrawals
      // Increasing the price for a moment to avoid pending liquidations to block withdrawal
      await priceFeed.setPrice(dec(200, 18))
      const txC = await stabilityPool.withdrawFromSP(dec(1000, 18), { from: C })
      const txD = await stabilityPool.withdrawFromSP(dec(1000, 18), { from: D })
      await priceFeed.setPrice(dec(100, 18))

      assert.isTrue(txC.receipt.status)
      assert.isTrue(txD.receipt.status)

      // ============

      // E, F provide 10k ZSUSD 
      await zsusdToken.transfer(E, dec(10000, 18), { from: whale })
      await zsusdToken.transfer(F, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: E })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: F })

      // Defaulter 3 liquidated. SP emptied
      const txL3 = await troveManager.liquidate(defaulter_3, { from: owner });
      assert.isTrue(txL3.receipt.status)

      // Check compounded deposits
      const E_deposit = await stabilityPool.getCompoundedZSUSDDeposit(E)
      const F_deposit = await stabilityPool.getCompoundedZSUSDDeposit(F)
      // console.log(`E_deposit: ${E_deposit}`)
      // console.log(`F_deposit: ${F_deposit}`)
      assert.equal(E_deposit, '0')
      assert.equal(F_deposit, '0')

      // Check SP tracker is zero
      const ZSUSDinSP_3 = await stabilityPool.getTotalZSUSDDeposits()
      assert.equal(ZSUSDinSP_3, '0')

      // Check SP ZSUSD balance is zero
      const SPZSUSDBalance_3 = await zsusdToken.balanceOf(stabilityPool.address)
      // console.log(`SPZSUSDBalance_3: ${SPZSUSDBalance_3}`)
      assert.equal(SPZSUSDBalance_3, '0')

      // Attempt withdrawals
      const txE = await stabilityPool.withdrawFromSP(dec(1000, 18), { from: E })
      const txF = await stabilityPool.withdrawFromSP(dec(1000, 18), { from: F })
      assert.isTrue(txE.receipt.status)
      assert.isTrue(txF.receipt.status)
    })

    it("withdrawFromSP(): Depositor's SOV gain stops increasing after two scale changes", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // Defaulters 1-5 each withdraw up to debt of 9999.9999999 ZSUSD
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(99999, 17)), defaulter_1, defaulter_1, dec(100, 'ether'), { from: defaulter_1 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_2 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(99999, 17)), defaulter_2, defaulter_2, dec(100, 'ether'), { from: defaulter_2 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_3 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(99999, 17)), defaulter_3, defaulter_3, dec(100, 'ether'), { from: defaulter_3 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_4 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(99999, 17)), defaulter_4, defaulter_4, dec(100, 'ether'), { from: defaulter_4 })
      await sovToken.approve(borrowerOperations.address, dec(100, 'ether'), { from: defaulter_5 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(99999, 17)), defaulter_5, defaulter_5, dec(100, 'ether'), { from: defaulter_5 })

      // price drops by 50%
      await priceFeed.setPrice(dec(100, 18));

      await zsusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await stabilityPool.provideToSP(dec(10000, 18), ZERO_ADDRESS, { from: alice })

      // Defaulter 1 liquidated. 
      const txL1 = await troveManager.liquidate(defaulter_1, { from: owner });
      assert.isTrue(txL1.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 13)) // P decreases to 1e(18-5) = 1e13
      assert.equal(await stabilityPool.currentScale(), '0')

      // B deposits 9999.9 ZSUSD
      await zsusdToken.transfer(bob, dec(99999, 17), { from: whale })
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: bob })

      // Defaulter 2 liquidated
      const txL2 = await troveManager.liquidate(defaulter_2, { from: owner });
      assert.isTrue(txL2.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 17)) // Scale changes and P changes to 1e(13-5+9) = 1e17
      assert.equal(await stabilityPool.currentScale(), '1')

      // C deposits 9999.9 ZSUSD
      await zsusdToken.transfer(carol, dec(99999, 17), { from: whale })
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: carol })

      // Defaulter 3 liquidated
      const txL3 = await troveManager.liquidate(defaulter_3, { from: owner });
      assert.isTrue(txL3.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 12)) // P decreases to 1e(17-5) = 1e12
      assert.equal(await stabilityPool.currentScale(), '1')

      // D deposits 9999.9 ZSUSD
      await zsusdToken.transfer(dennis, dec(99999, 17), { from: whale })
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: dennis })

      // Defaulter 4 liquidated
      const txL4 = await troveManager.liquidate(defaulter_4, { from: owner });
      assert.isTrue(txL4.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 16)) // Scale changes and P changes to 1e(12-5+9) = 1e16
      assert.equal(await stabilityPool.currentScale(), '2')

      const alice_SOVGainAt2ndScaleChange = (await stabilityPool.getDepositorSOVGain(alice)).toString()

      // E deposits 9999.9 ZSUSD
      await zsusdToken.transfer(erin, dec(99999, 17), { from: whale })
      await stabilityPool.provideToSP(dec(99999, 17), ZERO_ADDRESS, { from: erin })
  
      // Defaulter 5 liquidated
      const txL5 = await troveManager.liquidate(defaulter_5, { from: owner });
      assert.isTrue(txL5.receipt.status)
      assert.equal(await stabilityPool.P(), dec(1, 11)) // P decreases to 1e(16-5) = 1e11
      assert.equal(await stabilityPool.currentScale(), '2')

      const alice_SOVGainAfterFurtherLiquidation = (await stabilityPool.getDepositorSOVGain(alice)).toString()
  
      const alice_scaleSnapshot = (await stabilityPool.depositSnapshots(alice))[2].toString()

      assert.equal(alice_scaleSnapshot, '0')
      assert.equal(alice_SOVGainAt2ndScaleChange, alice_SOVGainAfterFurtherLiquidation)
    })

    // --- Extreme values, confirm no overflows ---

    it("withdrawFromSP(): Large liquidated coll/debt, deposits and SOV price", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // SOV:USD price is $2 billion per SOV
      await priceFeed.setPrice(dec(2, 27));

      const depositors = [alice, bob]
      for (account of depositors) {
        await sovToken.approve(borrowerOperations.address, dec(2, 27), { from: account })
        await borrowerOperations.openTrove(th._100pct, dec(1, 36), account, account, dec(2, 27), { from: account })
        await stabilityPool.provideToSP(dec(1, 36), ZERO_ADDRESS, { from: account })
      }

      // Defaulter opens trove with 200% ICR
      await sovToken.approve(borrowerOperations.address, dec(1, 27), { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(1, 36)), defaulter_1, defaulter_1, dec(1, 27), { from: defaulter_1 })

      // SOV:USD price drops to $1 billion per SOV
      await priceFeed.setPrice(dec(1, 27));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });

      const txA = await stabilityPool.withdrawFromSP(dec(1, 36), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(1, 36), { from: bob })

      // Grab the SOV gain from the emitted event in the tx log
      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV')
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV')

      // Check ZSUSD balances
      const aliceZSUSDBalance = await zsusdToken.balanceOf(alice)
      const aliceExpectedZSUSDBalance = web3.utils.toBN(dec(5, 35))
      const aliceZSUSDBalDiff = aliceZSUSDBalance.sub(aliceExpectedZSUSDBalance).abs()

      assert.isTrue(aliceZSUSDBalDiff.lte(toBN(dec(1, 18)))) // error tolerance of 1e18

      const bobZSUSDBalance = await zsusdToken.balanceOf(bob)
      const bobExpectedZSUSDBalance = toBN(dec(5, 35))
      const bobZSUSDBalDiff = bobZSUSDBalance.sub(bobExpectedZSUSDBalance).abs()

      assert.isTrue(bobZSUSDBalDiff.lte(toBN(dec(1, 18))))

      // Check SOV gains
      const aliceExpectedSOVGain = toBN(dec(4975, 23))
      const aliceSOVDiff = aliceExpectedSOVGain.sub(toBN(alice_SOVWithdrawn))

      assert.isTrue(aliceSOVDiff.lte(toBN(dec(1, 18))))

      const bobExpectedSOVGain = toBN(dec(4975, 23))
      const bobSOVDiff = bobExpectedSOVGain.sub(toBN(bob_SOVWithdrawn))

      assert.isTrue(bobSOVDiff.lte(toBN(dec(1, 18))))
    })

    it("withdrawFromSP(): Small liquidated coll/debt, large deposits and SOV price", async () => {
      // Whale opens Trove with 100k SOV
      await sovToken.approve(borrowerOperations.address, dec(100000, 'ether'), { from: whale })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(100000, 18)), whale, whale, dec(100000, 'ether'), { from: whale })

      // SOV:USD price is $2 billion per SOV
      await priceFeed.setPrice(dec(2, 27));
      const price = await priceFeed.getPrice()

      const depositors = [alice, bob]
      for (account of depositors) {
        await sovToken.approve(borrowerOperations.address, dec(2, 29), { from: account })
        await borrowerOperations.openTrove(th._100pct, dec(1, 38), account, account, dec(2, 29), { from: account })
        await stabilityPool.provideToSP(dec(1, 38), ZERO_ADDRESS, { from: account })
      }

      // Defaulter opens trove with 50e-7 SOV and  5000 ZSUSD. 200% ICR
      await sovToken.approve(borrowerOperations.address, '5000000000000', { from: defaulter_1 })
      await borrowerOperations.openTrove(th._100pct, await getOpenTroveZSUSDAmount(dec(5000, 18)), defaulter_1, defaulter_1, '5000000000000', { from: defaulter_1 })

      // SOV:USD price drops to $1 billion per SOV
      await priceFeed.setPrice(dec(1, 27));

      // Defaulter liquidated
      await troveManager.liquidate(defaulter_1, { from: owner });

      const txA = await stabilityPool.withdrawFromSP(dec(1, 38), { from: alice })
      const txB = await stabilityPool.withdrawFromSP(dec(1, 38), { from: bob })

      const alice_SOVWithdrawn = th.getEventArgByName(txA, 'SOVGainWithdrawn', '_SOV')
      const bob_SOVWithdrawn = th.getEventArgByName(txB, 'SOVGainWithdrawn', '_SOV')

      const aliceZSUSDBalance = await zsusdToken.balanceOf(alice)
      const aliceExpectedZSUSDBalance = toBN('99999999999999997500000000000000000000')
      const aliceZSUSDBalDiff = aliceZSUSDBalance.sub(aliceExpectedZSUSDBalance).abs()

      assert.isTrue(aliceZSUSDBalDiff.lte(toBN(dec(1, 18))))

      const bobZSUSDBalance = await zsusdToken.balanceOf(bob)
      const bobExpectedZSUSDBalance = toBN('99999999999999997500000000000000000000')
      const bobZSUSDBalDiff = bobZSUSDBalance.sub(bobExpectedZSUSDBalance).abs()

      assert.isTrue(bobZSUSDBalDiff.lte(toBN('100000000000000000000')))

      // Expect SOV gain per depositor of ~1e11 wei to be rounded to 0 by the SOVGainedPerUnitStaked calculation (e / D), where D is ~1e36.
      assert.equal(alice_SOVWithdrawn.toString(), '0')
      assert.equal(bob_SOVWithdrawn.toString(), '0')
    })
  })
})

contract('Reset chain state', async accounts => { })
