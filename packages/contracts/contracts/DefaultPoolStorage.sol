// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/IERC20.sol";

contract DefaultPoolStorage is Ownable {
    string constant public NAME = "DefaultPool";

    IERC20 public sovToken;

    address public troveManagerAddress;
    address public activePoolAddress;
    uint256 internal ZSUSDDebt;  // debt
}
