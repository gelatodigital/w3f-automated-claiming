import { deployments, ethers, w3f } from "hardhat";
import {
  AutomateSDK,
  TriggerConfig,
  TriggerType,
} from "@gelatonetwork/automate-sdk";

const main = async () => {
  // deploy W3F to IPFS
  console.log("Deploying W3F to IPFS.");

  const claimW3f = w3f.get("claim");
  const cid = await claimW3f.deploy();

  console.log(`Deployed W3F hash ${cid}.`);

  // create W3F task
  console.log("Creating W3F task.");

  const claimer = await deployments.get("Claimer");
  const [deployer] = await ethers.getSigners();
  const chainId = await deployer.getChainId();

  const automate = new AutomateSDK(chainId, deployer);

  const trigger: TriggerConfig = {
    type: TriggerType.TIME,
    interval: 30 * 60 * 1000, // 30 minutes
  };

  const { taskId, tx } = await automate.createBatchExecTask({
    name: "Automated Claiming",
    web3FunctionHash: cid,
    web3FunctionArgs: {
      contractAddress: claimer.address,
    },
    useTreasury: false,
    trigger,
  });

  await tx.wait();
  console.log(
    `Created W3F task: https://beta.app.gelato.network/task/${taskId}?chainId=${chainId}`
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
