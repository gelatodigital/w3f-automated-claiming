# Web3 Function Automated Airdrop Claiming

This project demonstrates automated airdrop claiming with configurable plans stored on-chain.
The plans are periodically executed with off-chain data by a Web3 Function when user-defined criteria are met.

## Creating a plan

Plans can be added using `createPlan` with the following arguments:

- Airdrop Distributor
- Recipient (rewards recipient)
- Interval (Between executions in seconds)
- Start (Starting timestamp)

> [!NOTE]
> Plans can be scheduled in advance by specifying a starting timestamp out in the future.

Plans are identified by a `bytes32` key which is derived by [hashing its attributes](https://github.com/gelatodigital/w3f-automated-claiming/blob/main/contracts/Claimer/Claimer.sol#L84).  
This implicitly prevents the creation of duplicate plans.

## Removing a plan

Plan can be removed using `removePlan` specified by their unique `bytes32` identifier key.

## Claiming

The Web3 Function will periodically fetch all plans from the contract.
Once it finds a plan scheduled for execution, it fetches the current Merkle root and corresponding proof by performing off-chain computation.
The operation is protocol specific and is defined in [merkleProof](https://github.com/gelatodigital/w3f-automated-claiming/blob/main/web3-functions/claim/merkleProof.ts).
Handlers are modular by design to allow for easy implementation/support of additional protocols.

The Web3 Function claims at most one airdrop per run preventing it from exceeding request/resource limits.
This does however allow plans with short intervals to starve others since iterating the plans array sequentially introduces bias (Plans at the start will always be evaluated first).
This can be avoided by randomising the executable plans but the tradeoff is losing strict sequential ordering.

## Deployment

> [!WARNING]
> Contracts are not audited by a third party. Please use at your own discretion.

1. Install dependencies
   ```
   yarn install
   ```
2. Compile smart contracts
   ```
   yarn run hardhat compile
   ```
3. Edit `.env`
   ```
   cp .env.example .env
   ```
4. Deploy contracts
   ```
   yarn run hardhat deploy --tags Claimer --network ethereum
   ```
5. Deploy the W3F to IPFS and create a W3F task
   ```
   yarn run hardhat run scripts/w3f-deploy-and-create-task.ts --network ethereum
   ```
6. Verify contracts on Etherscan (Optional)
   ```
   yarn run hardhat etherscan-verify --network ethereum
   ```
7. Deposit `ETH` into `Claimer` contract for fee payment
