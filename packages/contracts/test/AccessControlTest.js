const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const TroveManagerTester = artifacts.require("TroveManagerTester")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues

const dec = th.dec
const toBN = th.toBN
const assertRevert = th.assertRevert

/* The majority of access control tests are contained in this file. However, tests for restrictions 
on the Liquity admin address's capabilities during the first year are found in:

test/launchSequenceTest/DuringLockupPeriodTest.js */

contract('Access Control: Liquity functions with the caller restricted to Liquity contract(s)', async accounts => {

  const [owner, alice, bob, carol, sovFeeCollector] = accounts;
  const multisig = accounts[999];

  let coreContracts

  let priceFeed
  let zsusdToken
  let sortedTroves
  let troveManager
  let nameRegistry
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations

  let zeroStaking
  let zeroToken
  let communityIssuance

  let sovToken


  before(async () => {
    coreContracts = await deploymentHelper.deployLiquityCore()
    coreContracts.troveManager = await TroveManagerTester.new()
    coreContracts = await deploymentHelper.deployZSUSDTokenTester(coreContracts)
    const ZEROContracts = await deploymentHelper.deployZEROTesterContractsHardhat(multisig)
    
    priceFeed = coreContracts.priceFeed
    zsusdToken = coreContracts.zsusdToken
    sortedTroves = coreContracts.sortedTroves
    troveManager = coreContracts.troveManager
    nameRegistry = coreContracts.nameRegistry
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations
    sovToken = coreContracts.sovTokenTester
 
    zeroStaking = ZEROContracts.zeroStaking
    zeroToken = ZEROContracts.zeroToken
    communityIssuance = ZEROContracts.communityIssuance

    await deploymentHelper.deployZEROTesterContractsHardhat(ZEROContracts)

    await zeroToken.unprotectedMint(multisig,toBN(dec(20,24)))
    
    await deploymentHelper.connectZEROContracts(ZEROContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, ZEROContracts)
    await deploymentHelper.connectZEROContractsToCore(ZEROContracts, coreContracts, owner)

    for (account of accounts.slice(0, 10)) {
      await sovToken.transfer(account, toBN(dec(1000,18)))
      await th.openTrove(coreContracts, { extraZSUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
    }

  })

  describe('BorrowerOperations', async accounts => { 
    it("moveSOVGainToTrove(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const tx1= await borrowerOperations.moveSOVGainToTrove(bob, bob, bob, 100, { from: bob })
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "BorrowerOps: Caller is not Stability Pool")
      }
    })
  })

  describe('TroveManager', async accounts => {
    // applyPendingRewards
    it("applyPendingRewards(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.applyPendingRewards(bob, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateRewardSnapshots
    it("updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateTroveRewardSnapshots(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert" )
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // removeStake
    it("removeStake(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.removeStake(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // updateStakeAndTotalStakes
    it("updateStakeAndTotalStakes(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.updateStakeAndTotalStakes(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // closeTrove
    it("closeTrove(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.closeTrove(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // addTroveOwnerToArray
    it("addTroveOwnerToArray(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.addTroveOwnerToArray(bob, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // setTroveStatus
    it("setTroveStatus(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.setTroveStatus(bob, 1, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseTroveColl
    it("increaseTroveColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.increaseTroveColl(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseTroveColl
    it("decreaseTroveColl(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.decreaseTroveColl(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // increaseTroveDebt
    it("increaseTroveDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.increaseTroveDebt(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })

    // decreaseTroveDebt
    it("decreaseTroveDebt(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      try {
        const txAlice = await troveManager.decreaseTroveDebt(bob, 100, { from: alice })
        
      } catch (err) {
         assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is not the BorrowerOperations contract")
      }
    })
  })

  describe('ActivePool', async accounts => {
    // sendSOV
    it("sendSOV(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.sendSOV(alice, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // increaseZSUSD	
    it("increaseZSUSDDebt(): reverts when called by an account that is not BO nor TroveM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.increaseZSUSDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager")
      }
    })

    // decreaseZSUSD
    it("decreaseZSUSDDebt(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await activePool.decreaseZSUSDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // fallback (payment)	
    it("fallback(): reverts because cannot receive ETH", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: activePool.address, value: 100 })
        
      } catch (err) {
        assert.include(err.message, "revert")
        //assert.include(err.message, "ActivePool: Caller is neither BO nor Default Pool")
      }
    })
  })

  describe('DefaultPool', async accounts => {
    // sendSOVToActivePool
    it("sendSOVToActivePool(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.sendSOVToActivePool(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // increaseZSUSD	
    it("increaseZSUSDDebt(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.increaseZSUSDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // decreaseZSUSD	
    it("decreaseZSUSD(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await defaultPool.decreaseZSUSDDebt(100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the TroveManager")
      }
    })

    // fallback (payment)	
    it("fallback(): reverts because cannot receive ETH", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: defaultPool.address, value: 100 })
        
      } catch (err) {
        assert.include(err.message, "revert")
        //assert.include(err.message, "DefaultPool: Caller is not the ActivePool")
      }
    })
  })

  describe('StabilityPool', async accounts => {
    // --- onlyTroveManager --- 

    // offset
    it("offset(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        txAlice = await stabilityPool.offset(100, 10, { from: alice })
        assert.fail(txAlice)
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not TroveManager")
      }
    })

    // --- onlyActivePool ---

    // fallback (payment)	
    it("fallback(): reverts because cannot receive ETH", async () => {
      // Attempt call from alice
      try {
        const txAlice = await web3.eth.sendTransaction({ from: alice, to: stabilityPool.address, value: 100 })
        
      } catch (err) {
        assert.include(err.message, "revert")
        //assert.include(err.message, "StabilityPool: Caller is not ActivePool")
      }
    })
  })

  describe('ZSUSDToken', async accounts => {

    //    mint
    it("mint(): reverts when called by an account that is not BorrowerOperations", async () => {
      // Attempt call from alice
      const txAlice = zsusdToken.mint(bob, 100, { from: alice })
      await th.assertRevert(txAlice, "Caller is not BorrowerOperations")
    })

    // burn
    it("burn(): reverts when called by an account that is not BO nor TroveM nor SP", async () => {
      // Attempt call from alice
      try {
        const txAlice = await zsusdToken.burn(bob, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither BorrowerOperations nor TroveManager nor StabilityPool")
      }
    })

    // sendToPool
    it("sendToPool(): reverts when called by an account that is not StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await zsusdToken.sendToPool(bob, activePool.address, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        assert.include(err.message, "Caller is not the StabilityPool")
      }
    })

    // returnFromPool
    it("returnFromPool(): reverts when called by an account that is not TroveManager nor StabilityPool", async () => {
      // Attempt call from alice
      try {
        const txAlice = await zsusdToken.returnFromPool(activePool.address, bob, 100, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither TroveManager nor StabilityPool")
      }
    })
  })

  describe('SortedTroves', async accounts => {
    // --- onlyBorrowerOperations ---
    //     insert
    it("insert(): reverts when called by an account that is not BorrowerOps or TroveM", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.insert(bob, '150000000000000000000', bob, bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, " Caller is neither BO nor TroveM")
      }
    })

    // --- onlyTroveManager ---
    // remove
    it("remove(): reverts when called by an account that is not TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.remove(bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, " Caller is not the TroveManager")
      }
    })

    // --- onlyTroveMorBM ---
    // reinsert
    it("reinsert(): reverts when called by an account that is neither BorrowerOps nor TroveManager", async () => {
      // Attempt call from alice
      try {
        const txAlice = await sortedTroves.reInsert(bob, '150000000000000000000', bob, bob, { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
        // assert.include(err.message, "Caller is neither BO nor TroveM")
      }
    })
  })

  describe('ZEROStaking', async accounts => {
    it("increaseF_ZSUSD(): reverts when caller is not TroveManager", async () => {
      try {
        const txAlice = await zeroStaking.increaseF_ZSUSD(dec(1, 18), { from: alice })
        
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('ZEROToken', async accounts => {
    it("sendToZEROStaking(): reverts when caller is not the ZEROSstaking", async () => {
      // Check multisig has some ZERO
      assert.isTrue((await zeroToken.balanceOf(multisig)).gt(toBN('0')))

      // multisig tries to call it
      try {
        const tx = await zeroToken.sendToZEROStaking(multisig, 1, { from: multisig })
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // FF >> time one year
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

      // Owner transfers 1 ZERO to bob
      await zeroToken.transfer(bob, dec(1, 18), { from: multisig })
      assert.equal((await zeroToken.balanceOf(bob)), dec(1, 18))

      // Bob tries to call it
      try {
        const tx = await zeroToken.sendToZEROStaking(bob, dec(1, 18), { from: bob })
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })
  })

  describe('CommunityIssuance', async accounts => {
    it("sendZERO(): reverts when caller is not the StabilityPool", async () => {
      const tx1 = communityIssuance.sendZERO(alice, dec(100, 18), {from: alice})
      const tx2 = communityIssuance.sendZERO(bob, dec(100, 18), {from: alice})
      const tx3 = communityIssuance.sendZERO(stabilityPool.address, dec(100, 18), {from: alice})
     
      assertRevert(tx1)
      assertRevert(tx2)
      assertRevert(tx3)
    })

    it("issueZERO(): reverts when caller is not the StabilityPool", async () => {
      const tx1 = communityIssuance.issueZERO({from: alice})

      assertRevert(tx1)
    })
  })

  
})


