import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OpeningRecord = {
  id: string;
  caseTypeId: number;
  caseName: string;
  rewardCbBtc: number;
  rewardUsd: number;
  txHash: string;
  timestamp: number;
};

type OpeningsState = {
  openings: OpeningRecord[];
  addOpening: (opening: OpeningRecord) => void;
  clear: () => void;
};

export const useOpeningsStore = create<OpeningsState>()(
  persist(
    (set) => ({
      openings: [],
      addOpening: (opening) =>
        set((state) => ({
          openings: [opening, ...state.openings].slice(0, 50),
        })),
      clear: () => set({ openings: [] }),
    }),
    {
      name: "case-openings-v1",
    },
  ),
);

