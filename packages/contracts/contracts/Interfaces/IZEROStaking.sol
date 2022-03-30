// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface IZEROStaking {

    // --- Events --
    
    event ZEROTokenAddressSet(address _zeroTokenAddress);
    event ZSUSDTokenAddressSet(address _zsusdTokenAddress);
    event FeeDistributorAddressAddressSet(address _feeDistributorAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    event StakeChanged(address indexed staker, uint newStake);
    event StakingGainsWithdrawn(address indexed staker, uint ZSUSDGain, uint SOVGain);
    event F_SOVUpdated(uint _F_SOV);
    event F_ZSUSDUpdated(uint _F_ZSUSD);
    event TotalZEROStakedUpdated(uint _totalZEROStaked);

    event StakerSnapshotsUpdated(address _staker, uint _F_SOV, uint _F_ZSUSD);

    // --- Functions ---
    
    /**
     * @notice Called only once on init, to set addresses of other Liquity contracts. Callable only by owner
     * @dev initializer function, checks addresses are contracts
      * @param _sovTokenAddress SOVToken contract address
     * @param _zeroTokenAddress ZEROToken contract address
     * @param _zsusdTokenAddress ZSUSDToken contract address
     * @param _feeDistributorAddress FeeDistributorAddress contract address
     * @param _activePoolAddress ActivePool contract address
     */
    function setAddresses
    (
        address _sovTokenAddress,
        address _zeroTokenAddress,
        address _zsusdTokenAddress,
        address _feeDistributorAddress, 
        address _activePoolAddress
    )  external;

    /// @notice If caller has a pre-existing stake, send any accumulated SOV and ZSUSD gains to them.
    /// @param _ZEROamount ZERO tokens to stake 
    function stake(uint _ZEROamount) external;

    /**
     * @notice Unstake the ZERO and send the it back to the caller, along with their accumulated ZSUSD & SOV gains. 
     * If requested amount > stake, send their entire stake.
     * @param _ZEROamount ZERO tokens to unstake
     */
    function unstake(uint _ZEROamount) external;

    /// @param _SOVFee SOV fee
    /// @notice increase SOV fee
    function increaseF_SOV(uint _SOVFee) external; 

    /// @param _ZEROFee ZSUSD fee
    /// @notice increase ZSUSD fee
    function increaseF_ZSUSD(uint _ZEROFee) external;  

    /// @param _user user address
    /// @return pending SOV gain of given user
    function getPendingSOVGain(address _user) external view returns (uint);

    /// @param _user user address
    /// @return pending ZSUSD gain of given user
    function getPendingZSUSDGain(address _user) external view returns (uint);
}
