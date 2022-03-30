const { artifacts } = require('hardhat')
const SortedTroves = artifacts.require("./SortedTroves.sol")
const LiquityBaseParams = artifacts.require("./LiquityBaseParams.sol")
const TroveManagerRedeemOps = artifacts.require("./Dependencies/TroveManagerRedeemOps.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const ZSUSDToken = artifacts.require("./ZSUSDToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const GasPool = artifacts.require("./GasPool.sol")
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")
const FeeDistributor = artifacts.require("./FeeDistributor.sol")

const ZEROStaking = artifacts.require("./ZEROStaking.sol")
const ZEROToken = artifacts.require("./ZEROToken.sol")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")

const ZEROTokenTester = artifacts.require("./ZEROTokenTester.sol")
const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol")
const MockFeeSharingProxy = artifacts.require("./MockFeeSharingProxy.sol")
const StabilityPoolTester = artifacts.require("./StabilityPoolTester.sol")
const ActivePoolTester = artifacts.require("./ActivePoolTester.sol")
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol")
const LiquityMathTester = artifacts.require("./LiquityMathTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const ZSUSDTokenTester = artifacts.require("./ZSUSDTokenTester.sol")
const WRBTCTokenTester = artifacts.require("./WRBTCTokenTester.sol")
const SOVTokenTester = artifacts.require("./SOVTokenTester.sol")

const MockBalanceRedirectPresale = artifacts.require("./MockBalanceRedirectPresale.sol")

// FIXME: this one should be removed after liquidity mining is correctly deployed
const NonPayable = artifacts.require("./NonPayable.sol")

// Proxy scripts
const BorrowerOperationsScript = artifacts.require('BorrowerOperationsScript')
const BorrowerWrappersScript = artifacts.require('BorrowerWrappersScript')
const TroveManagerScript = artifacts.require('TroveManagerScript')
const StabilityPoolScript = artifacts.require('StabilityPoolScript')
const TokenScript = artifacts.require('TokenScript')
const ZEROStakingScript = artifacts.require('ZEROStakingScript')

const {
  buildUserProxies,
  BorrowerOperationsProxy,
  BorrowerWrappersProxy,
  TroveManagerProxy,
  StabilityPoolProxy,
  SortedTrovesProxy,
  TokenProxy,
  ZEROStakingProxy,
  FeeDistributorProxy
} = require('../utils/proxyHelpers.js')

/* "Liquity core" consists of all contracts in the core Liquity system.

ZERO contracts consist of only those contracts related to the ZERO Token:

-the ZERO token
-the ZEROStaking contract
-the CommunityIssuance contract 
*/

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class DeploymentHelper {

  static async deployLiquityCore() {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployLiquityCoreHardhat()
    } else if (frameworkPath.includes("truffle")) {
      return this.deployLiquityCoreTruffle()
    }
  }

  static async deployZEROContracts(multisigAddress) {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployZEROContractsHardhat(multisigAddress)
    } else if (frameworkPath.includes("truffle")) {
      return this.deployZEROContractsTruffle(multisigAddress)
    }
  }

  static async deployLiquityCoreHardhat() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedTroves = await SortedTroves.new()
    const liquityBaseParams = await LiquityBaseParams.new()
    const troveManagerRedeemOps = await TroveManagerRedeemOps.new()
    const troveManager = await TroveManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const zsusdToken = await ZSUSDToken.new()
    const feeDistributor = await FeeDistributor.new()
    const wrbtcTokenTester = await WRBTCTokenTester.new()
    const sovTokenTester = await SOVTokenTester.new()
    await zsusdToken.initialize(
      troveManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    await liquityBaseParams.initialize()
    ZSUSDToken.setAsDeployed(zsusdToken)
    DefaultPool.setAsDeployed(defaultPool)
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet)
    SortedTroves.setAsDeployed(sortedTroves)
    LiquityBaseParams.setAsDeployed(liquityBaseParams)
    TroveManagerRedeemOps.setAsDeployed(troveManagerRedeemOps)
    TroveManager.setAsDeployed(troveManager)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPool)
    GasPool.setAsDeployed(gasPool)
    CollSurplusPool.setAsDeployed(collSurplusPool)
    FunctionCaller.setAsDeployed(functionCaller)
    BorrowerOperations.setAsDeployed(borrowerOperations)
    HintHelpers.setAsDeployed(hintHelpers)
    FeeDistributor.setAsDeployed(feeDistributor)
    WRBTCTokenTester.setAsDeployed(wrbtcTokenTester)
    SOVTokenTester.setAsDeployed(sovTokenTester)

    const coreContracts = {
      priceFeedTestnet,
      zsusdToken,
      sortedTroves,
      liquityBaseParams,
      troveManagerRedeemOps,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers,
      feeDistributor,
      wrbtcTokenTester,
      sovTokenTester
    }
    return coreContracts
  }

  static async deployTesterContractsHardhat() {
    const testerContracts = {}

    // Contract without testers (yet)
    testerContracts.liquityBaseParams = await LiquityBaseParams.new()
    testerContracts.priceFeedTestnet = await PriceFeedTestnet.new()
    testerContracts.sortedTroves = await SortedTroves.new()
    // Actual tester contracts
    testerContracts.communityIssuance = await CommunityIssuanceTester.new()
    testerContracts.activePool = await ActivePoolTester.new()
    testerContracts.defaultPool = await DefaultPoolTester.new()
    testerContracts.stabilityPool = await StabilityPoolTester.new()
    testerContracts.gasPool = await GasPool.new()
    testerContracts.collSurplusPool = await CollSurplusPool.new()
    testerContracts.math = await LiquityMathTester.new()
    testerContracts.borrowerOperations = await BorrowerOperationsTester.new()
    testerContracts.troveManagerRedeemOps = await TroveManagerRedeemOps.new()
    testerContracts.troveManager = await TroveManagerTester.new()
    testerContracts.functionCaller = await FunctionCaller.new()
    testerContracts.hintHelpers = await HintHelpers.new()
    testerContracts.zsusdToken =  await ZSUSDTokenTester.new(
      testerContracts.troveManager.address,
      testerContracts.stabilityPool.address,
      testerContracts.borrowerOperations.address
    )
    testerContracts.feeDistributor = await FeeDistributor.new()
    testerContracts.wrbtcTokenTester = await WRBTCTokenTester.new()
    testerContracts.sovTokenTester = await SOVTokenTester.new()
    await testerContracts.liquityBaseParams.initialize();
    return testerContracts
  }

  static async deployZEROContractsHardhat(multisigAddress) {
    const zeroStaking = await ZEROStaking.new()
    const communityIssuance = await CommunityIssuance.new()
    const mockFeeSharingProxy = await MockFeeSharingProxy.new()
    const presale = await MockBalanceRedirectPresale.new()
    // FIXME: replace with market maker contract address
    const marketMaker = await NonPayable.new()

    ZEROStaking.setAsDeployed(zeroStaking)
    CommunityIssuance.setAsDeployed(communityIssuance)
    MockBalanceRedirectPresale.setAsDeployed(presale)
    MockFeeSharingProxy.setAsDeployed(mockFeeSharingProxy)
    
    await presale.closePresale()

    // Deploy ZERO Token, passing market maker and presale addresses to the constructor 
    const zeroToken = await ZEROToken.new()
    await zeroToken.initialize(
      zeroStaking.address,
      marketMaker.address,
      presale.address,
    )
    ZEROToken.setAsDeployed(zeroToken)

    const ZEROContracts = {
      zeroStaking,
      communityIssuance,
      mockFeeSharingProxy,
      zeroToken,
      marketMaker,
      presale
    }
    return ZEROContracts
  }

  static async deployZEROTesterContractsHardhat(multisigAddress) {
    const zeroStaking = await ZEROStaking.new()
    const communityIssuance = await CommunityIssuanceTester.new()
    const mockFeeSharingProxy = await MockFeeSharingProxy.new()
    const presale = await MockBalanceRedirectPresale.new()
    // FIXME: replace with market maker contract address
    const marketMaker = await NonPayable.new()

    ZEROStaking.setAsDeployed(zeroStaking)
    CommunityIssuanceTester.setAsDeployed(communityIssuance)
    MockFeeSharingProxy.setAsDeployed(mockFeeSharingProxy)
    MockBalanceRedirectPresale.setAsDeployed(presale)

    await presale.closePresale()

    // Deploy ZERO Token, passing marketMaker and presale addresses to the constructor 
    const zeroToken = await ZEROTokenTester.new(
      zeroStaking.address,
      marketMaker.address,
      presale.address,
    )
    ZEROTokenTester.setAsDeployed(zeroToken)

    const ZEROContracts = {
      zeroStaking,
      communityIssuance,
      mockFeeSharingProxy,
      zeroToken,
      marketMaker,
      presale
    }
    return ZEROContracts
  }

  static async deployLiquityCoreTruffle() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedTroves = await SortedTroves.new()
    const liquityBaseParams = await LiquityBaseParams.new()
    const troveManagerRedeemOps = await TroveManagerRedeemOps.new()
    const troveManager = await TroveManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const zsusdToken = await ZSUSDToken.new()
    const feeDistributor = await FeeDistributor.new()
    await zsusdToken.initialize(
      troveManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    await liquityBaseParams.initialize()
    const coreContracts = {
      priceFeedTestnet,
      zsusdToken,
      sortedTroves,
      liquityBaseParams,
      troveManagerRedeemOps,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers,
      feeDistributor
    }
    return coreContracts
  }

  static async deployZEROContractsTruffle(multisigAddress) {
    const zeroStaking = await zeroStaking.new()
    const communityIssuance = await CommunityIssuance.new()
    const presale = await MockBalanceRedirectPresale.new()
    // FIXME: replace with market maker contract address
    const marketMaker = await NonPayable.new()

    /* Deploy ZERO Token, passing market maker and presale addresses 
    to the constructor  */
    const zeroToken = await ZEROToken.new()
    await zeroToken.initialize(
      zeroStaking.address,
      marketMakeraddress,
      presale.address,
    )

    const ZEROContracts = {
      zeroStaking,
      communityIssuance,
      zeroToken,
      marketMaker,
      presale
    }
    return ZEROContracts
  }

  static async deployZSUSDToken(contracts) {
    contracts.zsusdToken = await ZSUSDToken.new()
    await contracts.zsusdToken.initialize(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployZSUSDTokenTester(contracts) {
    contracts.zsusdToken = await ZSUSDTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployProxyScripts(contracts, ZEROContracts, owner, users) {
    const proxies = await buildUserProxies(users)

    const borrowerWrappersScript = await BorrowerWrappersScript.new(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      ZEROContracts.zeroStaking.address,
      contracts.stabilityPool.address,
      contracts.priceFeedTestnet.address,
      contracts.zsusdToken.address,
      ZEROContracts.zeroToken.address,
      contracts.sovTokenTester.address
    )
    contracts.borrowerWrappers = new BorrowerWrappersProxy(owner, proxies, borrowerWrappersScript.address)

    const borrowerOperationsScript = await BorrowerOperationsScript.new(contracts.borrowerOperations.address, contracts.sovTokenTester.address)
    contracts.borrowerOperations = new BorrowerOperationsProxy(owner, proxies, borrowerOperationsScript.address, contracts.borrowerOperations) 

    const troveManagerScript = await TroveManagerScript.new(contracts.troveManager.address)
    contracts.troveManager = new TroveManagerProxy(owner, proxies, troveManagerScript.address, contracts.troveManager)

    const stabilityPoolScript = await StabilityPoolScript.new(contracts.stabilityPool.address)
    contracts.stabilityPool = new StabilityPoolProxy(owner, proxies, stabilityPoolScript.address, contracts.stabilityPool)

    contracts.sortedTroves = new SortedTrovesProxy(owner, proxies, contracts.sortedTroves)

    const zsusdTokenScript = await TokenScript.new(contracts.zsusdToken.address)
    contracts.zsusdToken = new TokenProxy(owner, proxies, zsusdTokenScript.address, contracts.zsusdToken)

    const zeroTokenScript = await TokenScript.new(ZEROContracts.zeroToken.address)
    ZEROContracts.zeroToken = new TokenProxy(owner, proxies, zeroTokenScript.address, ZEROContracts.zeroToken)

    const zeroStakingScript = await ZEROStakingScript.new(ZEROContracts.zeroStaking.address)
    ZEROContracts.zeroStaking = new ZEROStakingProxy(owner, proxies, zeroStakingScript.address, ZEROContracts.zeroStaking)
  }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, ZEROContracts) {

    // set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setParams(
      maxBytes32,
      contracts.troveManager.address,
      contracts.borrowerOperations.address
    )

    // set contract addresses in the FunctionCaller 
    await contracts.functionCaller.setTroveManagerAddress(contracts.troveManager.address)
    await contracts.functionCaller.setSortedTrovesAddress(contracts.sortedTroves.address)

    // set contracts in the Trove Manager
    await contracts.troveManager.setAddresses(
      [
        contracts.sovTokenTester.address,
        contracts.feeDistributor.address,
        contracts.troveManagerRedeemOps.address,
        contracts.liquityBaseParams.address,
        contracts.borrowerOperations.address,
        contracts.activePool.address,
        contracts.defaultPool.address,
        contracts.stabilityPool.address,
        contracts.gasPool.address,
        contracts.collSurplusPool.address,
        contracts.priceFeedTestnet.address,
        contracts.zsusdToken.address,
        contracts.sortedTroves.address,
        ZEROContracts.zeroToken.address,
        ZEROContracts.zeroStaking.address
    ]
    )

    // set contracts in BorrowerOperations 
    await contracts.borrowerOperations.setAddresses(
      contracts.sovTokenTester.address,
      contracts.feeDistributor.address,
      contracts.liquityBaseParams.address,
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.sortedTroves.address,
      contracts.zsusdToken.address,
      ZEROContracts.zeroStaking.address
    )

    // set contracts in FeeDistributor
    await contracts.feeDistributor.setAddresses(
      contracts.sovTokenTester.address,
      ZEROContracts.mockFeeSharingProxy.address,
      ZEROContracts.zeroStaking.address,
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.wrbtcTokenTester.address,
      contracts.zsusdToken.address,
      contracts.activePool.address
    )

    // set contracts in the Pools
    await contracts.stabilityPool.setAddresses(
      contracts.sovTokenTester.address,
      contracts.liquityBaseParams.address,
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.zsusdToken.address,
      contracts.sortedTroves.address,
      contracts.priceFeedTestnet.address,
      ZEROContracts.communityIssuance.address
    )

    await contracts.activePool.setAddresses(
      contracts.sovTokenTester.address,
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address
    )

    await contracts.defaultPool.setAddresses(
      contracts.sovTokenTester.address,
      contracts.troveManager.address,
      contracts.activePool.address,
    )

    await contracts.collSurplusPool.setAddresses(
      contracts.sovTokenTester.address,
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
    )

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.liquityBaseParams.address,
      contracts.sortedTroves.address,
      contracts.troveManager.address
    )
  }

  static async connectZEROContracts(ZEROContracts) {
    // Set ZEROToken address in LCF
    // FIXME
  }

  static async connectZEROContractsToCore(ZEROContracts, coreContracts, walletAddress) {
    await ZEROContracts.zeroStaking.setAddresses(
      coreContracts.sovTokenTester.address,
      ZEROContracts.zeroToken.address,
      coreContracts.zsusdToken.address,
      coreContracts.feeDistributor.address, 
      coreContracts.activePool.address
    )
  
    await ZEROContracts.communityIssuance.initialize(
      ZEROContracts.zeroToken.address,
      coreContracts.stabilityPool.address,
      walletAddress
    )
    
  }

}
module.exports = DeploymentHelper
