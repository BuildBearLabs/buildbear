import { Command } from 'commander';
import { apiRequest } from '../../lib/http.js';
import { extractSandboxId } from '../../lib/sandbox.js';
import { printJson, printSuccess, exitWithError } from '../../lib/output.js';
import chalk from 'chalk';

interface ExplorerResult {
  result?: string | unknown[];
  status?: string;
  message?: string;
}

function assertExplorerSuccess(result: ExplorerResult): void {
  if (result.status === '0' || result.message === 'NOTOK') {
    const detail = typeof result.result === 'string' ? result.result : 'Unknown error';
    throw new Error(`API error: ${detail}`);
  }
}

export function registerContractCommands(program: Command): void {
  const contract = program.command('contract').description('Inspect and verify smart contracts');

  contract
    .command('source <rpcUrl>')
    .description('Get verified source code for a contract')
    .requiredOption('--address <contractAddress>', 'Contract address')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (rpcUrl: string, opts: { address: string; json?: boolean; quiet?: boolean }) => {
      try {
        const sandboxId = extractSandboxId(rpcUrl);
        const result = await apiRequest<ExplorerResult>(
          `/v1/explorer/${sandboxId}?module=contract&action=getsourcecode&address=${opts.address}`,
          { auth: true }
        );

        assertExplorerSuccess(result);

        if (opts.json) {
          printJson(result);
          return;
        }

        const source = Array.isArray(result.result)
          ? JSON.stringify(result.result, null, 2)
          : String(result.result ?? '');

        console.log(chalk.cyan(`Source code for ${opts.address}:`));
        console.log(source);
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });

  contract
    .command('abi <rpcUrl>')
    .description('Get contract ABI')
    .requiredOption('--address <contractAddress>', 'Contract address')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (rpcUrl: string, opts: { address: string; json?: boolean; quiet?: boolean }) => {
      try {
        const sandboxId = extractSandboxId(rpcUrl);
        const result = await apiRequest<ExplorerResult>(
          `/v1/explorer/${sandboxId}?module=contract&action=getabi&address=${opts.address}`,
          { auth: true }
        );

        assertExplorerSuccess(result);

        if (opts.json) {
          printJson(result);
          return;
        }

        const abi = Array.isArray(result.result)
          ? JSON.stringify(result.result, null, 2)
          : String(result.result ?? '');

        console.log(chalk.cyan(`ABI for ${opts.address}:`));
        console.log(abi);
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });

  contract
    .command('verify <rpcUrl>')
    .description('Verify a smart contract')
    .requiredOption('--address <contractAddress>', 'Contract address')
    .option('--type <type>', 'Verification type: etherscan (default) or sourcify', 'etherscan')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (
      rpcUrl: string,
      opts: { address: string; type: string; json?: boolean; quiet?: boolean }
    ) => {
      try {
        const sandboxId = extractSandboxId(rpcUrl);
        const verifyType = opts.type.toLowerCase();

        let endpoint: string;
        if (verifyType === 'sourcify') {
          endpoint = `https://rpc.buildbear.io/verify/sourcify/server/${sandboxId}`;
        } else if (verifyType === 'etherscan') {
          endpoint = `https://rpc.buildbear.io/verify/etherscan/${sandboxId}`;
        } else {
          throw new Error(`Unknown verification type '${opts.type}'. Use 'etherscan' or 'sourcify'.`);
        }

        // POST to verification endpoint — body depends on verifier toolchain
        // This is a passthrough: tools like Foundry/Hardhat send their own body
        // Here we just confirm the endpoint is reachable with the contract address
        const result = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: opts.address }),
          signal: AbortSignal.timeout(30_000),
        });

        const body = await result.text();

        if (opts.json) {
          let parsed: unknown;
          try { parsed = JSON.parse(body); } catch { parsed = body; }
          printJson({ status: result.status, result: parsed, endpoint });
          return;
        }

        printSuccess(
          `Verification submitted via ${verifyType}: ${endpoint}`,
          opts.quiet ?? false
        );
        if (!opts.quiet) {
          console.log(chalk.dim(body));
        }
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });
}
