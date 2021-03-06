
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";
import { BytesLike } from "@ethersproject/bytes";
import {
  Overrides,
  CallOverrides,
  PayableOverrides,
  EventFilter
} from "@ethersproject/contracts";

import { _TypedLiquityContract, _TypedLogDescription } from "../src/contracts";

interface ActivePoolCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  defaultPoolAddress(_overrides?: CallOverrides): Promise<string>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  getSOV(_overrides?: CallOverrides): Promise<BigNumber>;
  getZSUSDDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  sovToken(_overrides?: CallOverrides): Promise<string>;
  stabilityPoolAddress(_overrides?: CallOverrides): Promise<string>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

interface ActivePoolTransactions {
  decreaseZSUSDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  increaseZSUSDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  sendSOV(_account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  setAddresses(_sovTokenAddress: string, _borrowerOperationsAddress: string, _troveManagerAddress: string, _stabilityPoolAddress: string, _defaultPoolAddress: string, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
}

export interface ActivePool
  extends _TypedLiquityContract<ActivePoolCalls, ActivePoolTransactions> {
  readonly address: string;
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    ActivePoolZSUSDDebtUpdated(_ZSUSDDebt?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    SOVSent(_to?: null, _amount?: null): EventFilter;
    SOVTokenAddressChanged(_sovTokenAddress?: null): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
    ZSUSDBalanceUpdated(_newBalance?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "ActivePoolZSUSDDebtUpdated"): _TypedLogDescription<{ _ZSUSDDebt: BigNumber }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): _TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "SOVSent"): _TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "SOVTokenAddressChanged"): _TypedLogDescription<{ _sovTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): _TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _newTroveManagerAddress: string }>[];
  extractEvents(logs: Log[], name: "ZSUSDBalanceUpdated"): _TypedLogDescription<{ _newBalance: BigNumber }>[];
}

interface BorrowerOperationsCalls {
  BORROWING_FEE_FLOOR(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  ZSUSD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  feeDistributor(_overrides?: CallOverrides): Promise<string>;
  getCompositeDebt(_debt: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  liquityBaseParams(_overrides?: CallOverrides): Promise<string>;
  masset(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  sovToken(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
  zeroStaking(_overrides?: CallOverrides): Promise<string>;
  zeroStakingAddress(_overrides?: CallOverrides): Promise<string>;
  zsusdToken(_overrides?: CallOverrides): Promise<string>;
}

interface BorrowerOperationsTransactions {
  addColl(_upperHint: string, _lowerHint: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  addCollFrom(_troveOwner: string, _upperHint: string, _lowerHint: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  adjustTrove(_maxFeePercentage: BigNumberish, _collWithdrawal: BigNumberish, _ZSUSDChange: BigNumberish, _isDebtIncrease: boolean, _upperHint: string, _lowerHint: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  claimCollateral(_overrides?: Overrides): Promise<void>;
  closeTrove(_overrides?: Overrides): Promise<void>;
  moveSOVGainToTrove(_borrower: string, _upperHint: string, _lowerHint: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  openTrove(_maxFeePercentage: BigNumberish, _ZSUSDAmount: BigNumberish, _upperHint: string, _lowerHint: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  openTroveFrom(_owner: string, _maxFeePercentage: BigNumberish, _ZSUSDAmount: BigNumberish, _upperHint: string, _lowerHint: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  receiveApproval(_sender: string, _amount: BigNumberish, _token: string, _data: BytesLike, _overrides?: Overrides): Promise<void>;
  repayZSUSD(_ZSUSDAmount: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<void>;
  setAddresses(_sovTokenAddress: string, _feeDistributorAddress: string, _liquityBaseParamsAddress: string, _troveManagerAddress: string, _activePoolAddress: string, _defaultPoolAddress: string, _stabilityPoolAddress: string, _gasPoolAddress: string, _collSurplusPoolAddress: string, _priceFeedAddress: string, _sortedTrovesAddress: string, _zsusdTokenAddress: string, _zeroStakingAddress: string, _overrides?: Overrides): Promise<void>;
  setMassetAddress(_massetAddress: string, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
  withdrawColl(_collWithdrawal: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<void>;
  withdrawZSUSD(_maxFeePercentage: BigNumberish, _ZSUSDAmount: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<void>;
}

export interface BorrowerOperations
  extends _TypedLiquityContract<BorrowerOperationsCalls, BorrowerOperationsTransactions> {
  readonly address: string;
  readonly filters: {
    ActivePoolAddressChanged(_activePoolAddress?: null): EventFilter;
    CollSurplusPoolAddressChanged(_collSurplusPoolAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_defaultPoolAddress?: null): EventFilter;
    FeeDistributorAddressChanged(_feeDistributorAddress?: null): EventFilter;
    GasPoolAddressChanged(_gasPoolAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    SOVTokenAddressChanged(_sovTokenAddress?: null): EventFilter;
    SortedTrovesAddressChanged(_sortedTrovesAddress?: null): EventFilter;
    StabilityPoolAddressChanged(_stabilityPoolAddress?: null): EventFilter;
    TroveCreated(_borrower?: string | null, arrayIndex?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
    TroveUpdated(_borrower?: string | null, _debt?: null, _coll?: null, stake?: null, operation?: null): EventFilter;
    ZEROStakingAddressChanged(_zeroStakingAddress?: null): EventFilter;
    ZSUSDBorrowingFeePaid(_borrower?: string | null, _ZSUSDFee?: null): EventFilter;
    ZSUSDTokenAddressChanged(_zsusdTokenAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "CollSurplusPoolAddressChanged"): _TypedLogDescription<{ _collSurplusPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): _TypedLogDescription<{ _defaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "FeeDistributorAddressChanged"): _TypedLogDescription<{ _feeDistributorAddress: string }>[];
  extractEvents(logs: Log[], name: "GasPoolAddressChanged"): _TypedLogDescription<{ _gasPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "PriceFeedAddressChanged"): _TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(logs: Log[], name: "SOVTokenAddressChanged"): _TypedLogDescription<{ _sovTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): _TypedLogDescription<{ _sortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): _TypedLogDescription<{ _stabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveCreated"): _TypedLogDescription<{ _borrower: string; arrayIndex: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _newTroveManagerAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveUpdated"): _TypedLogDescription<{ _borrower: string; _debt: BigNumber; _coll: BigNumber; stake: BigNumber; operation: number }>[];
  extractEvents(logs: Log[], name: "ZEROStakingAddressChanged"): _TypedLogDescription<{ _zeroStakingAddress: string }>[];
  extractEvents(logs: Log[], name: "ZSUSDBorrowingFeePaid"): _TypedLogDescription<{ _borrower: string; _ZSUSDFee: BigNumber }>[];
  extractEvents(logs: Log[], name: "ZSUSDTokenAddressChanged"): _TypedLogDescription<{ _zsusdTokenAddress: string }>[];
}

interface CollSurplusPoolCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  getCollateral(_account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  getSOV(_overrides?: CallOverrides): Promise<BigNumber>;
  sovToken(_overrides?: CallOverrides): Promise<string>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

interface CollSurplusPoolTransactions {
  accountSurplus(_account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  claimColl(_account: string, _overrides?: Overrides): Promise<void>;
  setAddresses(_sovTokenAddress: string, _borrowerOperationsAddress: string, _troveManagerAddress: string, _activePoolAddress: string, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
}

export interface CollSurplusPool
  extends _TypedLiquityContract<CollSurplusPoolCalls, CollSurplusPoolTransactions> {
  readonly address: string;
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    CollBalanceUpdated(_account?: string | null, _newBalance?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    SOVSent(_to?: null, _amount?: null): EventFilter;
    SOVTokenAddressChanged(_sovTokenAddress?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "CollBalanceUpdated"): _TypedLogDescription<{ _account: string; _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "SOVSent"): _TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "SOVTokenAddressChanged"): _TypedLogDescription<{ _sovTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _newTroveManagerAddress: string }>[];
}

interface CommunityIssuanceCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  ISSUANCE_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  SECONDS_IN_ONE_MINUTE(_overrides?: CallOverrides): Promise<BigNumber>;
  ZEROSupplyCap(_overrides?: CallOverrides): Promise<BigNumber>;
  communityPotAddress(_overrides?: CallOverrides): Promise<string>;
  deploymentTime(_overrides?: CallOverrides): Promise<BigNumber>;
  fundingWalletAddress(_overrides?: CallOverrides): Promise<string>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  totalZEROIssued(_overrides?: CallOverrides): Promise<BigNumber>;
  zeroToken(_overrides?: CallOverrides): Promise<string>;
}

interface CommunityIssuanceTransactions {
  initialize(_zeroTokenAddress: string, _communityPotAddress: string, _fundingWalletAddress: string, _overrides?: Overrides): Promise<void>;
  issueZERO(_overrides?: Overrides): Promise<BigNumber>;
  receiveZero(_account: string, _ZEROamount: BigNumberish, _overrides?: Overrides): Promise<void>;
  sendZERO(_account: string, _ZEROamount: BigNumberish, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
}

export interface CommunityIssuance
  extends _TypedLiquityContract<CommunityIssuanceCalls, CommunityIssuanceTransactions> {
  readonly address: string;
  readonly filters: {
    CommunityPotAddressSet(_communityPotAddress?: null): EventFilter;
    FundingWalletAddressSet(_zeroTokenAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    TotalZEROIssuedUpdated(_fundingWalletAddress?: null): EventFilter;
    ZEROTokenAddressSet(_zeroTokenAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "CommunityPotAddressSet"): _TypedLogDescription<{ _communityPotAddress: string }>[];
  extractEvents(logs: Log[], name: "FundingWalletAddressSet"): _TypedLogDescription<{ _zeroTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "TotalZEROIssuedUpdated"): _TypedLogDescription<{ _fundingWalletAddress: BigNumber }>[];
  extractEvents(logs: Log[], name: "ZEROTokenAddressSet"): _TypedLogDescription<{ _zeroTokenAddress: string }>[];
}

interface DefaultPoolCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  getSOV(_overrides?: CallOverrides): Promise<BigNumber>;
  getZSUSDDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  sovToken(_overrides?: CallOverrides): Promise<string>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

interface DefaultPoolTransactions {
  decreaseZSUSDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  increaseZSUSDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  sendSOVToActivePool(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  setAddresses(_sovTokenAddress: string, _troveManagerAddress: string, _activePoolAddress: string, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
}

export interface DefaultPool
  extends _TypedLiquityContract<DefaultPoolCalls, DefaultPoolTransactions> {
  readonly address: string;
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    DefaultPoolZSUSDDebtUpdated(_ZSUSDDebt?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    SOVSent(_to?: null, _amount?: null): EventFilter;
    SOVTokenAddressChanged(_sovTokenAddress?: null): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
    ZSUSDBalanceUpdated(_newBalance?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): _TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolZSUSDDebtUpdated"): _TypedLogDescription<{ _ZSUSDDebt: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "SOVSent"): _TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "SOVTokenAddressChanged"): _TypedLogDescription<{ _sovTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): _TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _newTroveManagerAddress: string }>[];
  extractEvents(logs: Log[], name: "ZSUSDBalanceUpdated"): _TypedLogDescription<{ _newBalance: BigNumber }>[];
}

interface GasPoolCalls {
}

interface GasPoolTransactions {
}

export interface GasPool
  extends _TypedLiquityContract<GasPoolCalls, GasPoolTransactions> {
  readonly address: string;
  readonly filters: {
  };
}

interface HintHelpersCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  ZSUSD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  computeCR(_coll: BigNumberish, _debt: BigNumberish, _price: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  computeNominalCR(_coll: BigNumberish, _debt: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  getApproxHint(_CR: BigNumberish, _numTrials: BigNumberish, _inputRandomSeed: BigNumberish, _overrides?: CallOverrides): Promise<{ hintAddress: string; diff: BigNumber; latestRandomSeed: BigNumber }>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  getRedemptionHints(_ZSUSDamount: BigNumberish, _price: BigNumberish, _maxIterations: BigNumberish, _overrides?: CallOverrides): Promise<{ firstRedemptionHint: string; partialRedemptionHintNICR: BigNumber; truncatedZSUSDamount: BigNumber }>;
  liquityBaseParams(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
}

interface HintHelpersTransactions {
  setAddresses(_liquityBaseParamsAddress: string, _sortedTrovesAddress: string, _troveManagerAddress: string, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
}

export interface HintHelpers
  extends _TypedLiquityContract<HintHelpersCalls, HintHelpersTransactions> {
  readonly address: string;
  readonly filters: {
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    SortedTrovesAddressChanged(_sortedTrovesAddress?: null): EventFilter;
    TroveManagerAddressChanged(_troveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): _TypedLogDescription<{ _sortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _troveManagerAddress: string }>[];
}

interface IERC20Calls {
  allowance(owner: string, spender: string, _overrides?: CallOverrides): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  decimals(_overrides?: CallOverrides): Promise<number>;
  name(_overrides?: CallOverrides): Promise<string>;
  symbol(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface IERC20Transactions {
  approve(spender: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  decreaseAllowance(spender: string, subtractedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  increaseAllowance(spender: string, addedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  transfer(recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  transferFrom(sender: string, recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
}

export interface IERC20
  extends _TypedLiquityContract<IERC20Calls, IERC20Transactions> {
  readonly address: string;
  readonly filters: {
    Approval(owner?: string | null, spender?: string | null, value?: null): EventFilter;
    Transfer(from?: string | null, to?: string | null, value?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "Approval"): _TypedLogDescription<{ owner: string; spender: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "Transfer"): _TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
}

interface ZSUSDTokenCalls {
  allowance(owner: string, spender: string, _overrides?: CallOverrides): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  decimals(_overrides?: CallOverrides): Promise<number>;
  domainSeparator(_overrides?: CallOverrides): Promise<string>;
  name(_overrides?: CallOverrides): Promise<string>;
  nonces(owner: string, _overrides?: CallOverrides): Promise<BigNumber>;
  permitTypeHash(_overrides?: CallOverrides): Promise<string>;
  symbol(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
  version(_overrides?: CallOverrides): Promise<string>;
}

interface ZSUSDTokenTransactions {
  approve(spender: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  burn(_account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  decreaseAllowance(spender: string, subtractedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  increaseAllowance(spender: string, addedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  initialize(_troveManagerAddress: string, _stabilityPoolAddress: string, _borrowerOperationsAddress: string, _overrides?: Overrides): Promise<void>;
  mint(_account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  permit(owner: string, spender: string, amount: BigNumberish, deadline: BigNumberish, v: BigNumberish, r: BytesLike, s: BytesLike, _overrides?: Overrides): Promise<void>;
  returnFromPool(_poolAddress: string, _receiver: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  sendToPool(_sender: string, _poolAddress: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  transfer(recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  transferFrom(sender: string, recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
}

export interface ZSUSDToken
  extends _TypedLiquityContract<ZSUSDTokenCalls, ZSUSDTokenTransactions> {
  readonly address: string;
  readonly filters: {
    Approval(owner?: string | null, spender?: string | null, value?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    Transfer(from?: string | null, to?: string | null, value?: null): EventFilter;
    TroveManagerAddressChanged(_troveManagerAddress?: null): EventFilter;
    ZSUSDTokenBalanceUpdated(_user?: null, _amount?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "Approval"): _TypedLogDescription<{ owner: string; spender: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): _TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "Transfer"): _TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _troveManagerAddress: string }>[];
  extractEvents(logs: Log[], name: "ZSUSDTokenBalanceUpdated"): _TypedLogDescription<{ _user: string; _amount: BigNumber }>[];
}

interface ZEROStakingCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  F_SOV(_overrides?: CallOverrides): Promise<BigNumber>;
  F_ZSUSD(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  feeDistributorAddress(_overrides?: CallOverrides): Promise<string>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  getPendingSOVGain(_user: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getPendingZSUSDGain(_user: string, _overrides?: CallOverrides): Promise<BigNumber>;
  snapshots(arg0: string, _overrides?: CallOverrides): Promise<{ F_SOV_Snapshot: BigNumber; F_ZSUSD_Snapshot: BigNumber }>;
  sovToken(_overrides?: CallOverrides): Promise<string>;
  stakes(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  totalZEROStaked(_overrides?: CallOverrides): Promise<BigNumber>;
  zeroToken(_overrides?: CallOverrides): Promise<string>;
  zsusdToken(_overrides?: CallOverrides): Promise<string>;
}

interface ZEROStakingTransactions {
  increaseF_SOV(_SOVFee: BigNumberish, _overrides?: Overrides): Promise<void>;
  increaseF_ZSUSD(_ZSUSDFee: BigNumberish, _overrides?: Overrides): Promise<void>;
  setAddresses(_sovTokenAddress: string, _zeroTokenAddress: string, _zsusdTokenAddress: string, _feeDistributorAddress: string, _activePoolAddress: string, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
  stake(_ZEROamount: BigNumberish, _overrides?: Overrides): Promise<void>;
  unstake(_ZEROamount: BigNumberish, _overrides?: Overrides): Promise<void>;
}

export interface ZEROStaking
  extends _TypedLiquityContract<ZEROStakingCalls, ZEROStakingTransactions> {
  readonly address: string;
  readonly filters: {
    ActivePoolAddressSet(_activePoolAddress?: null): EventFilter;
    F_SOVUpdated(_F_SOV?: null): EventFilter;
    F_ZSUSDUpdated(_F_ZSUSD?: null): EventFilter;
    FeeDistributorAddressAddressSet(_feeDistributorAddress?: null): EventFilter;
    FeeDistributorAddressSet(_feeDistributorAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    SOVTokenAddressSet(_sovTokenAddress?: null): EventFilter;
    StakeChanged(staker?: string | null, newStake?: null): EventFilter;
    StakerSnapshotsUpdated(_staker?: null, _F_SOV?: null, _F_ZSUSD?: null): EventFilter;
    StakingGainsWithdrawn(staker?: string | null, ZSUSDGain?: null, SOVGain?: null): EventFilter;
    TotalZEROStakedUpdated(_totalZEROStaked?: null): EventFilter;
    ZEROTokenAddressSet(_zeroTokenAddress?: null): EventFilter;
    ZSUSDTokenAddressSet(_zsusdTokenAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressSet"): _TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "F_SOVUpdated"): _TypedLogDescription<{ _F_SOV: BigNumber }>[];
  extractEvents(logs: Log[], name: "F_ZSUSDUpdated"): _TypedLogDescription<{ _F_ZSUSD: BigNumber }>[];
  extractEvents(logs: Log[], name: "FeeDistributorAddressAddressSet"): _TypedLogDescription<{ _feeDistributorAddress: string }>[];
  extractEvents(logs: Log[], name: "FeeDistributorAddressSet"): _TypedLogDescription<{ _feeDistributorAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "SOVTokenAddressSet"): _TypedLogDescription<{ _sovTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "StakeChanged"): _TypedLogDescription<{ staker: string; newStake: BigNumber }>[];
  extractEvents(logs: Log[], name: "StakerSnapshotsUpdated"): _TypedLogDescription<{ _staker: string; _F_SOV: BigNumber; _F_ZSUSD: BigNumber }>[];
  extractEvents(logs: Log[], name: "StakingGainsWithdrawn"): _TypedLogDescription<{ staker: string; ZSUSDGain: BigNumber; SOVGain: BigNumber }>[];
  extractEvents(logs: Log[], name: "TotalZEROStakedUpdated"): _TypedLogDescription<{ _totalZEROStaked: BigNumber }>[];
  extractEvents(logs: Log[], name: "ZEROTokenAddressSet"): _TypedLogDescription<{ _zeroTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "ZSUSDTokenAddressSet"): _TypedLogDescription<{ _zsusdTokenAddress: string }>[];
}

interface ZEROTokenCalls {
  ONE_YEAR_IN_SECONDS(_overrides?: CallOverrides): Promise<BigNumber>;
  allowance(owner: string, spender: string, _overrides?: CallOverrides): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  decimals(_overrides?: CallOverrides): Promise<number>;
  domainSeparator(_overrides?: CallOverrides): Promise<string>;
  getDeploymentStartTime(_overrides?: CallOverrides): Promise<BigNumber>;
  marketMakerAddress(_overrides?: CallOverrides): Promise<string>;
  name(_overrides?: CallOverrides): Promise<string>;
  nonces(owner: string, _overrides?: CallOverrides): Promise<BigNumber>;
  permitTypeHash(_overrides?: CallOverrides): Promise<string>;
  presale(_overrides?: CallOverrides): Promise<string>;
  symbol(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
  version(_overrides?: CallOverrides): Promise<string>;
  zeroStakingAddress(_overrides?: CallOverrides): Promise<string>;
}

interface ZEROTokenTransactions {
  approve(spender: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  burn(account: string, amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  decreaseAllowance(spender: string, subtractedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  increaseAllowance(spender: string, addedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  initialize(_zeroStakingAddress: string, _marketMakerAddress: string, _presaleAddress: string, _overrides?: Overrides): Promise<void>;
  mint(account: string, amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  permit(owner: string, spender: string, amount: BigNumberish, deadline: BigNumberish, v: BigNumberish, r: BytesLike, s: BytesLike, _overrides?: Overrides): Promise<void>;
  sendToZEROStaking(_sender: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  transfer(recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  transferFrom(sender: string, recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
}

export interface ZEROToken
  extends _TypedLiquityContract<ZEROTokenCalls, ZEROTokenTransactions> {
  readonly address: string;
  readonly filters: {
    Approval(owner?: string | null, spender?: string | null, value?: null): EventFilter;
    Transfer(from?: string | null, to?: string | null, value?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "Approval"): _TypedLogDescription<{ owner: string; spender: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "Transfer"): _TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
}

interface MultiTroveGetterCalls {
  getMultipleSortedTroves(_startIdx: BigNumberish, _count: BigNumberish, _overrides?: CallOverrides): Promise<{ owner: string; debt: BigNumber; coll: BigNumber; stake: BigNumber; snapshotSOV: BigNumber; snapshotZSUSDDebt: BigNumber }[]>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
}

interface MultiTroveGetterTransactions {
  setAddresses(_troveManager: string, _sortedTroves: string, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
}

export interface MultiTroveGetter
  extends _TypedLiquityContract<MultiTroveGetterCalls, MultiTroveGetterTransactions> {
  readonly address: string;
  readonly filters: {
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
  };
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
}

interface PriceFeedCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  lastGoodPrice(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface PriceFeedTransactions {
  fetchPrice(_overrides?: Overrides): Promise<BigNumber>;
  setAddress(_index: BigNumberish, _newPriceFeed: string, _overrides?: Overrides): Promise<void>;
  setAddresses(_mainPriceFeed: string, _backupPriceFeed: string, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
}

export interface PriceFeed
  extends _TypedLiquityContract<PriceFeedCalls, PriceFeedTransactions> {
  readonly address: string;
  readonly filters: {
    LastGoodPriceUpdated(_lastGoodPrice?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    PriceFeedBroken(index?: null, priceFeedAddress?: null): EventFilter;
    PriceFeedUpdated(index?: null, newPriceFeedAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "LastGoodPriceUpdated"): _TypedLogDescription<{ _lastGoodPrice: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "PriceFeedBroken"): _TypedLogDescription<{ index: number; priceFeedAddress: string }>[];
  extractEvents(logs: Log[], name: "PriceFeedUpdated"): _TypedLogDescription<{ index: number; newPriceFeedAddress: string }>[];
}

interface PriceFeedTestnetCalls {
  getPrice(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface PriceFeedTestnetTransactions {
  fetchPrice(_overrides?: Overrides): Promise<BigNumber>;
  setPrice(price: BigNumberish, _overrides?: Overrides): Promise<boolean>;
}

export interface PriceFeedTestnet
  extends _TypedLiquityContract<PriceFeedTestnetCalls, PriceFeedTestnetTransactions> {
  readonly address: string;
  readonly filters: {
    LastGoodPriceUpdated(_lastGoodPrice?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "LastGoodPriceUpdated"): _TypedLogDescription<{ _lastGoodPrice: BigNumber }>[];
}

interface SortedTrovesCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  contains(_id: string, _overrides?: CallOverrides): Promise<boolean>;
  data(_overrides?: CallOverrides): Promise<{ head: string; tail: string; maxSize: BigNumber; size: BigNumber }>;
  findInsertPosition(_NICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: CallOverrides): Promise<[string, string]>;
  getFirst(_overrides?: CallOverrides): Promise<string>;
  getLast(_overrides?: CallOverrides): Promise<string>;
  getMaxSize(_overrides?: CallOverrides): Promise<BigNumber>;
  getNext(_id: string, _overrides?: CallOverrides): Promise<string>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  getPrev(_id: string, _overrides?: CallOverrides): Promise<string>;
  getSize(_overrides?: CallOverrides): Promise<BigNumber>;
  isEmpty(_overrides?: CallOverrides): Promise<boolean>;
  isFull(_overrides?: CallOverrides): Promise<boolean>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
  validInsertPosition(_NICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: CallOverrides): Promise<boolean>;
}

interface SortedTrovesTransactions {
  insert(_id: string, _NICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: Overrides): Promise<void>;
  reInsert(_id: string, _newNICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: Overrides): Promise<void>;
  remove(_id: string, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
  setParams(_size: BigNumberish, _troveManagerAddress: string, _borrowerOperationsAddress: string, _overrides?: Overrides): Promise<void>;
}

export interface SortedTroves
  extends _TypedLiquityContract<SortedTrovesCalls, SortedTrovesTransactions> {
  readonly address: string;
  readonly filters: {
    BorrowerOperationsAddressChanged(_borrowerOperationsAddress?: null): EventFilter;
    NodeAdded(_id?: null, _NICR?: null): EventFilter;
    NodeRemoved(_id?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    SortedTrovesAddressChanged(_sortedDoublyLLAddress?: null): EventFilter;
    TroveManagerAddressChanged(_troveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _borrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "NodeAdded"): _TypedLogDescription<{ _id: string; _NICR: BigNumber }>[];
  extractEvents(logs: Log[], name: "NodeRemoved"): _TypedLogDescription<{ _id: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): _TypedLogDescription<{ _sortedDoublyLLAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _troveManagerAddress: string }>[];
}

interface StabilityPoolCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  P(_overrides?: CallOverrides): Promise<BigNumber>;
  SCALE_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  ZSUSD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  borrowerOperations(_overrides?: CallOverrides): Promise<string>;
  communityIssuance(_overrides?: CallOverrides): Promise<string>;
  currentEpoch(_overrides?: CallOverrides): Promise<BigNumber>;
  currentScale(_overrides?: CallOverrides): Promise<BigNumber>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  depositSnapshots(arg0: string, _overrides?: CallOverrides): Promise<{ S: BigNumber; P: BigNumber; G: BigNumber; scale: BigNumber; epoch: BigNumber }>;
  deposits(arg0: string, _overrides?: CallOverrides): Promise<{ initialValue: BigNumber; frontEndTag: string }>;
  epochToScaleToG(arg0: BigNumberish, arg1: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  epochToScaleToSum(arg0: BigNumberish, arg1: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  frontEndSnapshots(arg0: string, _overrides?: CallOverrides): Promise<{ S: BigNumber; P: BigNumber; G: BigNumber; scale: BigNumber; epoch: BigNumber }>;
  frontEndStakes(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  frontEnds(arg0: string, _overrides?: CallOverrides): Promise<{ kickbackRate: BigNumber; registered: boolean }>;
  getCompoundedFrontEndStake(_frontEnd: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getCompoundedZSUSDDeposit(_depositor: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getDepositorSOVGain(_depositor: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  getSOV(_overrides?: CallOverrides): Promise<BigNumber>;
  getTotalZSUSDDeposits(_overrides?: CallOverrides): Promise<BigNumber>;
  lastSOVError_Offset(_overrides?: CallOverrides): Promise<BigNumber>;
  lastZEROError(_overrides?: CallOverrides): Promise<BigNumber>;
  lastZSUSDLossError_Offset(_overrides?: CallOverrides): Promise<BigNumber>;
  liquityBaseParams(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  sovToken(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
  zsusdToken(_overrides?: CallOverrides): Promise<string>;
}

interface StabilityPoolTransactions {
  offset(_debtToOffset: BigNumberish, _collToAdd: BigNumberish, _overrides?: Overrides): Promise<void>;
  provideToSP(_amount: BigNumberish, _frontEndTag: string, _overrides?: Overrides): Promise<void>;
  registerFrontEnd(_kickbackRate: BigNumberish, _overrides?: Overrides): Promise<void>;
  setAddresses(_sovTokenAddress: string, _liquityBaseParamsAddress: string, _borrowerOperationsAddress: string, _troveManagerAddress: string, _activePoolAddress: string, _zsusdTokenAddress: string, _sortedTrovesAddress: string, _priceFeedAddress: string, _communityIssuanceAddress: string, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
  withdrawFromSP(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  withdrawSOVGainToTrove(_upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<void>;
}

export interface StabilityPool
  extends _TypedLiquityContract<StabilityPoolCalls, StabilityPoolTransactions> {
  readonly address: string;
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    CommunityIssuanceAddressChanged(_newCommunityIssuanceAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    DepositSnapshotUpdated(_depositor?: string | null, _P?: null, _S?: null, _G?: null): EventFilter;
    EpochUpdated(_currentEpoch?: null): EventFilter;
    FrontEndRegistered(_frontEnd?: string | null, _kickbackRate?: null): EventFilter;
    FrontEndSnapshotUpdated(_frontEnd?: string | null, _P?: null, _G?: null): EventFilter;
    FrontEndStakeChanged(_frontEnd?: string | null, _newFrontEndStake?: null, _depositor?: null): EventFilter;
    FrontEndTagSet(_depositor?: string | null, _frontEnd?: string | null): EventFilter;
    G_Updated(_G?: null, _epoch?: null, _scale?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    P_Updated(_P?: null): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    SOVGainWithdrawn(_depositor?: string | null, _SOV?: null, _ZSUSDLoss?: null): EventFilter;
    SOVSent(_to?: null, _amount?: null): EventFilter;
    SOVTokenAddressChanged(_sovTokenAddress?: null): EventFilter;
    S_Updated(_S?: null, _epoch?: null, _scale?: null): EventFilter;
    ScaleUpdated(_currentScale?: null): EventFilter;
    SortedTrovesAddressChanged(_newSortedTrovesAddress?: null): EventFilter;
    StabilityPoolSOVBalanceUpdated(_newBalance?: null): EventFilter;
    StabilityPoolZSUSDBalanceUpdated(_newBalance?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
    UserDepositChanged(_depositor?: string | null, _newDeposit?: null): EventFilter;
    ZEROPaidToDepositor(_depositor?: string | null, _ZERO?: null): EventFilter;
    ZEROPaidToFrontEnd(_frontEnd?: string | null, _ZERO?: null): EventFilter;
    ZSUSDTokenAddressChanged(_newZSUSDTokenAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "CommunityIssuanceAddressChanged"): _TypedLogDescription<{ _newCommunityIssuanceAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): _TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DepositSnapshotUpdated"): _TypedLogDescription<{ _depositor: string; _P: BigNumber; _S: BigNumber; _G: BigNumber }>[];
  extractEvents(logs: Log[], name: "EpochUpdated"): _TypedLogDescription<{ _currentEpoch: BigNumber }>[];
  extractEvents(logs: Log[], name: "FrontEndRegistered"): _TypedLogDescription<{ _frontEnd: string; _kickbackRate: BigNumber }>[];
  extractEvents(logs: Log[], name: "FrontEndSnapshotUpdated"): _TypedLogDescription<{ _frontEnd: string; _P: BigNumber; _G: BigNumber }>[];
  extractEvents(logs: Log[], name: "FrontEndStakeChanged"): _TypedLogDescription<{ _frontEnd: string; _newFrontEndStake: BigNumber; _depositor: string }>[];
  extractEvents(logs: Log[], name: "FrontEndTagSet"): _TypedLogDescription<{ _depositor: string; _frontEnd: string }>[];
  extractEvents(logs: Log[], name: "G_Updated"): _TypedLogDescription<{ _G: BigNumber; _epoch: BigNumber; _scale: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "P_Updated"): _TypedLogDescription<{ _P: BigNumber }>[];
  extractEvents(logs: Log[], name: "PriceFeedAddressChanged"): _TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(logs: Log[], name: "SOVGainWithdrawn"): _TypedLogDescription<{ _depositor: string; _SOV: BigNumber; _ZSUSDLoss: BigNumber }>[];
  extractEvents(logs: Log[], name: "SOVSent"): _TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "SOVTokenAddressChanged"): _TypedLogDescription<{ _sovTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "S_Updated"): _TypedLogDescription<{ _S: BigNumber; _epoch: BigNumber; _scale: BigNumber }>[];
  extractEvents(logs: Log[], name: "ScaleUpdated"): _TypedLogDescription<{ _currentScale: BigNumber }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): _TypedLogDescription<{ _newSortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolSOVBalanceUpdated"): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "StabilityPoolZSUSDBalanceUpdated"): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _newTroveManagerAddress: string }>[];
  extractEvents(logs: Log[], name: "UserDepositChanged"): _TypedLogDescription<{ _depositor: string; _newDeposit: BigNumber }>[];
  extractEvents(logs: Log[], name: "ZEROPaidToDepositor"): _TypedLogDescription<{ _depositor: string; _ZERO: BigNumber }>[];
  extractEvents(logs: Log[], name: "ZEROPaidToFrontEnd"): _TypedLogDescription<{ _frontEnd: string; _ZERO: BigNumber }>[];
  extractEvents(logs: Log[], name: "ZSUSDTokenAddressChanged"): _TypedLogDescription<{ _newZSUSDTokenAddress: string }>[];
}

interface TroveManagerCalls {
  BETA(_overrides?: CallOverrides): Promise<BigNumber>;
  BOOTSTRAP_PERIOD(_overrides?: CallOverrides): Promise<BigNumber>;
  CCR(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  L_SOV(_overrides?: CallOverrides): Promise<BigNumber>;
  L_ZSUSDDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  MCR(_overrides?: CallOverrides): Promise<BigNumber>;
  MINUTE_DECAY_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  SECONDS_IN_ONE_MINUTE(_overrides?: CallOverrides): Promise<BigNumber>;
  TroveOwners(arg0: BigNumberish, _overrides?: CallOverrides): Promise<string>;
  Troves(arg0: string, _overrides?: CallOverrides): Promise<{ debt: BigNumber; coll: BigNumber; stake: BigNumber; status: number; arrayIndex: BigNumber }>;
  ZSUSD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  _getCurrentICR(_borrower: string, _price: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  _getPendingSOVReward(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  _getPendingZSUSDDebtReward(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  _getRedemptionRate(_overrides?: CallOverrides): Promise<BigNumber>;
  _hasPendingRewards(_borrower: string, _overrides?: CallOverrides): Promise<boolean>;
  _stabilityPool(_overrides?: CallOverrides): Promise<string>;
  _zeroStaking(_overrides?: CallOverrides): Promise<string>;
  _zeroToken(_overrides?: CallOverrides): Promise<string>;
  _zsusdToken(_overrides?: CallOverrides): Promise<string>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  baseRate(_overrides?: CallOverrides): Promise<BigNumber>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  checkRecoveryMode(_price: BigNumberish, _overrides?: CallOverrides): Promise<boolean>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  feeDistributor(_overrides?: CallOverrides): Promise<string>;
  getBorrowingFee(_ZSUSDDebt: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getBorrowingFeeWithDecay(_ZSUSDDebt: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getBorrowingRate(_overrides?: CallOverrides): Promise<BigNumber>;
  getBorrowingRateWithDecay(_overrides?: CallOverrides): Promise<BigNumber>;
  getCurrentICR(_borrower: string, _price: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireDebtAndColl(_borrower: string, _overrides?: CallOverrides): Promise<{ debt: BigNumber; coll: BigNumber; pendingZSUSDDebtReward: BigNumber; pendingSOVReward: BigNumber }>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getNominalICR(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  getPendingSOVReward(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getPendingZSUSDDebtReward(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getRedemptionFeeWithDecay(_SOVDrawn: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getRedemptionRate(_overrides?: CallOverrides): Promise<BigNumber>;
  getRedemptionRateWithDecay(_overrides?: CallOverrides): Promise<BigNumber>;
  getTCR(_price: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveColl(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveDebt(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveFromTroveOwnersArray(_index: BigNumberish, _overrides?: CallOverrides): Promise<string>;
  getTroveOwnersCount(_overrides?: CallOverrides): Promise<BigNumber>;
  getTroveStake(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveStatus(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  hasPendingRewards(_borrower: string, _overrides?: CallOverrides): Promise<boolean>;
  lastFeeOperationTime(_overrides?: CallOverrides): Promise<BigNumber>;
  lastSOVError_Redistribution(_overrides?: CallOverrides): Promise<BigNumber>;
  lastZSUSDDebtError_Redistribution(_overrides?: CallOverrides): Promise<BigNumber>;
  liquityBaseParams(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  rewardSnapshots(arg0: string, _overrides?: CallOverrides): Promise<{ SOV: BigNumber; ZSUSDDebt: BigNumber }>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  sovToken(_overrides?: CallOverrides): Promise<string>;
  totalCollateralSnapshot(_overrides?: CallOverrides): Promise<BigNumber>;
  totalStakes(_overrides?: CallOverrides): Promise<BigNumber>;
  totalStakesSnapshot(_overrides?: CallOverrides): Promise<BigNumber>;
  troveManagerRedeemOps(_overrides?: CallOverrides): Promise<string>;
}

interface TroveManagerTransactions {
  addTroveOwnerToArray(_borrower: string, _overrides?: Overrides): Promise<BigNumber>;
  applyPendingRewards(_borrower: string, _overrides?: Overrides): Promise<void>;
  batchLiquidateTroves(_troveArray: string[], _overrides?: Overrides): Promise<void>;
  closeTrove(_borrower: string, _overrides?: Overrides): Promise<void>;
  decayBaseRateFromBorrowing(_overrides?: Overrides): Promise<void>;
  decreaseTroveColl(_borrower: string, _collDecrease: BigNumberish, _overrides?: Overrides): Promise<BigNumber>;
  decreaseTroveDebt(_borrower: string, _debtDecrease: BigNumberish, _overrides?: Overrides): Promise<BigNumber>;
  increaseTroveColl(_borrower: string, _collIncrease: BigNumberish, _overrides?: Overrides): Promise<BigNumber>;
  increaseTroveDebt(_borrower: string, _debtIncrease: BigNumberish, _overrides?: Overrides): Promise<BigNumber>;
  liquidate(_borrower: string, _overrides?: Overrides): Promise<void>;
  liquidateTroves(_n: BigNumberish, _overrides?: Overrides): Promise<void>;
  redeemCollateral(_ZSUSDamount: BigNumberish, _firstRedemptionHint: string, _upperPartialRedemptionHint: string, _lowerPartialRedemptionHint: string, _partialRedemptionHintNICR: BigNumberish, _maxIterations: BigNumberish, _maxFeePercentage: BigNumberish, _overrides?: Overrides): Promise<void>;
  removeStake(_borrower: string, _overrides?: Overrides): Promise<void>;
  setAddresses(_setupAddresses: string[], _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
  setTroveStatus(_borrower: string, _num: BigNumberish, _overrides?: Overrides): Promise<void>;
  updateStakeAndTotalStakes(_borrower: string, _overrides?: Overrides): Promise<BigNumber>;
  updateTroveRewardSnapshots(_borrower: string, _overrides?: Overrides): Promise<void>;
}

export interface TroveManager
  extends _TypedLiquityContract<TroveManagerCalls, TroveManagerTransactions> {
  readonly address: string;
  readonly filters: {
    ActivePoolAddressChanged(_activePoolAddress?: null): EventFilter;
    BaseRateUpdated(_baseRate?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    CollSurplusPoolAddressChanged(_collSurplusPoolAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_defaultPoolAddress?: null): EventFilter;
    FeeDistributorAddressChanged(_feeDistributorAddress?: null): EventFilter;
    GasPoolAddressChanged(_gasPoolAddress?: null): EventFilter;
    LTermsUpdated(_L_SOV?: null, _L_ZSUSDDebt?: null): EventFilter;
    LastFeeOpTimeUpdated(_lastFeeOpTime?: null): EventFilter;
    Liquidation(_liquidatedDebt?: null, _liquidatedColl?: null, _collGasCompensation?: null, _ZSUSDGasCompensation?: null): EventFilter;
    LiquityBaseParamsAddressChanges(_borrowerOperationsAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    Redemption(_attemptedZSUSDAmount?: null, _actualZSUSDAmount?: null, _SOVSent?: null, _SOVFee?: null): EventFilter;
    SOVTokenAddressChanged(_sovTokenAddress?: null): EventFilter;
    SortedTrovesAddressChanged(_sortedTrovesAddress?: null): EventFilter;
    StabilityPoolAddressChanged(_stabilityPoolAddress?: null): EventFilter;
    SystemSnapshotsUpdated(_totalStakesSnapshot?: null, _totalCollateralSnapshot?: null): EventFilter;
    TotalStakesUpdated(_newTotalStakes?: null): EventFilter;
    TroveIndexUpdated(_borrower?: null, _newIndex?: null): EventFilter;
    TroveLiquidated(_borrower?: string | null, _debt?: null, _coll?: null, operation?: null): EventFilter;
    TroveManagerRedeemOpsAddressChanged(_troveManagerRedeemOps?: null): EventFilter;
    TroveSnapshotsUpdated(_L_SOV?: null, _L_ZSUSDDebt?: null): EventFilter;
    TroveUpdated(_borrower?: string | null, _debt?: null, _coll?: null, stake?: null, operation?: null): EventFilter;
    ZEROStakingAddressChanged(_zeroStakingAddress?: null): EventFilter;
    ZEROTokenAddressChanged(_zeroTokenAddress?: null): EventFilter;
    ZSUSDTokenAddressChanged(_newZSUSDTokenAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "BaseRateUpdated"): _TypedLogDescription<{ _baseRate: BigNumber }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "CollSurplusPoolAddressChanged"): _TypedLogDescription<{ _collSurplusPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): _TypedLogDescription<{ _defaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "FeeDistributorAddressChanged"): _TypedLogDescription<{ _feeDistributorAddress: string }>[];
  extractEvents(logs: Log[], name: "GasPoolAddressChanged"): _TypedLogDescription<{ _gasPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "LTermsUpdated"): _TypedLogDescription<{ _L_SOV: BigNumber; _L_ZSUSDDebt: BigNumber }>[];
  extractEvents(logs: Log[], name: "LastFeeOpTimeUpdated"): _TypedLogDescription<{ _lastFeeOpTime: BigNumber }>[];
  extractEvents(logs: Log[], name: "Liquidation"): _TypedLogDescription<{ _liquidatedDebt: BigNumber; _liquidatedColl: BigNumber; _collGasCompensation: BigNumber; _ZSUSDGasCompensation: BigNumber }>[];
  extractEvents(logs: Log[], name: "LiquityBaseParamsAddressChanges"): _TypedLogDescription<{ _borrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "PriceFeedAddressChanged"): _TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(logs: Log[], name: "Redemption"): _TypedLogDescription<{ _attemptedZSUSDAmount: BigNumber; _actualZSUSDAmount: BigNumber; _SOVSent: BigNumber; _SOVFee: BigNumber }>[];
  extractEvents(logs: Log[], name: "SOVTokenAddressChanged"): _TypedLogDescription<{ _sovTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): _TypedLogDescription<{ _sortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): _TypedLogDescription<{ _stabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "SystemSnapshotsUpdated"): _TypedLogDescription<{ _totalStakesSnapshot: BigNumber; _totalCollateralSnapshot: BigNumber }>[];
  extractEvents(logs: Log[], name: "TotalStakesUpdated"): _TypedLogDescription<{ _newTotalStakes: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveIndexUpdated"): _TypedLogDescription<{ _borrower: string; _newIndex: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveLiquidated"): _TypedLogDescription<{ _borrower: string; _debt: BigNumber; _coll: BigNumber; operation: number }>[];
  extractEvents(logs: Log[], name: "TroveManagerRedeemOpsAddressChanged"): _TypedLogDescription<{ _troveManagerRedeemOps: string }>[];
  extractEvents(logs: Log[], name: "TroveSnapshotsUpdated"): _TypedLogDescription<{ _L_SOV: BigNumber; _L_ZSUSDDebt: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveUpdated"): _TypedLogDescription<{ _borrower: string; _debt: BigNumber; _coll: BigNumber; stake: BigNumber; operation: number }>[];
  extractEvents(logs: Log[], name: "ZEROStakingAddressChanged"): _TypedLogDescription<{ _zeroStakingAddress: string }>[];
  extractEvents(logs: Log[], name: "ZEROTokenAddressChanged"): _TypedLogDescription<{ _zeroTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "ZSUSDTokenAddressChanged"): _TypedLogDescription<{ _newZSUSDTokenAddress: string }>[];
}

interface TroveManagerRedeemOpsCalls {
  BETA(_overrides?: CallOverrides): Promise<BigNumber>;
  BOOTSTRAP_PERIOD(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  L_SOV(_overrides?: CallOverrides): Promise<BigNumber>;
  L_ZSUSDDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  MINUTE_DECAY_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  SECONDS_IN_ONE_MINUTE(_overrides?: CallOverrides): Promise<BigNumber>;
  TroveOwners(arg0: BigNumberish, _overrides?: CallOverrides): Promise<string>;
  Troves(arg0: string, _overrides?: CallOverrides): Promise<{ debt: BigNumber; coll: BigNumber; stake: BigNumber; status: number; arrayIndex: BigNumber }>;
  ZSUSD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  _getCurrentICR(_borrower: string, _price: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  _getPendingSOVReward(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  _getPendingZSUSDDebtReward(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  _getRedemptionRate(_overrides?: CallOverrides): Promise<BigNumber>;
  _hasPendingRewards(_borrower: string, _overrides?: CallOverrides): Promise<boolean>;
  _stabilityPool(_overrides?: CallOverrides): Promise<string>;
  _zeroStaking(_overrides?: CallOverrides): Promise<string>;
  _zeroToken(_overrides?: CallOverrides): Promise<string>;
  _zsusdToken(_overrides?: CallOverrides): Promise<string>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  baseRate(_overrides?: CallOverrides): Promise<BigNumber>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  feeDistributor(_overrides?: CallOverrides): Promise<string>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  lastFeeOperationTime(_overrides?: CallOverrides): Promise<BigNumber>;
  lastSOVError_Redistribution(_overrides?: CallOverrides): Promise<BigNumber>;
  lastZSUSDDebtError_Redistribution(_overrides?: CallOverrides): Promise<BigNumber>;
  liquityBaseParams(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  rewardSnapshots(arg0: string, _overrides?: CallOverrides): Promise<{ SOV: BigNumber; ZSUSDDebt: BigNumber }>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  sovToken(_overrides?: CallOverrides): Promise<string>;
  totalCollateralSnapshot(_overrides?: CallOverrides): Promise<BigNumber>;
  totalStakes(_overrides?: CallOverrides): Promise<BigNumber>;
  totalStakesSnapshot(_overrides?: CallOverrides): Promise<BigNumber>;
  troveManagerRedeemOps(_overrides?: CallOverrides): Promise<string>;
}

interface TroveManagerRedeemOpsTransactions {
  redeemCollateral(_ZSUSDamount: BigNumberish, _firstRedemptionHint: string, _upperPartialRedemptionHint: string, _lowerPartialRedemptionHint: string, _partialRedemptionHintNICR: BigNumberish, _maxIterations: BigNumberish, _maxFeePercentage: BigNumberish, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
}

export interface TroveManagerRedeemOps
  extends _TypedLiquityContract<TroveManagerRedeemOpsCalls, TroveManagerRedeemOpsTransactions> {
  readonly address: string;
  readonly filters: {
    BaseRateUpdated(_baseRate?: null): EventFilter;
    LTermsUpdated(_L_SOV?: null, _L_ZSUSDDebt?: null): EventFilter;
    LastFeeOpTimeUpdated(_lastFeeOpTime?: null): EventFilter;
    Liquidation(_liquidatedDebt?: null, _liquidatedColl?: null, _collGasCompensation?: null, _ZSUSDGasCompensation?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    Redemption(_attemptedZSUSDAmount?: null, _actualZSUSDAmount?: null, _SOVSent?: null, _SOVFee?: null): EventFilter;
    SystemSnapshotsUpdated(_totalStakesSnapshot?: null, _totalCollateralSnapshot?: null): EventFilter;
    TotalStakesUpdated(_newTotalStakes?: null): EventFilter;
    TroveIndexUpdated(_borrower?: null, _newIndex?: null): EventFilter;
    TroveLiquidated(_borrower?: string | null, _debt?: null, _coll?: null, _operation?: null): EventFilter;
    TroveSnapshotsUpdated(_L_SOV?: null, _L_ZSUSDDebt?: null): EventFilter;
    TroveUpdated(_borrower?: string | null, _debt?: null, _coll?: null, _stake?: null, _operation?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "BaseRateUpdated"): _TypedLogDescription<{ _baseRate: BigNumber }>[];
  extractEvents(logs: Log[], name: "LTermsUpdated"): _TypedLogDescription<{ _L_SOV: BigNumber; _L_ZSUSDDebt: BigNumber }>[];
  extractEvents(logs: Log[], name: "LastFeeOpTimeUpdated"): _TypedLogDescription<{ _lastFeeOpTime: BigNumber }>[];
  extractEvents(logs: Log[], name: "Liquidation"): _TypedLogDescription<{ _liquidatedDebt: BigNumber; _liquidatedColl: BigNumber; _collGasCompensation: BigNumber; _ZSUSDGasCompensation: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "Redemption"): _TypedLogDescription<{ _attemptedZSUSDAmount: BigNumber; _actualZSUSDAmount: BigNumber; _SOVSent: BigNumber; _SOVFee: BigNumber }>[];
  extractEvents(logs: Log[], name: "SystemSnapshotsUpdated"): _TypedLogDescription<{ _totalStakesSnapshot: BigNumber; _totalCollateralSnapshot: BigNumber }>[];
  extractEvents(logs: Log[], name: "TotalStakesUpdated"): _TypedLogDescription<{ _newTotalStakes: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveIndexUpdated"): _TypedLogDescription<{ _borrower: string; _newIndex: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveLiquidated"): _TypedLogDescription<{ _borrower: string; _debt: BigNumber; _coll: BigNumber; _operation: number }>[];
  extractEvents(logs: Log[], name: "TroveSnapshotsUpdated"): _TypedLogDescription<{ _L_SOV: BigNumber; _L_ZSUSDDebt: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveUpdated"): _TypedLogDescription<{ _borrower: string; _debt: BigNumber; _coll: BigNumber; _stake: BigNumber; _operation: number }>[];
}

interface UpgradableProxyCalls {
  getImplementation(_overrides?: CallOverrides): Promise<string>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
}

interface UpgradableProxyTransactions {
  setImplementation(_implementation: string, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
}

export interface UpgradableProxy
  extends _TypedLiquityContract<UpgradableProxyCalls, UpgradableProxyTransactions> {
  readonly address: string;
  readonly filters: {
    ImplementationChanged(_oldImplementation?: string | null, _newImplementation?: string | null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ImplementationChanged"): _TypedLogDescription<{ _oldImplementation: string; _newImplementation: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
}

interface LiquityBaseParamsCalls {
  BORROWING_FEE_FLOOR(_overrides?: CallOverrides): Promise<BigNumber>;
  CCR(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  MAX_BORROWING_FEE(_overrides?: CallOverrides): Promise<BigNumber>;
  MCR(_overrides?: CallOverrides): Promise<BigNumber>;
  PERCENT_DIVISOR(_overrides?: CallOverrides): Promise<BigNumber>;
  REDEMPTION_FEE_FLOOR(_overrides?: CallOverrides): Promise<BigNumber>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
}

interface LiquityBaseParamsTransactions {
  initialize(_overrides?: Overrides): Promise<void>;
  setBorrowingFeeFloor(BORROWING_FEE_FLOOR_: BigNumberish, _overrides?: Overrides): Promise<void>;
  setCCR(CCR_: BigNumberish, _overrides?: Overrides): Promise<void>;
  setMCR(MCR_: BigNumberish, _overrides?: Overrides): Promise<void>;
  setMaxBorrowingFee(MAX_BORROWING_FEE_: BigNumberish, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
  setPercentDivisor(PERCENT_DIVISOR_: BigNumberish, _overrides?: Overrides): Promise<void>;
  setRedemptionFeeFloor(REDEMPTION_FEE_FLOOR_: BigNumberish, _overrides?: Overrides): Promise<void>;
}

export interface LiquityBaseParams
  extends _TypedLiquityContract<LiquityBaseParamsCalls, LiquityBaseParamsTransactions> {
  readonly address: string;
  readonly filters: {
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
  };
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
}

interface MockBalanceRedirectPresaleCalls {
  isClosed(_overrides?: CallOverrides): Promise<boolean>;
}

interface MockBalanceRedirectPresaleTransactions {
  closePresale(_overrides?: Overrides): Promise<void>;
  openPresale(_overrides?: Overrides): Promise<void>;
}

export interface MockBalanceRedirectPresale
  extends _TypedLiquityContract<MockBalanceRedirectPresaleCalls, MockBalanceRedirectPresaleTransactions> {
  readonly address: string;
  readonly filters: {
  };
}

interface FeeDistributorCalls {
  FEE_TO_SOV_COLLECTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  borrowerOperations(_overrides?: CallOverrides): Promise<string>;
  getOwner(_overrides?: CallOverrides): Promise<string>;
  sovFeeCollector(_overrides?: CallOverrides): Promise<string>;
  sovToken(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
  wrbtc(_overrides?: CallOverrides): Promise<string>;
  zeroStaking(_overrides?: CallOverrides): Promise<string>;
  zsusdToken(_overrides?: CallOverrides): Promise<string>;
}

interface FeeDistributorTransactions {
  distributeFees(_overrides?: Overrides): Promise<void>;
  setAddresses(_sovTokenAddress: string, _sovFeeCollectorAddress: string, _zeroStakingAddress: string, _borrowerOperationsAddress: string, _troveManagerAddress: string, _wrbtcAddress: string, _zsusdTokenAddress: string, _activePoolAddress: string, _overrides?: Overrides): Promise<void>;
  setFeeToSOVCollector(FEE_TO_SOV_COLLECTOR_: BigNumberish, _overrides?: Overrides): Promise<void>;
  setOwner(_owner: string, _overrides?: Overrides): Promise<void>;
}

export interface FeeDistributor
  extends _TypedLiquityContract<FeeDistributorCalls, FeeDistributorTransactions> {
  readonly address: string;
  readonly filters: {
    ActivePoolAddressSet(_activePoolAddress?: null): EventFilter;
    BorrowerOperationsAddressChanged(_borrowerOperationsAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    SOVDistributed(_rbtcDistributedAmount?: null): EventFilter;
    SOVFeeCollectorAddressChanged(_sovFeeCollectorAddress?: null): EventFilter;
    SOVTokenAddressChanged(_sovTokenAddress?: null): EventFilter;
    TroveManagerAddressChanged(_troveManagerAddress?: null): EventFilter;
    WrbtcAddressChanged(_wrbtcAddress?: null): EventFilter;
    ZSUSDDistributed(_zsusdDistributedAmount?: null): EventFilter;
    ZSUSDTokenAddressChanged(_zsusdTokenAddress?: null): EventFilter;
    ZeroStakingAddressChanged(_zeroStakingAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressSet"): _TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _borrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "SOVDistributed"): _TypedLogDescription<{ _rbtcDistributedAmount: BigNumber }>[];
  extractEvents(logs: Log[], name: "SOVFeeCollectorAddressChanged"): _TypedLogDescription<{ _sovFeeCollectorAddress: string }>[];
  extractEvents(logs: Log[], name: "SOVTokenAddressChanged"): _TypedLogDescription<{ _sovTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _troveManagerAddress: string }>[];
  extractEvents(logs: Log[], name: "WrbtcAddressChanged"): _TypedLogDescription<{ _wrbtcAddress: string }>[];
  extractEvents(logs: Log[], name: "ZSUSDDistributed"): _TypedLogDescription<{ _zsusdDistributedAmount: BigNumber }>[];
  extractEvents(logs: Log[], name: "ZSUSDTokenAddressChanged"): _TypedLogDescription<{ _zsusdTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "ZeroStakingAddressChanged"): _TypedLogDescription<{ _zeroStakingAddress: string }>[];
}
