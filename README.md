# Case MiniKit App

Case is a production-ready MiniKit / OnchainKit mini-app for the Base network. Users buy a case with 5 USDC, watch an opening animation, and reveal a random cbBTC reward. The app is designed to work seamlessly in the Base app, Farcaster mini-apps, and standard browser wallets.

## Features
- MiniKit auto-connect in Base + Farcaster (no login UI)
- Browser wallet connect via OnchainKit + wagmi
- Transparent RTP + fee configuration
- Case Store with extensible case registry
- Open flow with USDC approve/pay, video reveal, and reward summary
- Rewards history (local storage MVP, indexer TODO)
- Staking scaffold (stake/unstake/claim, daily mini-case)
- Provably fair page (commit-reveal placeholder, VRF-ready)
- Hardhat contracts for CaseSale (VRF), CaseStaking, xCASE, and xCASE fee staking

## Tech Stack
- Next.js App Router + TypeScript
- Tailwind + shadcn/ui
- @coinbase/onchainkit + MiniKit integration
- wagmi + viem
- Zustand (local storage MVP state)

## Local Development
```bash
npm install
npm run dev
```

## Contracts (Hardhat)
```bash
npm run compile
```

Deploy to Base or Base Sepolia:
```bash
npm run deploy:base
npm run deploy:base-sepolia
```

The deploy script reads env vars (see `.env.example`) and will optionally update `.env` with the new contract addresses when `UPDATE_ENV=true`.

Contracts live in `contracts/`:
- `CaseSale.sol` (USDC purchase, Chainlink VRF reward assignment, cbBTC claim)
- `XCase.sol` (staking receipt token)
- `CaseStaking.sol` (stake CASE → mint xCASE)
- `XCaseStaking.sol` (stake xCASE → earn platform fee rewards)

## Environment Variables
Copy `.env.example` to `.env.local` and fill in values:
- `NEXT_PUBLIC_CDP_API_KEY`: Coinbase Developer Platform Client API key (optional if `NEXT_PUBLIC_RPC_URL` is set)
- `NEXT_PUBLIC_CHAIN`: `base` or `base-sepolia`
- `NEXT_PUBLIC_USDC_ADDRESS`, `NEXT_PUBLIC_CBBTC_ADDRESS`, `NEXT_PUBLIC_CASE_TOKEN_ADDRESS`, `NEXT_PUBLIC_CASE_STAKING_ADDRESS`, `NEXT_PUBLIC_XCASE_ADDRESS`, `NEXT_PUBLIC_XCASE_STAKING_ADDRESS`, `NEXT_PUBLIC_CASE_SALE_OR_MANAGER_ADDRESS`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (optional, for WalletConnect)
- `NEXT_PUBLIC_CBBTC_USD` / `CBBTC_USD` (placeholder price)
Hardhat deployment variables:
- `DEPLOY_KEY_BASE`, `BASE_RPC_URL`, `BASE_SEPOLIA_RPC_URL`
- `USDC_ADDRESS`, `CBBTC_ADDRESS`, `CASE_TOKEN_ADDRESS`, `TREASURY_ADDRESS`
- `VRF_COORDINATOR`, `VRF_KEY_HASH`, `VRF_SUBSCRIPTION_ID`
- `UPDATE_ENV`, `DEPLOY_ENV_PATH` (optional auto-update of frontend env values)

## Important TODOs (Production)
- Replace mock addresses with real Base mainnet deployments.
- Fund the CaseSale contract with cbBTC and configure Chainlink VRF.
- Wire reward payouts from treasury (relayer or onchain claim logic).
- Add an indexer for CasePurchased/CaseRewarded/CaseClaimed events.
- Use an oracle for cbBTC/USD pricing.

## Notes
- The MVP uses server-side randomness with immediate reveal. This is explicit in the UI and the `/provably-fair` page.
- Staking rewards are paid in USDC for MVP; cbBTC rewards are a TODO.
- Daily mini-case cooldown is enforced in local storage; replace with onchain enforcement.

---

This project intentionally avoids hidden house-edge logic. RTP and platform fees are explicit in `config/economics.ts`.
