import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const name = "MockERC20";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network, ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const { deploy } = deployments;

  console.log(`Deploying ${name} to ${network.name}.`);

  const { address } = await deploy(name, {
    from: deployer.address,
    args: ["MockERC20", "MOCK", ethers.utils.parseEther("1000")],
  });

  console.log(`Deployed ${name} at ${address}.`);
};

func.tags = [name];

export default func;
