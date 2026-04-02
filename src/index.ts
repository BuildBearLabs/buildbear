#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth/index.js';
import { registerSandboxCommands } from './commands/sandbox/index.js';
import { registerFaucetCommands } from './commands/faucet/index.js';
import { registerSnapshotCommands } from './commands/snapshot/index.js';
import { registerContractCommands } from './commands/contract/index.js';
import { registerRpcCommand } from './commands/rpc.js';
import { registerInitCommand } from './commands/init.js';

const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('buildbear')
  .description('BuildBear CLI — manage sandboxes, faucets, snapshots, and contracts')
  .version(pkg.version, '-v, --version', 'Print CLI version');

registerAuthCommands(program);
registerSandboxCommands(program);
registerFaucetCommands(program);
registerSnapshotCommands(program);
registerContractCommands(program);
registerRpcCommand(program);
registerInitCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
