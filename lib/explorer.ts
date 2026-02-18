import { explorerBaseUrl } from "./chains";

export const getExplorerTxUrl = (txHash: string) =>
  `${explorerBaseUrl}/tx/${txHash}`;

export const getExplorerAddressUrl = (address: string) =>
  `${explorerBaseUrl}/address/${address}`;

