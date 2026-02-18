import { create } from "zustand";
import { persist } from "zustand/middleware";

type DailyClaimState = {
  lastClaimByAddress: Record<string, number>;
  setLastClaimAt: (address: string, timestamp: number) => void;
  getLastClaimAt: (address: string) => number | null;
};

export const useDailyClaimStore = create<DailyClaimState>()(
  persist(
    (set, get) => ({
      lastClaimByAddress: {},
      setLastClaimAt: (address, timestamp) =>
        set((state) => ({
          lastClaimByAddress: {
            ...state.lastClaimByAddress,
            [address.toLowerCase()]: timestamp,
          },
        })),
      getLastClaimAt: (address) => {
        const value = get().lastClaimByAddress[address.toLowerCase()];
        return value ?? null;
      },
    }),
    {
      name: "case-daily-claims-v1",
    },
  ),
);

