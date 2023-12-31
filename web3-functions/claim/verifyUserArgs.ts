import { Web3FunctionUserArgs } from "@gelatonetwork/web3-functions-sdk";
import { ethers } from "ethers";

interface IUserArgs {
  contractAddress: string;
}

const verifyUserArgs = (args: Web3FunctionUserArgs): IUserArgs => {
  const contractAddress = args.contractAddress as string;
  if (!ethers.utils.isAddress(contractAddress))
    throw "verifyUserArgs: invalid contract address";

  return { contractAddress };
};

export default verifyUserArgs;
