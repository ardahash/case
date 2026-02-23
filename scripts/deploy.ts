import fs from "fs";
import path from "path";
import hardhat from "hardhat";
const { ethers, network } = hardhat;
import "dotenv/config";

const REQUIRED = ["BTC_USD_FEED", "TREASURY_ADDRESS"];

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] || (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(`Missing env var: ${name}${fallback ? ` (or ${fallback})` : ""}`);
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
  REQUIRED.forEach((name) => requireEnv(name));

  const usdc = requireEnv("USDC_ADDRESS", "NEXT_PUBLIC_USDC_ADDRESS");
  const cbbtc = requireEnv("CBBTC_ADDRESS", "NEXT_PUBLIC_CBBTC_ADDRESS");
  const caseToken = requireEnv("CASE_TOKEN_ADDRESS", "NEXT_PUBLIC_CASE_TOKEN_ADDRESS");
  const btcUsdFeed = requireEnv("BTC_USD_FEED");
  const treasury = requireEnv("TREASURY_ADDRESS");
  const rewardToken = process.env.XCASE_REWARD_TOKEN || usdc;
  const dailyCaseTypeId = Number(process.env.DAILY_CASE_TYPE_ID ?? 0);
  const dailyCooldownSeconds = Number(process.env.DAILY_CASE_COOLDOWN_SECONDS ?? 86400);
  const dailyCaseCaseBps = Number(process.env.DAILY_CASE_CASE_BPS ?? 0);
  const dailyCaseCaseMin = BigInt(process.env.DAILY_CASE_CASE_MIN ?? "0");
  const dailyCaseCaseMax = BigInt(process.env.DAILY_CASE_CASE_MAX ?? "0");
  const dailyCaseCbBtcMin = BigInt(process.env.DAILY_CASE_CBBTC_MIN ?? "0");
  const dailyCaseCbBtcMax = BigInt(process.env.DAILY_CASE_CBBTC_MAX ?? "0");

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

  const BasedRoomRewards = await ethers.getContractFactory("BasedRoomRewards");
  const basedRoomRewards = await BasedRoomRewards.deploy(
    cbbtc,
    await xCase.getAddress(),
    await xCaseStaking.getAddress(),
    { ...overrides, nonce: nextNonce() },
  );
  await basedRoomRewards.waitForDeployment();

  const CaseSale = await ethers.getContractFactory("CaseSale");
  const caseSale = await (CaseSale as any).deploy(
    usdc,
    cbbtc,
    caseToken,
    btcUsdFeed,
    treasury,
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

  if (
    dailyCaseTypeId > 0 &&
    process.env.DAILY_CASE_MIN_REWARD_USD &&
    process.env.DAILY_CASE_MAX_REWARD_USD
  ) {
    const dailyPrice = BigInt(process.env.DAILY_CASE_PRICE_USDC ?? "0");
    const dailyEnabled = String(process.env.DAILY_CASE_ENABLED ?? "true") === "true";
    const dailyPositiveBps = Number(process.env.DAILY_CASE_POSITIVE_RETURN_BPS ?? 0);
    const tx = await caseSale.setCaseType(
      dailyCaseTypeId,
      dailyPrice,
      BigInt(process.env.DAILY_CASE_MIN_REWARD_USD),
      BigInt(process.env.DAILY_CASE_MAX_REWARD_USD),
      dailyPositiveBps,
      dailyEnabled,
      { ...overrides, nonce: nextNonce() },
    );
    await tx.wait();

    const dailyTx = await caseSale.setDailyCase(
      dailyCaseTypeId,
      dailyCooldownSeconds,
      { ...overrides, nonce: nextNonce() },
    );
    await dailyTx.wait();

    if (
      process.env.DAILY_CASE_CASE_BPS ||
      process.env.DAILY_CASE_CASE_MIN ||
      process.env.DAILY_CASE_CASE_MAX ||
      process.env.DAILY_CASE_CBBTC_MIN ||
      process.env.DAILY_CASE_CBBTC_MAX
    ) {
      const rewardTx = await caseSale.setDailyCaseRewards(
        dailyCaseCaseBps,
        dailyCaseCaseMin,
        dailyCaseCaseMax,
        dailyCaseCbBtcMin,
        dailyCaseCbBtcMax,
        { ...overrides, nonce: nextNonce() },
      );
      await rewardTx.wait();
    }
  }

  const deployment = {
    network: network.name,
    xCase: await xCase.getAddress(),
    caseStaking: await caseStaking.getAddress(),
    xCaseStaking: await xCaseStaking.getAddress(),
    basedRoomRewards: await basedRoomRewards.getAddress(),
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
      NEXT_PUBLIC_BASED_ROOM_REWARDS_ADDRESS: deployment.basedRoomRewards,
    });
    console.log(`Updated ${envPath}`);
  }

  console.log("Deployed:", deployment);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
