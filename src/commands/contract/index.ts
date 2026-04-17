import { Command } from 'commander';
import { apiRequest, ApiError, API_BASE } from '../../lib/http.js';
import { extractSandboxId, validateEthAddress } from '../../lib/sandbox.js';
import { getApiKey } from '../../lib/config.js';
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

function exitNotVerified(address: string, jsonMode: boolean): never {
  if (jsonMode) {
    exitWithError(new Error(`Contract ${address} is not verified on this sandbox.`), true);
  }
  console.error(chalk.yellow(`Contract ${address} is not verified on this sandbox.`));
  process.exit(1);
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
        validateEthAddress(opts.address, '--address');
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
        const isNotVerified =
          (err instanceof Error && /not verified|source code not verified/i.test(err.message)) ||
          (err instanceof ApiError && err.statusCode === 500);
        if (isNotVerified) exitNotVerified(opts.address, opts.json ?? false);
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
        validateEthAddress(opts.address, '--address');
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
        const isNotVerified =
          (err instanceof Error && /not verified|source code not verified/i.test(err.message)) ||
          (err instanceof ApiError && err.statusCode === 500);
        if (isNotVerified) exitNotVerified(opts.address, opts.json ?? false);
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
        validateEthAddress(opts.address, '--address');
        const sandboxId = extractSandboxId(rpcUrl);
        const verifyType = opts.type.toLowerCase();

        let endpoint: string;
        if (verifyType === 'sourcify') {
          endpoint = `${API_BASE}/v1/api/verify/sourcify/server/${sandboxId}`;
        } else if (verifyType === 'etherscan') {
          endpoint = `${API_BASE}/v1/api/verify/etherscan/${sandboxId}`;
        } else {
          throw new Error(`Unknown verification type '${opts.type}'. Use 'etherscan' or 'sourcify'.`);
        }

        const result = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getApiKey()}`,
          },
          body: JSON.stringify({ address: opts.address }),
          signal: AbortSignal.timeout(30_000),
        });

        const body = await result.text();
        let parsed: unknown;
        try { parsed = JSON.parse(body); } catch { parsed = body; }

        // Detect error responses (non-2xx, or body indicates failure)
        const isErrorStatus = !result.ok;
        const isBodyError =
          typeof parsed === 'string'
            ? /invalid action|error|fail/i.test(parsed)
            : typeof parsed === 'object' && parsed !== null &&
              (('status' in parsed && (parsed as Record<string, unknown>).status === '0') ||
               ('message' in parsed && (parsed as Record<string, unknown>).message === 'NOTOK'));

        if (opts.json) {
          printJson({ status: result.status, ok: !isErrorStatus && !isBodyError, result: parsed, endpoint });
          if (isErrorStatus || isBodyError) process.exit(1);
          return;
        }

        if (isErrorStatus || isBodyError) {
          const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
          throw new Error(`Verification failed (${result.status}): ${detail}`);
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
