import fs from "fs";
import path from "path";
import hardhat from "hardhat";
const { ethers, network } = hardhat;
import "dotenv/config";

const REQUIRED = [
  "USDC_ADDRESS",
  "CBBTC_ADDRESS",
  "CASE_TOKEN_ADDRESS",
  "BTC_USD_FEED",
  "TREASURY_ADDRESS",
  "VRF_COORDINATOR",
  "VRF_KEY_HASH",
  "VRF_SUBSCRIPTION_ID",
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

function updateEnvFile(envPath: string, updates: Record<string, string>) {
  let contents = "";
  if (fs.existsSync(envPath)) {
    contents = fs.readFileSync(envPath, "utf8");
  }

  const lines = contents.split(/\r?\n/);
  const existing = new Map<string, number>();
  lines.forEach((line, index) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (match) {
      existing.set(match[1], index);
    }
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (existing.has(key)) {
      lines[existing.get(key)!] = `${key}=${value}`;
    } else {
      lines.push(`${key}=${value}`);
    }
  });

  fs.writeFileSync(envPath, lines.join("\n"));
}

async function getFeeOverrides() {
  const maxFeeWei = process.env.DEPLOY_MAX_FEE_WEI;
  if (maxFeeWei) {
    const maxPriorityWei = process.env.DEPLOY_MAX_PRIORITY_FEE_WEI || "1000000";
    return {
      maxFeePerGas: BigInt(maxFeeWei),
      maxPriorityFeePerGas: BigInt(maxPriorityWei),
    };
  }

  const maxFeeGwei = process.env.DEPLOY_MAX_FEE_GWEI;
  if (maxFeeGwei) {
    const maxPriorityGwei = process.env.DEPLOY_MAX_PRIORITY_FEE_GWEI || "1";
    return {
      maxFeePerGas: BigInt(maxFeeGwei) * 1_000_000_000n,
      maxPriorityFeePerGas: BigInt(maxPriorityGwei) * 1_000_000_000n,
    };
  }

  const feeData = await ethers.provider.getFeeData();
  if (feeData.maxFeePerGas) {
    const maxFeePerGas = feeData.maxFeePerGas * 2n;
    const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas ?? 1n) * 2n;
    return { maxFeePerGas, maxPriorityFeePerGas };
  }
  if (feeData.gasPrice) {
    return { gasPrice: feeData.gasPrice * 2n };
  }
  return {};
}

async function main() {
  REQUIRED.forEach(requireEnv);

  const usdc = requireEnv("USDC_ADDRESS");
  const cbbtc = requireEnv("CBBTC_ADDRESS");
  const caseToken = requireEnv("CASE_TOKEN_ADDRESS");
  const btcUsdFeed = requireEnv("BTC_USD_FEED");
  const treasury = requireEnv("TREASURY_ADDRESS");
  const vrfCoordinator = requireEnv("VRF_COORDINATOR");
  const keyHash = requireEnv("VRF_KEY_HASH");
  const subId = BigInt(requireEnv("VRF_SUBSCRIPTION_ID"));

  const confirmations = Number(process.env.VRF_CONFIRMATIONS ?? 3);
  const callbackGasLimit = Number(process.env.VRF_CALLBACK_GAS_LIMIT ?? 250000);
  const rewardToken = process.env.XCASE_REWARD_TOKEN || usdc;

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with: ${deployer.address} on ${network.name}`);

  const overrides = await getFeeOverrides();
  let nonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
  const nextNonce = () => nonce++;

  const XCase = await ethers.getContractFactory("XCase");
  const xCase = await XCase.deploy({ ...overrides, nonce: nextNonce() });
  await xCase.waitForDeployment();

  const CaseStaking = await ethers.getContractFactory("CaseStaking");
  const caseStaking = await CaseStaking.deploy(caseToken, await xCase.getAddress(), { ...overrides, nonce: nextNonce() });
  await caseStaking.waitForDeployment();

  const XCaseStaking = await ethers.getContractFactory("XCaseStaking");
  const xCaseStaking = await XCaseStaking.deploy(await xCase.getAddress(), rewardToken, { ...overrides, nonce: nextNonce() });
  await xCaseStaking.waitForDeployment();

  const CaseSale = await ethers.getContractFactory("CaseSale");
  const caseSale = await CaseSale.deploy(
    usdc,
    cbbtc,
    btcUsdFeed,
    treasury,
    vrfCoordinator,
    keyHash,
    subId,
    confirmations,
    callbackGasLimit,
    { ...overrides, nonce: nextNonce() },
  );
  await caseSale.waitForDeployment();

  await xCase.setMinter(await caseStaking.getAddress(), { ...overrides, nonce: nextNonce() });

  const caseTypeId = Number(process.env.CASE_TYPE_ID ?? 0);
  if (caseTypeId > 0 && process.env.CASE_PRICE_USDC && process.env.CASE_MIN_REWARD_USD && process.env.CASE_MAX_REWARD_USD) {
    const enabled = String(process.env.CASE_ENABLED ?? "true") === "true";
    const positiveReturnBps = Number(process.env.CASE_POSITIVE_RETURN_BPS ?? 0);
    const tx = await caseSale.setCaseType(
      caseTypeId,
      BigInt(process.env.CASE_PRICE_USDC),
      BigInt(process.env.CASE_MIN_REWARD_USD),
      BigInt(process.env.CASE_MAX_REWARD_USD),
      positiveReturnBps,
      enabled,
      { ...overrides, nonce: nextNonce() },
    );
    await tx.wait();
  }

  const deployment = {
    network: network.name,
    xCase: await xCase.getAddress(),
    caseStaking: await caseStaking.getAddress(),
    xCaseStaking: await xCaseStaking.getAddress(),
    caseSale: await caseSale.getAddress(),
  };

  const deploymentDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(deploymentDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentDir, `${network.name}.json`),
    JSON.stringify(deployment, null, 2),
  );

  if (process.env.UPDATE_ENV === "true") {
    const envPath = process.env.DEPLOY_ENV_PATH || ".env";
    updateEnvFile(envPath, {
      NEXT_PUBLIC_CASE_STAKING_ADDRESS: deployment.caseStaking,
      NEXT_PUBLIC_XCASE_ADDRESS: deployment.xCase,
      NEXT_PUBLIC_XCASE_STAKING_ADDRESS: deployment.xCaseStaking,
      NEXT_PUBLIC_CASE_SALE_OR_MANAGER_ADDRESS: deployment.caseSale,
    });
    console.log(`Updated ${envPath}`);
  }

  console.log("Deployed:", deployment);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
