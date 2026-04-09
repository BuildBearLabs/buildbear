import { Command } from 'commander';
import { rpcRequest } from '../../lib/http.js';
import { checkSandboxLive } from '../../lib/sandbox.js';
import { printJson, printSuccess, exitWithError } from '../../lib/output.js';
import chalk from 'chalk';
import { getProjectRpcUrl } from '../../lib/config.js';

export function registerSnapshotCommands(program: Command): void {
  const snapshot = program.command('snapshot').description('Take and revert sandbox state snapshots');

  snapshot
    .command('take [rpcUrl]')
    .description('Take a state snapshot, returns snapshotId')
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
        await checkSandboxLive(rpcUrl);
        const snapshotId = await rpcRequest<string>(rpcUrl, 'evm_snapshot', []);

        if (opts.json) {
          printJson({ snapshotId, rpcUrl });
          return;
        }

        printSuccess(`Snapshot taken: ${chalk.cyan(snapshotId)}`, opts.quiet ?? false);
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });

  snapshot
    .command('revert [rpcUrl]')
    .description('Revert to a previous snapshot')
    .requiredOption('--snapshot <snapshotId>', 'Snapshot ID to revert to (hex, e.g. 0x1)')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (
      rpcUrl: string | undefined,
      opts: { snapshot: string; json?: boolean; quiet?: boolean }
    ) => {
      try {
        if (!rpcUrl) {
          rpcUrl = getProjectRpcUrl() ?? undefined;
          if (!rpcUrl) {
            throw new Error('No RPC URL provided and no .buildbear.json found in current directory. Run buildbear init or pass an RPC URL.');
          }
        }
        await checkSandboxLive(rpcUrl);
        const result = await rpcRequest<boolean>(rpcUrl, 'evm_revert', [opts.snapshot]);

        if (opts.json) {
          printJson({ success: result, snapshotId: opts.snapshot, rpcUrl });
          return;
        }

        printSuccess(`Reverted to snapshot ${chalk.cyan(opts.snapshot)}`, opts.quiet ?? false);
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });
}
