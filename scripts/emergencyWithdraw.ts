import hardhat from "hardhat";
import "dotenv/config";

const { ethers, network } = hardhat;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

async function main() {
  const contractAddress = requireEnv("WITHDRAW_CONTRACT");
  const tokenAddress = requireEnv("WITHDRAW_TOKEN");
  const recipient = requireEnv("WITHDRAW_TO");
  const amountRaw = process.env.WITHDRAW_AMOUNT ?? "0";

  const amount = BigInt(amountRaw);

  const [deployer] = await ethers.getSigners();
  console.log(`Withdrawing on ${network.name} as ${deployer.address}`);

  const caseSale = await ethers.getContractAt("CaseSale", contractAddress);
  const tx = await caseSale.emergencyWithdraw(tokenAddress, recipient, amount);
  console.log(`Submitted tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt?.blockNumber}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
