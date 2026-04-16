import chalk from 'chalk';
import { apiRequest } from './http.js';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function validateEthAddress(value: string, label: string): void {
  if (!ETH_ADDRESS_RE.test(value)) {
    throw new Error(
      `Invalid Ethereum address for ${label}: "${value}". Must be 0x followed by exactly 40 hex characters.`
    );
  }
}

export function extractSandboxId(rpcUrl: string): string {
  // https://rpc.buildbear.io/yielding-mysterio-055e0fb6 → yielding-mysterio-055e0fb6
  const match = rpcUrl.match(/rpc\.buildbear\.io\/([^/?#]+)/);
  if (!match) {
    throw new Error(
      `Not a valid BuildBear RPC URL. Expected: https://rpc.buildbear.io/<id>`
    );
  }
  return match[1];
}

interface SandboxStatusResponse {
  sandboxId: string;
  status: string;
  forkingDetails?: { chainId: number; blockNumber: number };
  chainId?: number;
  rpcUrl?: string;
  explorerUrl?: string;
}

export async function checkSandboxLive(rpcUrl: string): Promise<void> {
  const sandboxId = extractSandboxId(rpcUrl);
  const data = await apiRequest<SandboxStatusResponse>(`/v1/buildbear-sandbox/${sandboxId}`);

  if (data.status === 'live') {
    return;
  }

  if (data.status === 'pending') {
    console.warn(
      chalk.yellow(`Warning: Sandbox ${sandboxId} is still starting up (status: pending). Command may fail if not ready yet.`)
    );
    return;
  }

  throw new Error(
    `Sandbox ${sandboxId} is not active (status: ${data.status}). Create a new one with: buildbear sandbox create`
  );
}
