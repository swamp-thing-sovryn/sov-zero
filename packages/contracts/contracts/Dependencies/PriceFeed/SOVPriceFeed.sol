// SPDX-License-Identifier: MIT
pragma solidity 0.6.11;

import "./IExternalPriceFeed.sol";


/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 *
 * @dev https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/20e718e843e4c0ffe844c8f5bb433e516e3047b5/contracts/connectors/loantoken/interfaces/FeedsLike.sol#L8
 */
interface FeedsLike {
	function queryRate(address sourceTokenAddress, address destTokenAddress) external view returns (uint256 rate, uint256 precision);
}

contract SOVPriceFeed is IExternalPriceFeed {
    FeedsLike immutable sovPriceFeed;
    address public immutable sovAddress;
    address public immutable xUSDAddress;


    constructor(address _sovPriceFeed, address _sovAddress, address _xUSDAddress) public {
        sovPriceFeed = FeedsLike(_sovPriceFeed);
        sovAddress = _sovAddress;
        xUSDAddress = _xUSDAddress;
    }

    function latestAnswer() external view override returns (uint256, bool) {
        (uint256 rate, uint256 precision) = sovPriceFeed.queryRate(sovAddress, xUSDAddress);
        return (rate, true);
    }
}
