import { isTestnet } from "./chains";

const MOCK_BASE_SEPOLIA = {
  usdc: "0x1111111111111111111111111111111111111111",
  cbbtc: "0x2222222222222222222222222222222222222222",
  caseToken: "0x3333333333333333333333333333333333333333",
  caseStaking: "0x4444444444444444444444444444444444444444",
  xCaseToken: "0x5555555555555555555555555555555555555555",
  xCaseStaking: "0x6666666666666666666666666666666666666666",
  caseSale: "0x7777777777777777777777777777777777777777",
};

const MAINNET_PLACEHOLDERS = {
  usdc: "0x0000000000000000000000000000000000000000",
  cbbtc: "0x0000000000000000000000000000000000000000",
  caseToken: "0x0000000000000000000000000000000000000000",
  caseStaking: "0x0000000000000000000000000000000000000000",
  xCaseToken: "0x0000000000000000000000000000000000000000",
  xCaseStaking: "0x0000000000000000000000000000000000000000",
  caseSale: "0x0000000000000000000000000000000000000000",
};

const defaults = isTestnet ? MOCK_BASE_SEPOLIA : MAINNET_PLACEHOLDERS;

export const contractAddresses = {
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS || defaults.usdc,
  cbbtc: process.env.NEXT_PUBLIC_CBBTC_ADDRESS || defaults.cbbtc,
  caseToken: process.env.NEXT_PUBLIC_CASE_TOKEN_ADDRESS || defaults.caseToken,
  caseStaking:
    process.env.NEXT_PUBLIC_CASE_STAKING_ADDRESS || defaults.caseStaking,
  xCaseToken: process.env.NEXT_PUBLIC_XCASE_ADDRESS || defaults.xCaseToken,
  xCaseStaking:
    process.env.NEXT_PUBLIC_XCASE_STAKING_ADDRESS || defaults.xCaseStaking,
  caseSale:
    process.env.NEXT_PUBLIC_CASE_SALE_OR_MANAGER_ADDRESS || defaults.caseSale,
};

const MOCK_ADDRESS_SET = new Set(
  Object.values(MOCK_BASE_SEPOLIA).map((address) => address.toLowerCase()),
);

export const contractFlags = {
  usingMockAddresses: Object.values(contractAddresses).some((address) => {
    const normalized = address.toLowerCase();
    return (
      normalized === "0x0000000000000000000000000000000000000000" ||
      MOCK_ADDRESS_SET.has(normalized)
    );
  }),
};

export const USDC_DECIMALS = 6;
export const CASE_DECIMALS = 18;
export const CBBTC_DECIMALS = 8;
