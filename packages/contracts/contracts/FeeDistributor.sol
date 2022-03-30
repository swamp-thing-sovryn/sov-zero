// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/IFeeDistributor.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/LiquityMath.sol";
import "./FeeDistributorStorage.sol";
import "./Dependencies/SafeMath.sol";

contract FeeDistributor is CheckContract, FeeDistributorStorage, IFeeDistributor {
    using SafeMath for uint256;
    // --- Events ---
    
    event SOVTokenAddressChanged(address _sovTokenAddress);
    event SOVFeeCollectorAddressChanged(address _sovFeeCollectorAddress);
    event ZeroStakingAddressChanged(address _zeroStakingAddress);
    event BorrowerOperationsAddressChanged(address _borrowerOperationsAddress);
    event TroveManagerAddressChanged(address _troveManagerAddress);
    event WrbtcAddressChanged(address _wrbtcAddress);
    event ZSUSDTokenAddressChanged(address _zsusdTokenAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    event ZSUSDDistributed(uint256 _zsusdDistributedAmount);
    event SOVDistributed(uint256 _rbtcDistributedAmount);

    // --- Dependency setters ---

    function setAddresses(
        address _sovTokenAddress,
        address _sovFeeCollectorAddress,
        address _zeroStakingAddress,
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _wrbtcAddress,
        address _zsusdTokenAddress,
        address _activePoolAddress
    )
        external
        override
        onlyOwner
    {
        checkContract(_sovTokenAddress);
        checkContract(_sovFeeCollectorAddress);
        checkContract(_zeroStakingAddress);
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_wrbtcAddress);
        checkContract(_zsusdTokenAddress);
        checkContract(_activePoolAddress);
        
        sovToken = IERC20(_sovTokenAddress);
        sovFeeCollector = IFeeSharingProxy(_sovFeeCollectorAddress);
        zeroStaking = IZEROStaking(_zeroStakingAddress);
        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);
        troveManager = ITroveManager(_troveManagerAddress);
        wrbtc = IWrbtc(_wrbtcAddress);
        zsusdToken = IZSUSDToken(_zsusdTokenAddress);
        activePoolAddress = _activePoolAddress;

        FEE_TO_SOV_COLLECTOR = LiquityMath.DECIMAL_PRECISION; // 100%

        emit SOVTokenAddressChanged(_sovTokenAddress);
        emit SOVFeeCollectorAddressChanged(_sovFeeCollectorAddress);
        emit ZeroStakingAddressChanged(_zeroStakingAddress);
        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit WrbtcAddressChanged(_wrbtcAddress);
        emit ZSUSDTokenAddressChanged(_zsusdTokenAddress);
        emit ActivePoolAddressSet(_activePoolAddress);
    }

    function setFeeToSOVCollector(uint FEE_TO_SOV_COLLECTOR_) public onlyOwner {
        FEE_TO_SOV_COLLECTOR = FEE_TO_SOV_COLLECTOR_;
    }

    function distributeFees() public override {
        require(msg.sender == address(borrowerOperations) || msg.sender == address(troveManager),"FeeDistributor: invalid caller");
        uint256 zsusdtoDistribute = zsusdToken.balanceOf(address(this));
        uint256 sovToDistribute = sovToken.balanceOf(address(this)); 
        if(zsusdtoDistribute != 0) {
            distributeZSUSD(zsusdtoDistribute);
        }
        if(sovToDistribute != 0) {
            distributeSOV(sovToDistribute);
        }
    }

    function distributeZSUSD(uint256 toDistribute) internal {
        // Send fee to the SOVFeeCollector address
        uint256 feeToSovCollector = toDistribute.mul(FEE_TO_SOV_COLLECTOR).div(LiquityMath.DECIMAL_PRECISION);
        zsusdToken.approve(address(sovFeeCollector), feeToSovCollector);
        sovFeeCollector.transferTokens(address(zsusdToken), uint96(feeToSovCollector));

        // Send fee to ZERO staking contract
        uint256 feeToZeroStaking = toDistribute.sub(feeToSovCollector);
        zsusdToken.transfer(address(zeroStaking), feeToZeroStaking);
        zeroStaking.increaseF_ZSUSD(feeToZeroStaking);

        emit ZSUSDDistributed(toDistribute);

    }

    function distributeSOV(uint256 toDistribute) internal {
        // Send fee to the SOVFeeCollector address
        uint256 feeToSovCollector = toDistribute.mul(FEE_TO_SOV_COLLECTOR).div(LiquityMath.DECIMAL_PRECISION);
        sovToken.approve(address(sovFeeCollector), feeToSovCollector);
        sovFeeCollector.transferTokens(address(sovToken), uint96(feeToSovCollector));

        // Send the SOV fee to the ZERO staking contract
        uint256 feeToZeroStaking = toDistribute.sub(feeToSovCollector);
        sovToken.transfer(address(zeroStaking), feeToZeroStaking);
        zeroStaking.increaseF_SOV(feeToZeroStaking);

        emit SOVDistributed(toDistribute);
    } 

    function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "FeeDistributor: caller is not ActivePool");
    }

}