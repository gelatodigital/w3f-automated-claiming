// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAirdropDistributor {
    function claim(
        uint256 index,
        address account,
        uint256 totalAmount,
        bytes32[] calldata merkleProof
    ) external;

    function claimed(address account) external view returns (uint256);

    function token() external view returns (IERC20);

    function merkleRoot() external view returns (bytes32);
}
