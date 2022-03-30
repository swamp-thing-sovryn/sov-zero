// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../ActivePool.sol";

contract ActivePoolTester is ActivePool {
    
    function unprotectedIncreaseZSUSDDebt(uint _amount) external {
        ZSUSDDebt  = ZSUSDDebt.add(_amount);
    }
}
