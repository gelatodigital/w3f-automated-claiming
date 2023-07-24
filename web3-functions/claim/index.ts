import { ethers } from "ethers";
import { Claimer, IAirdropDistributor } from "../../typechain";

import verifyUserArgs from "./verifyUserArgs";
import merkleProof from "./merkleProof";

import { abi as claimerAbi } from "../../artifacts/contracts/Claimer/Claimer.sol/Claimer.json";
import { abi as airdropAbi } from "../../artifacts/contracts/interfaces/IAirdropDistributor.sol/IAirdropDistributor.json";

import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";

/**
 * One claim is executed per run
 * This prevents the task from exceeding request limits
 * Two plans with one minute intervals can starve others
 * This can be avoided by randomising the executable plans
 * The tradeoff is no strict sequential ordering
 */

Web3Function.onRun(async (context: Web3FunctionContext) => {
  const { userArgs, multiChainProvider } = context;
  const { contractAddress } = verifyUserArgs(userArgs);

  const provider = multiChainProvider.default();
  const claimer = new ethers.Contract(
    contractAddress,
    claimerAbi,
    provider
  ) as Claimer;

  const plans = await claimer.getPlans();
  if (plans.length === 0) return { canExec: false, message: "No claim plans" };

  const plan = plans.reduce((a, b) =>
    a.value.nextExec < b.value.nextExec ? a : b
  );

  const { timestamp } = await provider.getBlock("latest");

  if (plan.value.nextExec.toBigInt() > timestamp)
    return { canExec: false, message: "No claims executable" };

  if (!merkleProof[plan.value.airdrop])
    return { canExec: false, message: "Airdrop distributor not supported" };

  const airdrop = new ethers.Contract(
    plan.value.airdrop,
    airdropAbi,
    provider
  ) as IAirdropDistributor;

  const claim = await merkleProof[plan.value.airdrop](
    contractAddress,
    await airdrop.merkleRoot()
  );

  if (!claim)
    return { canExec: false, message: `Invalid claim for for: ${plan.key}` };

  const tx = await claimer.populateTransaction.claim(
    plan.key,
    claim.index,
    claim.amount,
    claim.proof
  );

  if (!tx.to || !tx.data)
    return { canExec: false, message: "Invalid transaction" };

  return {
    canExec: true,
    callData: [{ to: tx.to, data: tx.data }],
  };
});
