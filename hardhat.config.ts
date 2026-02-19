import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";

const privateKey = process.env.DEPLOY_KEY_BASE;
const baseRpcUrl = process.env.BASE_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "";
const baseSepoliaRpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    base: {
      url: baseRpcUrl,
      accounts: privateKey ? [privateKey] : [],
    },
    baseSepolia: {
      url: baseSepoliaRpcUrl,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

export default config;
