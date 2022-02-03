// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Dependencies/BaseMath.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Dependencies/console.sol";
import "../Interfaces/IZEROToken.sol";
import "../Interfaces/IZEROStaking.sol";
import "../Dependencies/LiquityMath.sol";
import "../Interfaces/IZUSDToken.sol";
import "./ZEROStakingStorage.sol";

contract ZEROStaking is ZEROStakingStorage, IZEROStaking, CheckContract, BaseMath {
    using SafeMath for uint;

    // --- Events ---

    event SOVTokenAddressSet(address _sovTokenAddress);
    event ZEROTokenAddressSet(address _zeroTokenAddress);
    event ZUSDTokenAddressSet(address _zusdTokenAddress);
    event FeeDistributorAddressSet(address _feeDistributorAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    event StakeChanged(address indexed staker, uint newStake);
    event StakingGainsWithdrawn(address indexed staker, uint ZUSDGain, uint SOVGain);
    event F_SOVUpdated(uint _F_SOV);
    event F_ZUSDUpdated(uint _F_ZUSD);
    event TotalZEROStakedUpdated(uint _totalZEROStaked);
    event StakerSnapshotsUpdated(address _staker, uint _F_SOV, uint _F_ZUSD);

    // --- Functions ---

    function setAddresses
    (
        address _sovTokenAddress,
        address _zeroTokenAddress,
        address _zusdTokenAddress,
        address _feeDistributorAddress, 
        address _activePoolAddress
    ) 
        external 
        onlyOwner 
        override 
    {
        CheckContract(_sovTokenAddress);
        checkContract(_zeroTokenAddress);
        checkContract(_zusdTokenAddress);
        checkContract(_feeDistributorAddress);
        checkContract(_activePoolAddress);

        sovToken = IERC20(_sovTokenAddress);
        zeroToken = IZEROToken(_zeroTokenAddress);
        zusdToken = IZUSDToken(_zusdTokenAddress);
        feeDistributorAddress = _feeDistributorAddress;
        activePoolAddress = _activePoolAddress;

        emit SOVTokenAddressSet(_sovTokenAddress);
        emit ZEROTokenAddressSet(_zeroTokenAddress);
        emit ZEROTokenAddressSet(_zusdTokenAddress);
        emit FeeDistributorAddressSet(_feeDistributorAddress);
        emit ActivePoolAddressSet(_activePoolAddress);

        
    }

    // If caller has a pre-existing stake, send any accumulated SOV and ZUSD gains to them. 
    function stake(uint _ZEROamount) external override {
        _requireNonZeroAmount(_ZEROamount);

        uint currentStake = stakes[msg.sender];

        uint SOVGain;
        uint ZUSDGain;
        // Grab any accumulated SOV and ZUSD gains from the current stake
        if (currentStake != 0) {
            SOVGain = _getPendingSOVGain(msg.sender);
            ZUSDGain = _getPendingZUSDGain(msg.sender);
        }
    
       _updateUserSnapshots(msg.sender);

        uint newStake = currentStake.add(_ZEROamount);

        // Increase user’s stake and total ZERO staked
        stakes[msg.sender] = newStake;
        totalZEROStaked = totalZEROStaked.add(_ZEROamount);
        emit TotalZEROStakedUpdated(totalZEROStaked);

        // Transfer ZERO from caller to this contract
        zeroToken.sendToZEROStaking(msg.sender, _ZEROamount);

        emit StakeChanged(msg.sender, newStake);
        emit StakingGainsWithdrawn(msg.sender, ZUSDGain, SOVGain);

         // Send accumulated ZUSD and SOV gains to the caller
        if (currentStake != 0) {
            zusdToken.transfer(msg.sender, ZUSDGain);
            sovToken.transfer(msg.sender, SOVGain);
        }
    }

    /// Unstake the ZERO and send the it back to the caller, along with their accumulated ZUSD & SOV gains. 
    /// If requested amount > stake, send their entire stake.
    function unstake(uint _ZEROamount) external override {
        uint currentStake = stakes[msg.sender];
        _requireUserHasStake(currentStake);

        // Grab any accumulated SOV and ZUSD gains from the current stake
        uint SOVGain = _getPendingSOVGain(msg.sender);
        uint ZUSDGain = _getPendingZUSDGain(msg.sender);
        
        _updateUserSnapshots(msg.sender);

        if (_ZEROamount > 0) {
            uint ZEROToWithdraw = LiquityMath._min(_ZEROamount, currentStake);

            uint newStake = currentStake.sub(ZEROToWithdraw);

            // Decrease user's stake and total ZERO staked
            stakes[msg.sender] = newStake;
            totalZEROStaked = totalZEROStaked.sub(ZEROToWithdraw);
            emit TotalZEROStakedUpdated(totalZEROStaked);

            // Transfer unstaked ZERO to user
            zeroToken.transfer(msg.sender, ZEROToWithdraw);

            emit StakeChanged(msg.sender, newStake);
        }

        emit StakingGainsWithdrawn(msg.sender, ZUSDGain, SOVGain);

        // Send accumulated ZUSD and SOV gains to the caller
        zusdToken.transfer(msg.sender, ZUSDGain);
        sovToken.transfer(msg.sender, SOVGain);
    }

    // --- Reward-per-unit-staked increase functions. Called by Liquity core contracts ---

    function increaseF_SOV(uint _SOVFee) external override {
        _requireCallerIsFeeDistributor();
        uint SOVFeePerZEROStaked;
     
        if (totalZEROStaked > 0) {SOVFeePerZEROStaked = _SOVFee.mul(DECIMAL_PRECISION).div(totalZEROStaked);}

        F_SOV = F_SOV.add(SOVFeePerZEROStaked); 
        emit F_SOVUpdated(F_SOV);
    }

    function increaseF_ZUSD(uint _ZUSDFee) external override {
        _requireCallerIsFeeDistributor();
        uint ZUSDFeePerZEROStaked;
        
        if (totalZEROStaked > 0) {ZUSDFeePerZEROStaked = _ZUSDFee.mul(DECIMAL_PRECISION).div(totalZEROStaked);}
        
        F_ZUSD = F_ZUSD.add(ZUSDFeePerZEROStaked);
        emit F_ZUSDUpdated(F_ZUSD);
    }

    // --- Pending reward functions ---

    function getPendingSOVGain(address _user) external view override returns (uint) {
        return _getPendingSOVGain(_user);
    }

    function _getPendingSOVGain(address _user) internal view returns (uint) {
        uint F_SOV_Snapshot = snapshots[_user].F_SOV_Snapshot;
        uint SOVGain = stakes[_user].mul(F_SOV.sub(F_SOV_Snapshot)).div(DECIMAL_PRECISION);
        return SOVGain;
    }

    function getPendingZUSDGain(address _user) external view override returns (uint) {
        return _getPendingZUSDGain(_user);
    }

    function _getPendingZUSDGain(address _user) internal view returns (uint) {
        uint F_ZUSD_Snapshot = snapshots[_user].F_ZUSD_Snapshot;
        uint ZUSDGain = stakes[_user].mul(F_ZUSD.sub(F_ZUSD_Snapshot)).div(DECIMAL_PRECISION);
        return ZUSDGain;
    }

    // --- Internal helper functions ---

    function _updateUserSnapshots(address _user) internal {
        snapshots[_user].F_SOV_Snapshot = F_SOV;
        snapshots[_user].F_ZUSD_Snapshot = F_ZUSD;
        emit StakerSnapshotsUpdated(_user, F_SOV, F_ZUSD);
    }

    // --- 'require' functions ---

    function _requireCallerIsFeeDistributor() internal view {
        require(msg.sender == feeDistributorAddress, "ZEROStaking: caller is not FeeDistributor");
    }

     function _requireCallerIsActivePool() internal view {
        require(msg.sender == activePoolAddress, "ZEROStaking: caller is not ActivePool");
    }

    function _requireUserHasStake(uint currentStake) internal pure {  
        require(currentStake > 0, 'ZEROStaking: User must have a non-zero stake');  
    }

    function _requireNonZeroAmount(uint _amount) internal pure {
        require(_amount > 0, 'ZEROStaking: Amount must be non-zero');
    }

    receive() external payable {
        _requireCallerIsFeeDistributor();
    }
}
