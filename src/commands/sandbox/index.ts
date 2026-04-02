import { Command } from 'commander';
import chalk from 'chalk';
import { apiRequest } from '../../lib/http.js';
import { extractSandboxId } from '../../lib/sandbox.js';
import { printJson, printSuccess, printTable, exitWithError } from '../../lib/output.js';

interface SandboxCreateResponse {
  status: string;
  sandboxId: string;
  forkingDetails: { chainId: number; blockNumber: number };
  chainId: number;
  mnemonic: string;
  rpcUrl: string;
  explorerUrl: string;
  faucetUrl: string;
  verificationUrl: string;
}

interface SandboxDetailsResponse {
  sandboxId: string;
  status: string;
  forkingDetails: { chainId: number; blockNumber: number };
  chainId: number;
  mnemonic: string;
  rpcUrl: string;
  explorerUrl: string;
  faucetUrl: string;
  verificationUrl?: string;
}

interface ContainerItem {
  nodeId?: string;
  sandboxId?: string;
  name?: string;
  status?: string;
  rpcUrl?: string;
  forkingDetails?: { chainId: number; blockNumber?: number };
  chainId?: number;
  createdAt?: string;
}

interface NetworkOption {
  label: string;
  value: string;
  networkRpc?: string;
}

interface NetworkGroup {
  name: string;
  id: string;
  options: NetworkOption[];
}

export function registerSandboxCommands(program: Command): void {
  const sandbox = program.command('sandbox').description('Manage BuildBear sandboxes');

  sandbox
    .command('create')
    .description('Create a new sandbox, prints RPC URL on success')
    .option('--network <chainId>', 'Chain ID or network name to fork from')
    .option('--fork-block <blockNumber>', 'Block number to fork from')
    .option('--chain-id <customChainId>', 'Custom chain ID for the sandbox')
    .option('--prefund <addresses>', 'Comma-separated addresses to prefund')
    .option('--name <label>', 'Label for this sandbox (stored locally)')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (opts: {
      network?: string;
      forkBlock?: string;
      chainId?: string;
      prefund?: string;
      name?: string;
      json?: boolean;
      quiet?: boolean;
    }) => {
      try {
        const body: Record<string, unknown> = {};

        if (opts.network) {
          // Accept numeric chainId or name; look up by name if needed
          const chainId = parseInt(opts.network, 10);
          if (!isNaN(chainId)) {
            body.chainId = chainId;
          } else {
            // Try to resolve network name to chainId
            const chains = await apiRequest<NetworkGroup[]>('/v1/buildbear-sandbox/chains');
            const normalised = opts.network.toLowerCase();
            let resolved: string | undefined;
            for (const group of chains) {
              for (const opt of group.options) {
                if (
                  opt.label.toLowerCase().includes(normalised) ||
                  group.name.toLowerCase() === normalised
                ) {
                  resolved = opt.value;
                  break;
                }
              }
              if (resolved) break;
            }
            if (!resolved) {
              throw new Error(
                `Unknown network '${opts.network}'. Run 'buildbear sandbox networks' to see available options.`
              );
            }
            body.chainId = parseInt(resolved, 10);
          }
        }

        if (opts.forkBlock) body.blockNumber = parseInt(opts.forkBlock, 10);
        if (opts.chainId) body.customChainId = parseInt(opts.chainId, 10);
        if (opts.prefund) body.prefund = opts.prefund.split(',').map((a) => a.trim());

        const result = await apiRequest<SandboxCreateResponse>('/v1/buildbear-sandbox', {
          method: 'POST',
          body,
        });

        if (opts.json) {
          printJson(result);
          return;
        }

        printSuccess('Sandbox created', opts.quiet ?? false);
        if (!opts.quiet) {
          console.log(`  RPC URL:   ${chalk.cyan(result.rpcUrl)}`);
          console.log(`  Explorer:  ${chalk.cyan(result.explorerUrl)}`);
          console.log(`  Faucet:    ${chalk.cyan(result.faucetUrl)}`);
          console.log(`  Mnemonic:  ${result.mnemonic}`);
        }
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });

  sandbox
    .command('list')
    .description('List all sandboxes')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (opts: { json?: boolean; quiet?: boolean }) => {
      try {
        const containers = await apiRequest<ContainerItem[]>('/user/container/');

        if (opts.json) {
          printJson(containers);
          return;
        }

        if (!containers || containers.length === 0) {
          if (!opts.quiet) console.log('No sandboxes found.');
          return;
        }

        const rows = containers.map((c) => [
          c.sandboxId ?? c.nodeId ?? '-',
          c.name ?? '-',
          c.status ?? '-',
          c.rpcUrl ?? '-',
        ]);

        printTable(['Sandbox ID', 'Name', 'Status', 'RPC URL'], rows, opts.quiet ?? false);
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });

  sandbox
    .command('delete <rpcUrl>')
    .description('Destroy sandbox by RPC URL')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (rpcUrl: string, opts: { json?: boolean; quiet?: boolean }) => {
      try {
        const sandboxId = extractSandboxId(rpcUrl);
        const result = await apiRequest<string>(`/v1/buildbear-sandbox/${sandboxId}`, {
          method: 'DELETE',
        });

        if (opts.json) {
          printJson({ message: result });
          return;
        }

        printSuccess(`Sandbox deleted: ${sandboxId}`, opts.quiet ?? false);
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });

  sandbox
    .command('networks')
    .description('List all supported fork networks')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (opts: { json?: boolean; quiet?: boolean }) => {
      try {
        const chains = await apiRequest<NetworkGroup[]>('/v1/buildbear-sandbox/chains');

        if (opts.json) {
          printJson(chains);
          return;
        }

        const rows: string[][] = [];
        for (const group of chains) {
          for (const opt of group.options) {
            rows.push([group.name, opt.label, opt.value]);
          }
        }

        printTable(['Network', 'Label', 'Chain ID'], rows, opts.quiet ?? false);
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });

  // `buildbear status <rpcUrl>` — top-level but logically related to sandbox
  program
    .command('status <rpcUrl>')
    .description('Quick health check for a sandbox (live/pending/dead)')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (rpcUrl: string, opts: { json?: boolean; quiet?: boolean }) => {
      try {
        const sandboxId = extractSandboxId(rpcUrl);
        const result = await apiRequest<SandboxDetailsResponse>(
          `/v1/buildbear-sandbox/${sandboxId}`
        );

        if (opts.json) {
          printJson(result);
          return;
        }

        const statusColor =
          result.status === 'live'
            ? chalk.green
            : result.status === 'pending'
            ? chalk.yellow
            : chalk.red;

        console.log(`Status:    ${statusColor(result.status)}`);
        console.log(`Sandbox:   ${result.sandboxId}`);
        console.log(`Fork:      Chain ${result.forkingDetails?.chainId} @ block ${result.forkingDetails?.blockNumber}`);
        console.log(`RPC URL:   ${chalk.cyan(result.rpcUrl)}`);
        console.log(`Explorer:  ${chalk.cyan(result.explorerUrl)}`);
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });
}
