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
