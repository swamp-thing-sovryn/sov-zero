// SPDX-License-Identifier: MIT
pragma solidity 0.6.11;

import "../Dependencies/ERC20.sol";

contract SOVTokenTester is ERC20 {

    constructor() ERC20("Sovryn Token", "SOV", 18) public {
        _mint(msg.sender, 1000000e30);
    }
}