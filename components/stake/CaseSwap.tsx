"use client";

import {
  Swap,
  SwapAmountInput,
  SwapToggleButton,
  SwapButton,
  SwapMessage,
  SwapToast,
} from "@coinbase/onchainkit/swap";
import type { Token } from "@coinbase/onchainkit/token";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { activeChain } from "@/lib/chains";
import { contractAddresses, contractFlags, CASE_DECIMALS, USDC_DECIMALS } from "@/lib/contracts";

const CHAIN_ID = activeChain.id;

const USDC_TOKEN: Token = {
  name: "USDC",
  symbol: "USDC",
  address: contractAddresses.usdc as `0x${string}`,
  decimals: USDC_DECIMALS,
  chainId: CHAIN_ID,
  image:
    "https://dynamic-assets.coinbase.com/3c15df5e2ac7d4abbe9499ed9335041f00c620f28e8de2f93474a9f432058742cdf4674bd43f309e69778a26969372310135be97eb183d91c492154176d455b8/asset_icons/9d67b728b6c8f457717154b3a35f9ddc702eae7e76c4684ee39302c4d7fd0bb8.png",
};

const CASE_TOKEN: Token = {
  name: "Case",
  symbol: "CASE",
  address: contractAddresses.caseToken as `0x${string}`,
  decimals: CASE_DECIMALS,
  chainId: CHAIN_ID,
  image: "/icon.png",
};

const SWAPPABLE_TOKENS: Token[] = [USDC_TOKEN, CASE_TOKEN];

export function CaseSwap() {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Swap USDC ↔ CASE</CardTitle>
        <CardDescription>Instantly swap between USDC and CASE on Base.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {contractFlags.usingMockAddresses ? (
          <div className="rounded-2xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Swap is disabled while mock token addresses are configured.
          </div>
        ) : (
          <Swap className="w-full max-w-none">
            <SwapAmountInput
              label="Sell"
              swappableTokens={SWAPPABLE_TOKENS}
              token={USDC_TOKEN}
              type="from"
            />
            <SwapToggleButton />
            <SwapAmountInput
              label="Buy"
              swappableTokens={SWAPPABLE_TOKENS}
              token={CASE_TOKEN}
              type="to"
            />
            <SwapButton />
            <SwapMessage />
            <SwapToast />
          </Swap>
        )}
      </CardContent>
    </Card>
  );
}
