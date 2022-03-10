// SPDX-License-Identifier: MIT
pragma solidity 0.6.11;

import "./IExternalPriceFeed.sol";


/// @dev See https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/7129d9761a1d7295d21b5710a9146535a0ca6c1a/contracts/feeds/PriceFeedV1PoolOracle.sol#L16
interface IPriceFeedsExt {
	function latestAnswer() external view returns (uint256);
}

contract MoCMedianizer is IExternalPriceFeed {
    IPriceFeedsExt priceFeedV1PoolOracle;

    constructor(address _priceFeedV1PoolOracle) public {
        priceFeedV1PoolOracle = IPriceFeedsExt(_priceFeedV1PoolOracle);
    }

    function latestAnswer() external view override returns (uint256, bool) {
        return (priceFeedV1PoolOracle.latestAnswer(), true);
    }
}
