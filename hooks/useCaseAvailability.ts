"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { CaseType } from "@/config/caseTypes";
import { caseSaleAbi } from "@/lib/abis/caseSale";
import { contractAddresses, contractFlags } from "@/lib/contracts";

type CaseAvailability = {
  available: bigint | null;
  soldOut: boolean;
  isLoading: boolean;
  isLive: boolean;
};

export function useCaseAvailability(caseType?: CaseType): CaseAvailability {
  const enabled =
    Boolean(caseType) && !contractFlags.usingMockAddresses;
  const caseSaleAddress = contractAddresses.caseSale as `0x${string}`;

  const { data, isLoading } = useReadContract({
    address: caseSaleAddress,
    abi: caseSaleAbi,
    functionName: "availableCases",
    args: caseType ? [BigInt(caseType.id)] : undefined,
    query: { enabled },
  });

  const available = enabled && typeof data === "bigint" ? data : null;
  const soldOut = enabled ? available === 0n : false;

  const isLive = useMemo(() => {
    if (!caseType) return false;
    if (!caseType.enabled || caseType.availability !== "live") return false;
    if (!enabled) return caseType.enabled;
    return !soldOut;
  }, [caseType, enabled, soldOut]);

  return { available, soldOut, isLoading, isLive };
}
