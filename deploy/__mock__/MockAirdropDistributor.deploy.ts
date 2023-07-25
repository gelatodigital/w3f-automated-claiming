import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const name = "MockAirdropDistributor";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, network, ethers } = hre;
  const [deployer] = await ethers.getSigners();
  const { deploy } = deployments;

  console.log(`Deploying ${name} to ${network.name}.`);

  const token = await deployments.get("MockERC20");

  const claimer = await deploy(name, {
    from: deployer.address,
    args: [token.address],
  });

  console.log(`Deployed ${name} at ${claimer.address}.`);
};

func.tags = [name];
func.dependencies = ["MockERC20"];

export default func;
