// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAirdropDistributor} from "../interfaces/IAirdropDistributor.sol";

contract MockAirdropDistributor is IAirdropDistributor {
    IERC20 public token;

    constructor(IERC20 _token) {
        token = _token;
    }

    function claim(
        uint256,
        address account,
        uint256 totalAmount,
        bytes32[] calldata
    ) external {
        token.transfer(account, totalAmount);
    }

    function merkleRoot() external pure returns (bytes32) {
        return
            0x2974f96a03211428ce89eb022b2b1e34f74ce7feccd2726f487c75c85bc983dc;
    }
}
