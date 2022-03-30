// SPDX-License-Identifier: MIT
pragma solidity 0.6.11;

import "../Dependencies/ERC20.sol";
import "../Interfaces/IApproveAndCall.sol";

contract SOVTokenTester is ERC20 {

    constructor() ERC20("Sovryn Token", "SOV", 18) public {
        _mint(msg.sender, 1000000e30);
    }

    /**
	 * @notice Approves and then calls the receiving contract.
	 * Useful to encapsulate sending tokens to a contract in one call.
	 * Solidity has no native way to send tokens to contracts.
	 * ERC-20 tokens require approval to be spent by third parties, such as a contract in this case.
	 * @param _spender The contract address to spend the tokens.
	 * @param _amount The amount of tokens to be sent.
	 * @param _data Parameters for the contract call, such as endpoint signature.
	 * */
	function approveAndCall(
		address _spender,
		uint256 _amount,
		bytes memory _data
	) public {
		approve(_spender, _amount);
		IApproveAndCall(_spender).receiveApproval(msg.sender, _amount, address(this), _data);
	}
}