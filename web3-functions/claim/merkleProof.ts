import { GEARBOX_AIRDROP_ADDRESS, GEARBOX_MERKLE_API } from "./constants";
import ky from "ky";

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

const MOCK_AIRDROP_ADDRESS = "0x941d931D56c7606f750Be057A48426B9F261fCF1";

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

const mock: IAccountToClaim = async () => {
  return {
    index: 0,
    amount: "500000000000000000000",
    proof: [
      "0x5e3a6a44ef353a44875b713c87bdec6756040866e00f024ee5ddbe836a037e97",
    ],
  };
};

const handlers: { [key: string]: IAccountToClaim } = {
  [GEARBOX_AIRDROP_ADDRESS]: gearbox,
  [MOCK_AIRDROP_ADDRESS]: mock,
};

export default handlers;
