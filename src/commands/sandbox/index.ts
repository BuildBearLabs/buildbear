import { Command } from 'commander';
import chalk from 'chalk';
import { apiRequest } from '../../lib/http.js';
import { extractSandboxId } from '../../lib/sandbox.js';
import { printJson, printSuccess, printTable, exitWithError } from '../../lib/output.js';
import { getProjectRpcUrl } from '../../lib/config.js';

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
  settings?: { name?: string; [key: string]: unknown };
}

const RPC_BASE = 'https://rpc.buildbear.io';

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
    .option('--network <chainId>', 'Chain ID of the network to fork (e.g. 1 for Ethereum, 10 for Optimism). Omit to create an unforked sandbox. Run "buildbear sandbox networks" to list available chain IDs')
    .option('--fork-block <blockNumber>', 'Block number to fork from')
    .option('--chain-id <customChainId>', 'Custom chain ID for the sandbox')
    .option('--prefund <addresses>', 'Comma-separated addresses to prefund')
    .option('--name <label>', 'Human-readable name for this sandbox')
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
          const chainId = parseInt(opts.network, 10);
          if (isNaN(chainId)) {
            throw new Error(
              `--network requires a numeric chain ID (e.g. 1 for Ethereum Mainnet, 10 for Optimism). Run 'buildbear sandbox networks' to list available chain IDs.`
            );
          }
          body.chainId = chainId;
        }

        if (opts.forkBlock) body.blockNumber = parseInt(opts.forkBlock, 10);
        if (opts.chainId) body.customChainId = parseInt(opts.chainId, 10);
        if (opts.prefund) body.prefund = opts.prefund.split(',').map((a) => a.trim());
        if (opts.name) body.name = opts.name;

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
          if (opts.name) console.log(`  Name:      ${chalk.bold(opts.name)}`);
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
    .description('List sandboxes with optional filtering')
    .option('--status <status>', 'Filter by status (e.g. live, dead, pending)')
    .option('--limit <n>', 'Maximum number of sandboxes to display')
    .option('--filter <pattern>', 'Filter by sandbox name or ID (case-insensitive substring match)')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (opts: { status?: string; limit?: string; filter?: string; json?: boolean; quiet?: boolean }) => {
      try {
        const containers = await apiRequest<ContainerItem[]>('/user/container/');

        // Enrich each container with derived fields
        let enriched = (containers ?? []).map((c) => {
          const id = c.sandboxId ?? c.nodeId;
          return {
            ...c,
            sandboxId: id,
            name: c.name ?? c.settings?.name ?? undefined,
            rpcUrl: c.rpcUrl ?? (id ? `${RPC_BASE}/${id}` : undefined),
          };
        });

        // Apply --status filter
        if (opts.status) {
          const target = opts.status.toLowerCase();
          enriched = enriched.filter((c) => c.status?.toLowerCase() === target);
        }

        // Apply --filter (substring match on name or sandboxId)
        if (opts.filter) {
          const pattern = opts.filter.toLowerCase();
          enriched = enriched.filter((c) =>
            (c.sandboxId?.toLowerCase().includes(pattern)) ||
            (c.name?.toLowerCase().includes(pattern))
          );
        }

        // Apply --limit
        const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;
        if (limit != null && !isNaN(limit) && limit > 0) {
          enriched = enriched.slice(0, limit);
        }

        if (opts.json) {
          printJson(enriched);
          return;
        }

        if (enriched.length === 0) {
          if (!opts.quiet) console.log('No sandboxes found.');
          return;
        }

        const rows = enriched.map((c) => [
          c.sandboxId ?? '-',
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
          const sanitised = chains.map((group) => ({
            name: group.name,
            id: group.id,
            options: group.options.map(({ label, value }) => ({ label, value })),
          }));
          printJson(sanitised);
          return;
        }

        const rows: string[][] = [];
        const seenChainIds = new Set<string>();
        for (const group of chains) {
          for (const opt of group.options) {
            if (seenChainIds.has(opt.value)) continue;
            seenChainIds.add(opt.value);
            rows.push([group.name, opt.label, opt.value]);
          }
        }

        printTable(['Network', 'Label', 'Chain ID'], rows, opts.quiet ?? false);
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });

  // Probe an RPC URL directly to determine sandbox status when the REST API fails.
  // The RPC gateway returns error messages that indicate the sandbox state.
  async function probeSandboxRpc(rpcUrl: string): Promise<string> {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }),
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const body = await response.json() as { result?: string; error?: { message?: string; code?: number } };
        if (body.result) return 'live';
        if (body.error?.message) return parseRpcErrorStatus(body.error.message);
        return 'unknown';
      }

      // Non-200 responses — try to extract a meaningful status from the body
      let errorText = '';
      try {
        const body = await response.json() as { error?: string | { message?: string }; message?: string };
        if (typeof body.error === 'string') errorText = body.error;
        else if (body.error?.message) errorText = body.error.message;
        else if (body.message) errorText = body.message;
      } catch {
        errorText = response.statusText;
      }

      if (response.status === 404) return 'not found';
      return parseRpcErrorStatus(errorText) || `unavailable (HTTP ${response.status})`;
    } catch {
      return 'unreachable';
    }
  }

  function parseRpcErrorStatus(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('not found') || lower.includes('does not exist')) return 'not found';
    if (lower.includes('stopped') || lower.includes('stop')) return 'stopped';
    if (lower.includes('deleted') || lower.includes('destroy')) return 'deleted';
    if (lower.includes('dead') || lower.includes('expired')) return 'expired';
    if (lower.includes('pending') || lower.includes('starting')) return 'pending';
    if (lower.includes('unavailable')) return 'unavailable';
    return message.length > 80 ? message.slice(0, 77) + '...' : message;
  }

  // `buildbear status <rpcUrl>` — top-level but logically related to sandbox
  program
    .command('status [rpcUrl]')
    .description('Quick health check for a sandbox (live/pending/dead)')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (rpcUrl: string | undefined, opts: { json?: boolean; quiet?: boolean }) => {
      try {
        if (!rpcUrl) {
          rpcUrl = getProjectRpcUrl() ?? undefined;
          if (!rpcUrl) {
            throw new Error('No RPC URL provided and no .buildbear.json found in current directory. Run buildbear init or pass an RPC URL.');
          }
        }
        const sandboxId = extractSandboxId(rpcUrl);
        const actualRpcUrl = `${RPC_BASE}/${sandboxId}`;

        // Try the REST API first for full details
        let result: SandboxDetailsResponse | null = null;
        try {
          result = await apiRequest<SandboxDetailsResponse>(
            `/v1/buildbear-sandbox/${sandboxId}`
          );
        } catch {
          // API failed — fall through to RPC probe
        }

        // If the API returned data, show it
        if (result) {
          const isHealthy = result.status === 'live' || result.status === 'pending';

          if (opts.json) {
            printJson(result);
            if (!isHealthy) process.exit(1);
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
          if (result.forkingDetails?.chainId != null) {
            console.log(`Fork:      Chain ${result.forkingDetails.chainId} @ block ${result.forkingDetails.blockNumber}`);
          } else {
            console.log(`Fork:      (unforked)`);
          }
          console.log(`RPC URL:   ${chalk.cyan(result.rpcUrl)}`);
          console.log(`Explorer:  ${chalk.cyan(result.explorerUrl)}`);

          if (!isHealthy) process.exit(1);
          return;
        }

        // API didn't return data — probe the RPC URL directly for accurate status
        const probeStatus = await probeSandboxRpc(actualRpcUrl);

        if (opts.json) {
          printJson({ sandboxId, status: probeStatus, rpcUrl: actualRpcUrl });
          process.exit(1);
        }

        console.log(`Status:    ${chalk.red(probeStatus)}`);
        console.log(`Sandbox:   ${sandboxId}`);
        console.log(`RPC URL:   ${chalk.cyan(actualRpcUrl)}`);
        process.exit(1);
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });
}
