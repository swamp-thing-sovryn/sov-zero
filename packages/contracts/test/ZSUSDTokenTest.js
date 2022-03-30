const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const timeMachine = require('ganache-time-traveler');

const { keccak256 } = require('@ethersproject/keccak256');
const { defaultAbiCoder } = require('@ethersproject/abi');
const { toUtf8Bytes } = require('@ethersproject/strings');
const { pack } = require('@ethersproject/solidity');
const { hexlify } = require("@ethersproject/bytes");
const { ecsign } = require('ethereumjs-util');

const { toBN, assertRevert, assertAssert, dec, ZERO_ADDRESS } = testHelpers.TestHelper

const sign = (digest, privateKey) => {
  return ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(privateKey.slice(2), 'hex'))
}

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

// Gets the EIP712 domain separator
const getDomainSeparator = (name, contractAddress, chainId, version)  => {
  return keccak256(defaultAbiCoder.encode(['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'], 
  [ 
    keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
    keccak256(toUtf8Bytes(name)), 
    keccak256(toUtf8Bytes(version)),
    parseInt(chainId), contractAddress.toLowerCase()
  ]))
}

// Returns the EIP712 hash which should be signed by the user
// in order to make a call to `permit`
const getPermitDigest = ( name, address, chainId, version,
                          owner, spender, value , 
                          nonce, deadline ) => {

  const DOMAIN_SEPARATOR = getDomainSeparator(name, address, chainId, version)
  return keccak256(pack(['bytes1', 'bytes1', 'bytes32', 'bytes32'],
    ['0x19', '0x01', DOMAIN_SEPARATOR, 
      keccak256(defaultAbiCoder.encode(
        ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
        [PERMIT_TYPEHASH, owner, spender, value, nonce, deadline])),
    ]))
}

contract('ZSUSDToken', async accounts => {
  const [owner, alice, bob, carol, dennis, sovFeeCollector] = accounts;

  const multisig = accounts[999];

  // the second account our hardhatenv creates (for Alice)
  // from https://github.com/liquity/dev/blob/main/packages/contracts/hardhatAccountsList2k.js#L3
  const alicePrivateKey = '0xeaa445c85f7b438dEd6e831d06a4eD0CEBDc2f8527f84Fcda6EBB5fCfAd4C0e9'

  let chainId
  let zsusdTokenOriginal
  let zsusdTokenTester
  let stabilityPool
  let troveManager
  let borrowerOperations

  let tokenName
  let tokenVersion

  const testCorpus = ({ withProxy = false }) => {
    before(async () => {

      const contracts = await deploymentHelper.deployTesterContractsHardhat()


      const ZEROContracts = await deploymentHelper.deployZEROContracts(multisig)

      await deploymentHelper.connectCoreContracts(contracts, ZEROContracts)
      await deploymentHelper.connectZEROContracts(ZEROContracts)
      await deploymentHelper.connectZEROContractsToCore(ZEROContracts, contracts, owner)

      zsusdTokenOriginal = contracts.zsusdToken
      if (withProxy) {
        const users = [ alice, bob, carol, dennis ]
        await deploymentHelper.deployProxyScripts(contracts, ZEROContracts, owner, users)
      }

      zsusdTokenTester = contracts.zsusdToken
      // for some reason this doesn’t work with coverage network
      //chainId = await web3.eth.getChainId()
      chainId = await zsusdTokenOriginal.getChainId()

      stabilityPool = contracts.stabilityPool
      troveManager = contracts.stabilityPool
      borrowerOperations = contracts.borrowerOperations

      tokenVersion = await zsusdTokenOriginal.version()
      tokenName = await zsusdTokenOriginal.name()

      // mint some tokens
      if (withProxy) {
        await zsusdTokenOriginal.unprotectedMint(zsusdTokenTester.getProxyAddressFromUser(alice), 150)
        await zsusdTokenOriginal.unprotectedMint(zsusdTokenTester.getProxyAddressFromUser(bob), 100)
        await zsusdTokenOriginal.unprotectedMint(zsusdTokenTester.getProxyAddressFromUser(carol), 50)
      } else {
        await zsusdTokenOriginal.unprotectedMint(alice, 150)
        await zsusdTokenOriginal.unprotectedMint(bob, 100)
        await zsusdTokenOriginal.unprotectedMint(carol, 50)
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

    it('balanceOf(): gets the balance of the account', async () => {
      const aliceBalance = (await zsusdTokenTester.balanceOf(alice)).toNumber()
      const bobBalance = (await zsusdTokenTester.balanceOf(bob)).toNumber()
      const carolBalance = (await zsusdTokenTester.balanceOf(carol)).toNumber()

      assert.equal(aliceBalance, 150)
      assert.equal(bobBalance, 100)
      assert.equal(carolBalance, 50)
    })

    it('totalSupply(): gets the total supply', async () => {
      const total = (await zsusdTokenTester.totalSupply()).toString()
      assert.equal(total, '300') // 300
    })

    it("name(): returns the token's name", async () => {
      const name = await zsusdTokenTester.name()
      assert.equal(name, "ZSUSD Stablecoin")
    })

    it("symbol(): returns the token's symbol", async () => {
      const symbol = await zsusdTokenTester.symbol()
      assert.equal(symbol, "ZSUSD")
    })

    it("decimal(): returns the number of decimal digits used", async () => {
      const decimals = await zsusdTokenTester.decimals()
      assert.equal(decimals, "18")
    })

    it("allowance(): returns an account's spending allowance for another account's balance", async () => {
      await zsusdTokenTester.approve(alice, 100, {from: bob})

      const allowance_A = await zsusdTokenTester.allowance(bob, alice)
      const allowance_D = await zsusdTokenTester.allowance(bob, dennis)

      assert.equal(allowance_A, 100)
      assert.equal(allowance_D, '0')
    })

    it("approve(): approves an account to spend the specified amount", async () => {
      const allowance_A_before = await zsusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_before, '0')

      await zsusdTokenTester.approve(alice, 100, {from: bob})

      const allowance_A_after = await zsusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_after, 100)
    })

    if (!withProxy) {
      it("approve(): reverts when spender param is address(0)", async () => {
        const txPromise = zsusdTokenTester.approve(ZERO_ADDRESS, 100, {from: bob})
        await assertAssert(txPromise)
      })

      it("approve(): reverts when owner param is address(0)", async () => {
        const txPromise = zsusdTokenTester.callInternalApprove(ZERO_ADDRESS, alice, dec(1000, 18), {from: bob})
        await assertAssert(txPromise)
      })
    }

    it("transferFrom(): successfully transfers from an account which is it approved to transfer from", async () => {
      const allowance_A_0 = await zsusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_0, '0')

      await zsusdTokenTester.approve(alice, 50, {from: bob})

      // Check A's allowance of Bob's funds has increased
      const allowance_A_1= await zsusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_1, 50)


      assert.equal(await zsusdTokenTester.balanceOf(carol), 50)

      // Alice transfers from bob to Carol, using up her allowance
      await zsusdTokenTester.transferFrom(bob, carol, 50, {from: alice})
      assert.equal(await zsusdTokenTester.balanceOf(carol), 100)

       // Check A's allowance of Bob's funds has decreased
      const allowance_A_2= await zsusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_2, '0')

      // Check bob's balance has decreased
      assert.equal(await zsusdTokenTester.balanceOf(bob), 50)

      // Alice tries to transfer more tokens from bob's account to carol than she's allowed
      const txPromise = zsusdTokenTester.transferFrom(bob, carol, 50, {from: alice})
      await assertRevert(txPromise)
    })

    it("transfer(): increases the recipient's balance by the correct amount", async () => {
      assert.equal(await zsusdTokenTester.balanceOf(alice), 150)

      await zsusdTokenTester.transfer(alice, 37, {from: bob})

      assert.equal(await zsusdTokenTester.balanceOf(alice), 187)
    })

    it("transfer(): reverts if amount exceeds sender's balance", async () => {
      assert.equal(await zsusdTokenTester.balanceOf(bob), 100)

      const txPromise = zsusdTokenTester.transfer(alice, 101, {from: bob})
      await assertRevert(txPromise)
    })

    it('transfer(): transferring to a blacklisted address reverts', async () => {
      await assertRevert(zsusdTokenTester.transfer(zsusdTokenTester.address, 1, { from: alice }))
      await assertRevert(zsusdTokenTester.transfer(ZERO_ADDRESS, 1, { from: alice }))
      await assertRevert(zsusdTokenTester.transfer(troveManager.address, 1, { from: alice }))
      await assertRevert(zsusdTokenTester.transfer(stabilityPool.address, 1, { from: alice }))
      await assertRevert(zsusdTokenTester.transfer(borrowerOperations.address, 1, { from: alice }))
    })

    it("increaseAllowance(): increases an account's allowance by the correct amount", async () => {
      const allowance_A_Before = await zsusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_Before, '0')

      await zsusdTokenTester.increaseAllowance(alice, 100, {from: bob} )

      const allowance_A_After = await zsusdTokenTester.allowance(bob, alice)
      assert.equal(allowance_A_After, 100)
    })

    if (!withProxy) {
      it('mint(): issues correct amount of tokens to the given address', async () => {
        const alice_balanceBefore = await zsusdTokenTester.balanceOf(alice)
        assert.equal(alice_balanceBefore, 150)

        await zsusdTokenTester.unprotectedMint(alice, 100)

        const alice_BalanceAfter = await zsusdTokenTester.balanceOf(alice)
        assert.equal(alice_BalanceAfter, 250)
      })

      it('burn(): burns correct amount of tokens from the given address', async () => {
        const alice_balanceBefore = await zsusdTokenTester.balanceOf(alice)
        assert.equal(alice_balanceBefore, 150)

        await zsusdTokenTester.unprotectedBurn(alice, 70)

        const alice_BalanceAfter = await zsusdTokenTester.balanceOf(alice)
        assert.equal(alice_BalanceAfter, 80)
      })

      // TODO: Rewrite this test - it should check the actual zsusdTokenTester's balance.
      it('sendToPool(): changes balances of Stability pool and user by the correct amounts', async () => {
        const stabilityPool_BalanceBefore = await zsusdTokenTester.balanceOf(stabilityPool.address)
        const bob_BalanceBefore = await zsusdTokenTester.balanceOf(bob)
        assert.equal(stabilityPool_BalanceBefore, 0)
        assert.equal(bob_BalanceBefore, 100)

        await zsusdTokenTester.unprotectedSendToPool(bob, stabilityPool.address, 75)

        const stabilityPool_BalanceAfter = await zsusdTokenTester.balanceOf(stabilityPool.address)
        const bob_BalanceAfter = await zsusdTokenTester.balanceOf(bob)
        assert.equal(stabilityPool_BalanceAfter, 75)
        assert.equal(bob_BalanceAfter, 25)
      })

      it('returnFromPool(): changes balances of Stability pool and user by the correct amounts', async () => {
        /// --- SETUP --- give pool 100 ZSUSD
        await zsusdTokenTester.unprotectedMint(stabilityPool.address, 100)

        /// --- TEST ---
        const stabilityPool_BalanceBefore = await zsusdTokenTester.balanceOf(stabilityPool.address)
        const  bob_BalanceBefore = await zsusdTokenTester.balanceOf(bob)
        assert.equal(stabilityPool_BalanceBefore, 100)
        assert.equal(bob_BalanceBefore, 100)

        await zsusdTokenTester.unprotectedReturnFromPool(stabilityPool.address, bob, 75)

        const stabilityPool_BalanceAfter = await zsusdTokenTester.balanceOf(stabilityPool.address)
        const bob_BalanceAfter = await zsusdTokenTester.balanceOf(bob)
        assert.equal(stabilityPool_BalanceAfter, 25)
        assert.equal(bob_BalanceAfter, 175)
      })
    }

    it('transfer(): transferring to a blacklisted address reverts', async () => {
      await assertRevert(zsusdTokenTester.transfer(zsusdTokenTester.address, 1, { from: alice }))
      await assertRevert(zsusdTokenTester.transfer(ZERO_ADDRESS, 1, { from: alice }))
      await assertRevert(zsusdTokenTester.transfer(troveManager.address, 1, { from: alice }))
      await assertRevert(zsusdTokenTester.transfer(stabilityPool.address, 1, { from: alice }))
      await assertRevert(zsusdTokenTester.transfer(borrowerOperations.address, 1, { from: alice }))
    })

    it('decreaseAllowance(): decreases allowance by the expected amount', async () => {
      await zsusdTokenTester.approve(bob, dec(3, 18), { from: alice })
      assert.equal((await zsusdTokenTester.allowance(alice, bob)).toString(), dec(3, 18))
      await zsusdTokenTester.decreaseAllowance(bob, dec(1, 18), { from: alice })
      assert.equal((await zsusdTokenTester.allowance(alice, bob)).toString(), dec(2, 18))
    })

    it('decreaseAllowance(): fails trying to decrease more than previously allowed', async () => {
      await zsusdTokenTester.approve(bob, dec(3, 18), { from: alice })
      assert.equal((await zsusdTokenTester.allowance(alice, bob)).toString(), dec(3, 18))
      await assertRevert(zsusdTokenTester.decreaseAllowance(bob, dec(4, 18), { from: alice }), 'ERC20: decreased allowance below zero')
      assert.equal((await zsusdTokenTester.allowance(alice, bob)).toString(), dec(3, 18))
    })

    // EIP2612 tests

    if (!withProxy) {
      it("version(): returns the token contract's version", async () => {
        const version = await zsusdTokenTester.version()
        assert.equal(version, "1")
      })

      it('Initializes PERMIT_TYPEHASH correctly', async () => {
        assert.equal(await zsusdTokenTester.permitTypeHash(), PERMIT_TYPEHASH)
      })

      it('Initializes DOMAIN_SEPARATOR correctly', async () => {
        assert.equal(await zsusdTokenTester.domainSeparator(),
                     getDomainSeparator(tokenName, zsusdTokenTester.address, chainId, tokenVersion))
      })

      it('Initial nonce for a given address is 0', async function () {
        assert.equal(toBN(await zsusdTokenTester.nonces(alice)).toString(), '0');
      });

      // Create the approval tx data
      const approve = {
        owner: alice,
        spender: bob,
        value: 1,
      }

      const buildPermitTx = async (deadline) => {
        const nonce = (await zsusdTokenTester.nonces(approve.owner)).toString()

        // Get the EIP712 digest
        const digest = getPermitDigest(
          tokenName, zsusdTokenTester.address,
          chainId, tokenVersion,
          approve.owner, approve.spender,
          approve.value, nonce, deadline
        )

        const { v, r, s } = sign(digest, alicePrivateKey)

        const tx = zsusdTokenTester.permit(
          approve.owner, approve.spender, approve.value,
          deadline, v, hexlify(r), hexlify(s)
        )

        return { v, r, s, tx }
      }

      it('permits and emits an Approval event (replay protected)', async () => {
        const deadline = 100000000000000

        // Approve it
        const { v, r, s, tx } = await buildPermitTx(deadline)
        const receipt = await tx
        const event = receipt.logs[0]

        // Check that approval was successful
        assert.equal(event.event, 'Approval')
        assert.equal(await zsusdTokenTester.nonces(approve.owner), 1)
        assert.equal(await zsusdTokenTester.allowance(approve.owner, approve.spender), approve.value)

        // Check that we can not use re-use the same signature, since the user's nonce has been incremented (replay protection)
        await assertRevert(zsusdTokenTester.permit(
          approve.owner, approve.spender, approve.value,
          deadline, v, r, s), 'ZSUSD: invalid signature')

        // Check that the zero address fails
        await assertAssert(zsusdTokenTester.permit('0x0000000000000000000000000000000000000000',
                                                  approve.spender, approve.value, deadline, '0x99', r, s))
      })

      it('permits(): fails with expired deadline', async () => {
        const deadline = 1

        const { v, r, s, tx } = await buildPermitTx(deadline)
        await assertRevert(tx, 'ZSUSD: expired deadline')
      })

      it('permits(): fails with the wrong signature', async () => {
        const deadline = 100000000000000

        const { v, r, s } = await buildPermitTx(deadline)

        const tx = zsusdTokenTester.permit(
          carol, approve.spender, approve.value,
          deadline, v, hexlify(r), hexlify(s)
        )

        await assertRevert(tx, 'ZSUSD: invalid signature')
      })
    }
  }
  describe('Basic token functions, without Proxy', async () => {
    testCorpus({ withProxy: false })
  })

  describe('Basic token functions, with Proxy', async () => {
    testCorpus({ withProxy: true })
  })
})



contract('Reset chain state', async accounts => {})
