import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';
import { apiRequest } from '../lib/http.js';
import { exitWithError } from '../lib/output.js';

const PROJECT_CONFIG_FILE = '.buildbear.json';

interface ProjectConfig {
  rpcUrl: string;
  network?: string;
  chainId?: number;
  forkChainId?: number;
  explorerUrl?: string;
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

interface NetworkOption {
  label: string;
  value: string;
}

interface NetworkGroup {
  name: string;
  options: NetworkOption[];
}

interface SandboxCreateResponse {
  rpcUrl: string;
  explorerUrl: string;
  chainId: number;
  sandboxId: string;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Interactive project setup — writes .buildbear.json')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const configPath = path.join(process.cwd(), PROJECT_CONFIG_FILE);

        if (fs.existsSync(configPath)) {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          const answer = await ask(rl, chalk.yellow(`⚠ .buildbear.json already exists. Overwrite? [y/N] `));
          rl.close();
          if (answer.toLowerCase() !== 'y') {
            console.log('Aborted.');
            return;
          }
        }

        // Fetch available networks
        const chains = await apiRequest<NetworkGroup[]>('/v1/buildbear-sandbox/chains');
        const networkList: string[] = [];
        const networkMap: Record<string, string> = {};
        const seenChainIds = new Set<string>();
        for (const group of chains) {
          for (const opt of group.options) {
            if (seenChainIds.has(opt.value)) continue;
            seenChainIds.add(opt.value);
            networkList.push(`${opt.label} (${opt.value})`);
            networkMap[opt.value] = opt.label;
          }
        }

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        console.log(chalk.bold('\n🐻 BuildBear Project Setup\n'));
        console.log('Available networks:');
        networkList.forEach((n) => console.log(`  ${n}`));
        console.log();

        const networkInput = await ask(rl, 'Chain ID: ');
        let chainId: number;
        chainId = parseInt(networkInput, 10);
        if (isNaN(chainId)) throw new Error(`Invalid chain ID: ${networkInput}`);

        const forkBlockInput = await ask(rl, 'Fork block number (leave blank for latest): ');
        const customChainIdInput = await ask(rl, 'Custom chain ID (leave blank to use default): ');
        const prefundInput = await ask(rl, 'Prefund addresses (comma-separated, leave blank to skip): ');

        rl.close();

        const body: Record<string, unknown> = { chainId };
        if (forkBlockInput) body.blockNumber = parseInt(forkBlockInput, 10);
        if (customChainIdInput) body.customChainId = parseInt(customChainIdInput, 10);
        if (prefundInput) body.prefund = prefundInput.split(',').map((a) => a.trim()).filter(Boolean);

        console.log(chalk.dim('\nCreating sandbox...'));
        const result = await apiRequest<SandboxCreateResponse>('/v1/buildbear-sandbox', {
          method: 'POST',
          body,
        });

        const config: ProjectConfig = {
          rpcUrl: result.rpcUrl,
          network: networkMap[String(chainId)] ?? String(chainId),
          chainId: result.chainId,
          forkChainId: chainId,
          explorerUrl: result.explorerUrl,
        };

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        if (opts.json) {
          console.log(JSON.stringify({ config, configPath }));
          return;
        }

        console.log();
        console.log(chalk.green(`✅ .buildbear.json written to ${configPath}`));
        console.log(`  RPC URL:  ${chalk.cyan(config.rpcUrl)}`);
        console.log(`  Explorer: ${chalk.cyan(config.explorerUrl ?? '-')}`);
        console.log();
        console.log("You can now omit <rpcUrl> from commands — it defaults from .buildbear.json");
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });
}
