// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.21;

import {IAirdropDistributor} from "../interfaces/IAirdropDistributor.sol";

struct Plan {
    IAirdropDistributor airdrop;
    address recipient;
    uint256 interval;
    uint256 nextExec;
}
