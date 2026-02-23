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
  const dailyCaseTypeId = Number(process.env.DAILY_CASE_TYPE_ID ?? 0);
  const dailyCooldownSeconds = Number(process.env.DAILY_CASE_COOLDOWN_SECONDS ?? 86400);
  const dailyCaseCaseBps = Number(process.env.DAILY_CASE_CASE_BPS ?? 0);
  const dailyCaseCaseMin = BigInt(process.env.DAILY_CASE_CASE_MIN ?? "0");
  const dailyCaseCaseMax = BigInt(process.env.DAILY_CASE_CASE_MAX ?? "0");
  const dailyCaseCbBtcMin = BigInt(process.env.DAILY_CASE_CBBTC_MIN ?? "0");
  const dailyCaseCbBtcMax = BigInt(process.env.DAILY_CASE_CBBTC_MAX ?? "0");

  if (!dailyCaseTypeId) {
    throw new Error("DAILY_CASE_TYPE_ID must be set for daily deployment");
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying Daily CaseSale with: ${deployer.address} on ${network.name}`);

  const overrides = await getFeeOverrides();

  const CaseSale = await ethers.getContractFactory("CaseSale");
  const caseSale = await (CaseSale as any).deploy(
    usdc,
    cbbtc,
    caseToken,
    btcUsdFeed,
    treasury,
    overrides,
  );
  await caseSale.waitForDeployment();

  if (
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
      overrides,
    );
    await tx.wait();

    const dailyTx = await caseSale.setDailyCase(
      dailyCaseTypeId,
      dailyCooldownSeconds,
      overrides,
    );
    await dailyTx.wait();

    const rewardTx = await caseSale.setDailyCaseRewards(
      dailyCaseCaseBps,
      dailyCaseCaseMin,
      dailyCaseCaseMax,
      dailyCaseCbBtcMin,
      dailyCaseCbBtcMax,
      overrides,
    );
    await rewardTx.wait();
  }

  const deployment = {
    network: network.name,
    dailyCaseSale: await caseSale.getAddress(),
  };

  const deploymentDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(deploymentDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentDir, `${network.name}-daily-case.json`),
    JSON.stringify(deployment, null, 2),
  );

  if (process.env.UPDATE_ENV === "true") {
    const envPath = process.env.DEPLOY_ENV_PATH || ".env";
    updateEnvFile(envPath, {
      NEXT_PUBLIC_DAILY_CASE_SALE_ADDRESS: deployment.dailyCaseSale,
    });
    console.log(`Updated ${envPath}`);
  }

  console.log("Deployed daily CaseSale:", deployment);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
