// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../DefaultPool.sol";

contract DefaultPoolTester is DefaultPool {
    
    function unprotectedIncreaseZSUSDDebt(uint _amount) external {
        ZSUSDDebt  = ZSUSDDebt.add(_amount);
    }
}
