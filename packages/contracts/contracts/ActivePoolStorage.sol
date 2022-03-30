// SPDX-License-Identifier: MIT
pragma solidity 0.6.11;

import "./Dependencies/Ownable.sol";
import "./Dependencies/IERC20.sol";

/**
 * @title Active Pool Storage
 * @dev Stores Active Pool required addresses and internal SOV and ZUSD debt states
 * Extends Ownable
 */
contract ActivePoolStorage is Ownable {
    string public constant NAME = "ActivePool";

    IERC20 public sovToken;

    address public borrowerOperationsAddress;
    address public troveManagerAddress;
    address public stabilityPoolAddress;
    address public defaultPoolAddress;
    uint256 internal ZUSDDebt;
}
