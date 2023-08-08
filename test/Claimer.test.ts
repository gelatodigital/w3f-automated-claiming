import { Web3FunctionHardhat } from "@gelatonetwork/web3-functions-sdk/hardhat-plugin";
import { ModuleDataStruct } from "../typechain/contracts/vendor/Types.sol/IAutomate";
import { deployments, ethers, w3f } from "hardhat";
import { GELATO_ADDRESSES } from "@gelatonetwork/automate-sdk";
import { expect, assert } from "chai";
import {
  setBalance,
  setCode,
  setStorageAt,
  time,
} from "@nomicfoundation/hardhat-network-helpers";
import {
  Claimer,
  IAirdropDistributor,
  IAutomate,
  IOpsProxy,
} from "../typechain";
import {
  Web3FunctionUserArgs,
  Web3FunctionResultV2,
  Web3FunctionResultCallData,
} from "@gelatonetwork/web3-functions-sdk";
import { GEARBOX_AIRDROP_ADDRESS } from "../web3-functions/claim/constants";

const MULTISIG_ADDRESS = "0xc38c5f97B34E175FFd35407fc91a937300E33860";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

describe("Claimer", () => {
  let claimer: Claimer;
  let airdrop: IAirdropDistributor;
  let automate: IAutomate;
  let claimW3f: Web3FunctionHardhat;
  let userArgs: Web3FunctionUserArgs;
  let cid: string;

  before(async () => {
    await deployments.fixture();

    claimW3f = w3f.get("claim");
    cid = await claimW3f.deploy();

    const gelato = await ethers.getImpersonatedSigner(
      "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6"
    );
    const [deployer] = await ethers.getSigners();

    automate = (await ethers.getContractAt(
      "IAutomate",
      GELATO_ADDRESSES[1].automate,
      gelato
    )) as IAutomate;

    airdrop = (await ethers.getContractAt(
      "IAirdropDistributor",
      GEARBOX_AIRDROP_ADDRESS
    )) as IAirdropDistributor;

    const { address: claimerAddress } = await deployments.get("Claimer");

    await setCode(
      MULTISIG_ADDRESS,
      await ethers.provider.getCode(claimerAddress)
    );

    for (let i = 0; i < 100; i++) {
      const value = await ethers.provider.getStorageAt(claimerAddress, i);
      await setStorageAt(MULTISIG_ADDRESS, i, value);
    }

    claimer = (await ethers.getContractAt(
      "Claimer",
      MULTISIG_ADDRESS
    )) as Claimer;

    const moduleData = getModuleData();
    const proxyAddress = await claimer.dedicatedMsgSender();

    console.log(proxyAddress);

    await automate
      .connect(deployer)
      .createTask(proxyAddress, "0xc0e8c0c2", moduleData, NATIVE_TOKEN);

    await setBalance(MULTISIG_ADDRESS, ethers.utils.parseEther("10"));

    userArgs = {
      contractAddress: MULTISIG_ADDRESS,
    };
  });

  const getModuleData = () => {
    const web3FunctionArgsHex = ethers.utils.defaultAbiCoder.encode(
      ["string"],
      [claimer.address.toLowerCase()]
    );

    const moduleData: ModuleDataStruct = {
      modules: [2, 4],
      args: [
        "0x",
        ethers.utils.defaultAbiCoder.encode(
          ["string", "bytes"],
          [cid, web3FunctionArgsHex]
        ),
      ],
    };

    return moduleData;
  };

  const execSyncFee = async (callData: Web3FunctionResultCallData) => {
    const moduleData = getModuleData();

    const proxyAddress = await claimer.dedicatedMsgSender();
    const proxy = (await ethers.getContractAt(
      "IOpsProxy",
      proxyAddress
    )) as IOpsProxy;

    const batchExecCall = await proxy.populateTransaction.batchExecuteCall(
      [callData.to],
      [callData.data],
      [callData.value || 0]
    );

    if (!batchExecCall.to || !batchExecCall.data)
      assert.fail("Invalid transaction");

    const [deployer] = await ethers.getSigners();

    return automate.exec(
      deployer.address,
      batchExecCall.to,
      batchExecCall.data,
      moduleData,
      ethers.utils.parseEther("0.01"),
      NATIVE_TOKEN,
      false,
      true
    );
  };

  it("No claim plans", async () => {
    const exec = await claimW3f.run({ userArgs });
    const res = exec.result as Web3FunctionResultV2;

    if (res.canExec) assert.fail("canExec: true");
    else expect(res.message).to.equal("No claim plans");
  });

  it("Claimer.createPlan: CreatedPlan", async () => {
    await expect(
      claimer.createPlan(airdrop.address, claimer.address, 100, 0)
    ).to.emit(claimer, "CreatedPlan");
  });

  it("Claimer: Claimed", async () => {
    const exec = await claimW3f.run({ userArgs });
    const res = exec.result as Web3FunctionResultV2;

    if (!res.canExec) assert.fail(res.message);

    await expect(execSyncFee(res.callData[0])).to.emit(claimer, "Claimed");
  });

  it("No claims executable", async () => {
    const exec = await claimW3f.run({ userArgs });
    const res = exec.result as Web3FunctionResultV2;

    if (res.canExec) assert.fail("canExec: true");
    else expect(res.message).to.equal("No claims executable");
  });

  it("Claimer: Nothing to claim", async () => {
    await time.increase(100);

    const exec = await claimW3f.run({ userArgs });
    const res = exec.result as Web3FunctionResultV2;

    if (!res.canExec) assert.fail(res.message);
    await expect(execSyncFee(res.callData[0])).to.revertedWith(
      "Automate.exec: OpsProxy.executeCall: MerkleDistributor: Nothing to claim"
    );
  });

  it("Claimer.removePlan: RemovedPlan", async () => {
    const plans = await claimer.getPlans();

    expect(plans.length).to.equal(1);
    await expect(claimer.removePlan(plans[0].key)).to.emit(
      claimer,
      "RemovedPlan"
    );
  });

  it("No claim plans", async () => {
    const exec = await claimW3f.run({ userArgs });
    const res = exec.result as Web3FunctionResultV2;

    if (res.canExec) assert.fail("canExec: true");
    else expect(res.message).to.equal("No claim plans");
  });
});
