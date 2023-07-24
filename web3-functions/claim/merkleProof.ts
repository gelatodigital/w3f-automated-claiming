import ky from "ky";
import { GEARBOX_AIRDROP_ADDRESS, GEARBOX_MERKLE_API } from "./constants";

interface IClaim {
  index: number;
  amount: string;
  proof: [string];
}

interface IGearboxMerkle {
  claims: {
    [key: string]: IClaim;
  };
}

interface IAccountToClaim {
  (account: string, root: string): Promise<IClaim | null>;
}

/**
 * This is modular
 * One can easily add new handlers to claim other airdrops
 */

const gearbox: IAccountToClaim = async (account, root) => {
  const merkle: IGearboxMerkle = await ky
    .get(`${GEARBOX_MERKLE_API}/mainnet_${root.substring(2)}.json`)
    .json();

  return merkle.claims[account] || null;
};

const handlers: { [key: string]: IAccountToClaim } = {
  [GEARBOX_AIRDROP_ADDRESS]: gearbox,
};

export default handlers;
