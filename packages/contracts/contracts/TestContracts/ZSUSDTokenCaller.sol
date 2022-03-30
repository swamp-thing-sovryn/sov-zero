// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IZSUSDToken.sol";

contract ZSUSDTokenCaller {
    IZSUSDToken ZSUSD;

    function setZSUSD(IZSUSDToken _ZSUSD) external {
        ZSUSD = _ZSUSD;
    }

    function zsusdMint(address _account, uint _amount) external {
        ZSUSD.mint(_account, _amount);
    }

    function zsusdBurn(address _account, uint _amount) external {
        ZSUSD.burn(_account, _amount);
    }

    function zsusdSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        ZSUSD.sendToPool(_sender, _poolAddress, _amount);
    }

    function zsusdReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        ZSUSD.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
