// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAirdropDistributor} from "../interfaces/IAirdropDistributor.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

import {AUTOMATE} from "../constants/Automate.sol";
import {NATIVE_TOKEN} from "../constants/Tokens.sol";

import {Plan} from "./Plan.sol";
import {Mapping} from "./Mapping.sol";
import {AutomateReady} from "../vendor/AutomateReady.sol";

contract Claimer is AutomateReady, Ownable, Pausable {
    using Mapping for Mapping.Map;
    Mapping.Map private _plans;

    event CreatedPlan(bytes32 indexed key, Plan plan);
    event RemovedPlan(bytes32 indexed key, Plan plan);
    event Deposit(address indexed from, uint256 indexed amount);
    event Withdraw(address indexed to, uint256 indexed amount);
    event WithdrawERC20(
        address indexed to,
        IERC20 indexed token,
        uint256 indexed amount
    );
    event Claimed(bytes32 indexed key, uint256 indexed amount, Plan plan);

    // solhint-disable-next-line no-empty-blocks
    constructor() AutomateReady(AUTOMATE, msg.sender) {}

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @notice Create a plan which claims token from an airdrop distributor
     * @param airdrop   airdrop distributor
     * @param recipient rewards recipient
     * @param interval  time between each epoch
     * @param start     plan start time (zero to start immediately)
     */
    // solhint-disable-next-line function-max-lines
    function createPlan(
        IAirdropDistributor airdrop,
        address recipient,
        uint256 interval,
        uint256 start
    ) external onlyOwner {
        require(
            interval >= 60,
            "Claimer.createPlan: must have at least one minute interval"
        );

        require(
            address(airdrop) != address(0),
            "Claimer.createPlan: invalid airdrop distributor"
        );

        // solhint-disable-next-line not-rely-on-time
        uint256 createdAt = block.timestamp;

        if (start == 0)
            // start now
            start = createdAt;
        else {
            // ensure the plan starts either:
            // 1. in the future (or now)
            // 2. no more than one epoch in the past
            //    this allows us to e.g., schedule a plan for every Wednesday which is
            //    created on a Thursday without having to wait 6 days for the first exec
            //    the first exec will be on Thursday and subsequent execs on Wednesday
            require(
                start >= createdAt || createdAt - start < interval,
                "Claimer.createPlan: Start must not be more than one epoch in the past"
            );
        }

        // derive unique identifier key
        // can not use nextExec since it is mutable
        bytes32 key = keccak256(abi.encodePacked(airdrop, recipient, interval));

        Plan memory plan = Plan(airdrop, recipient, interval, start);

        _plans.set(key, plan);
        emit CreatedPlan(key, plan);
    }

    /**
     * @notice Removes a claim plan
     * @param key plan identifier
     */
    function removePlan(bytes32 key) external onlyOwner {
        Plan storage plan = _plans.get(key);
        emit RemovedPlan(key, plan);
        _plans.remove(key);
    }

    function claim(
        bytes32 key,
        uint256 index,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external onlyDedicatedMsgSender whenNotPaused {
        (uint256 fee, address feeToken) = _getFeeDetails();
        _transfer(fee, feeToken);

        Plan storage plan = _plans.get(key);

        // avoid timeslip (block.timestamp is not used)
        // (nextExec - firstExec) % interval == 0
        plan.nextExec += plan.interval;

        plan.airdrop.claim(index, address(this), amount, merkleProof);
        plan.airdrop.token().transfer(plan.recipient, amount);

        emit Claimed(key, amount, plan);
    }

    /**
     * @notice Withdraw native token
     * @param to recipient address
     * @param amount native token amount
     */
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(amount > 0, "Claimer.withdraw: amount must not be zero");

        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Claimer.withdraw: failed to withdraw");

        emit Withdraw(to, amount);
    }

    /**
     * @notice Withdraw ERC20 token
     * @param to recipient address
     * @param token ERC20 token
     * @param amount native token amount
     */
    function withdrawERC20(
        address payable to,
        IERC20 token,
        uint256 amount
    ) external onlyOwner {
        require(amount > 0, "Claimer.withdrawERC20: amount must not be zero");

        require(
            address(token) != address(0),
            "Claimer.withdrawERC20: invalid token"
        );

        require(
            address(token) != NATIVE_TOKEN,
            "Claimer.withdrawERC20: use 'Claimer.withdraw' instead"
        );

        bool sent = token.transfer(to, amount);
        require(sent, "Claimer.withdrawERC20: failed to withdraw");

        emit WithdrawERC20(to, token, amount);
    }

    /**
     * @notice Pause claiming
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause claiming
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Get a claim plan
     * @param key plan identifier
     * @return plan respective claim plan
     */
    function getPlan(bytes32 key) external view returns (Plan memory) {
        return _plans.get(key);
    }

    /**
     * @notice Get all claim plans
     * @return plans key value pairs of keys and plans
     */
    function getPlans() external view returns (Mapping.Pair[] memory) {
        return _plans.all();
    }
}
