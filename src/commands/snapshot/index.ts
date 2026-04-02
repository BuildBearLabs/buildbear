import { Command } from 'commander';
import { rpcRequest } from '../../lib/http.js';
import { printJson, printSuccess, exitWithError } from '../../lib/output.js';
import chalk from 'chalk';

export function registerSnapshotCommands(program: Command): void {
  const snapshot = program.command('snapshot').description('Take and revert sandbox state snapshots');

  snapshot
    .command('take <rpcUrl>')
    .description('Take a state snapshot, returns snapshotId')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (rpcUrl: string, opts: { json?: boolean; quiet?: boolean }) => {
      try {
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
    .command('revert <rpcUrl>')
    .description('Revert to a previous snapshot')
    .requiredOption('--snapshot <snapshotId>', 'Snapshot ID to revert to (hex, e.g. 0x1)')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (
      rpcUrl: string,
      opts: { snapshot: string; json?: boolean; quiet?: boolean }
    ) => {
      try {
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
