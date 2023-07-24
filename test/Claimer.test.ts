import { Web3FunctionHardhat } from "@gelatonetwork/web3-functions-sdk/hardhat-plugin";
import { ModuleDataStruct } from "../typechain/contracts/vendor/Types.sol/IAutomate";
import { setBalance, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployments, ethers, w3f, getNamedAccounts } from "hardhat";
import { GELATO_ADDRESSES } from "@gelatonetwork/automate-sdk";
import {
  Claimer,
  IERC20,
  IAirdropDistributor,
  IAutomate,
  IOpsProxy,
} from "../typechain";
import { expect, assert } from "chai";

import {
  Web3FunctionUserArgs,
  Web3FunctionResultV2,
  Web3FunctionResultCallData,
} from "@gelatonetwork/web3-functions-sdk";

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

    const { gelato: gelatoAddress } = await getNamedAccounts();
    const gelato = await ethers.getSigner(gelatoAddress);

    const { deployer: deployerAddress } = await getNamedAccounts();
    const deployer = await ethers.getSigner(deployerAddress);

    automate = (await ethers.getContractAt(
      "IAutomate",
      GELATO_ADDRESSES[1].automate,
      gelato
    )) as IAutomate;

    const { address: airdropAddress } = await deployments.get(
      "MockAirdropDistributor"
    );

    airdrop = (await ethers.getContractAt(
      "MockAirdropDistributor",
      airdropAddress
    )) as IAirdropDistributor;

    const token = (await ethers.getContractAt(
      "IERC20",
      await airdrop.token()
    )) as IERC20;

    await token.transfer(
      airdrop.address,
      await token.balanceOf(deployerAddress)
    );

    const { address: claimerAddress } = await deployments.get("Claimer");

    claimer = (await ethers.getContractAt(
      "Claimer",
      claimerAddress
    )) as Claimer;

    const moduleData = getModuleData();
    const proxyAddress = await claimer.dedicatedMsgSender();

    await automate
      .connect(deployer)
      .createTask(proxyAddress, "0xc0e8c0c2", moduleData, NATIVE_TOKEN);

    await setBalance(claimerAddress, ethers.utils.parseEther("10"));

    userArgs = {
      contractAddress: claimerAddress,
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

    const { deployer } = await getNamedAccounts();

    return automate.exec(
      deployer,
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

  it("Briber.execBribe: ExecutedBribe", async () => {
    await time.increase(100);

    const exec = await claimW3f.run({ userArgs });
    const res = exec.result as Web3FunctionResultV2;

    if (!res.canExec) assert.fail(res.message);
    await expect(execSyncFee(res.callData[0])).to.emit(claimer, "Claimed");
  });

  it("Briber.removePlan: RemovedPlan", async () => {
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
