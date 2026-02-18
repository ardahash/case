export const caseSaleAbi = [
  {
    type: "function",
    name: "purchaseCase",
    stateMutability: "nonpayable",
    inputs: [{ name: "caseTypeId", type: "uint256" }],
    outputs: [{ name: "openingId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimReward",
    stateMutability: "nonpayable",
    inputs: [{ name: "openingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getOpening",
    stateMutability: "view",
    inputs: [{ name: "openingId", type: "uint256" }],
    outputs: [
      {
        components: [
          { name: "buyer", type: "address" },
          { name: "caseTypeId", type: "uint256" },
          { name: "rewardAmount", type: "uint256" },
          { name: "reservedAmount", type: "uint256" },
          { name: "btcUsdPrice", type: "uint256" },
          { name: "rewarded", type: "bool" },
          { name: "claimed", type: "bool" },
          { name: "requestId", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
  },
  {
    type: "function",
    name: "btcUsdDecimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "availableCases",
    stateMutability: "view",
    inputs: [{ name: "caseTypeId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "CasePurchased",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "caseTypeId", type: "uint256", indexed: true },
      { name: "openingId", type: "uint256", indexed: true },
      { name: "priceUSDC", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "CaseRewarded",
    inputs: [
      { name: "openingId", type: "uint256", indexed: true },
      { name: "rewardAmount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "CaseClaimed",
    inputs: [
      { name: "openingId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "rewardAmount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
