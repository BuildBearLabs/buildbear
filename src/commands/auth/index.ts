import { Command } from 'commander';
import * as readline from 'readline';
import {
  saveConfig,
  clearConfig,
  loadConfig,
  getConfigFilePath,
  isAuthenticated,
} from '../../lib/config.js';
import { printSuccess, printInfo, exitWithError } from '../../lib/output.js';
import chalk from 'chalk';

function prompt(question: string, silent = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    if (silent && process.stdout.isTTY) {
      process.stdout.write(question);
      // Disable echo for password input
      (process.stdin as NodeJS.ReadStream & { setRawMode?: (mode: boolean) => void }).setRawMode?.(true);
      let input = '';
      process.stdin.on('data', function onData(char: Buffer) {
        const c = char.toString();
        if (c === '\n' || c === '\r' || c === '\u0003') {
          process.stdout.write('\n');
          (process.stdin as NodeJS.ReadStream & { setRawMode?: (mode: boolean) => void }).setRawMode?.(false);
          process.stdin.removeListener('data', onData);
          rl.close();
          resolve(input);
        } else if (c === '\u007f' || c === '\b') {
          // backspace
          if (input.length > 0) input = input.slice(0, -1);
        } else {
          input += c;
          process.stdout.write('*');
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

function pressEnter(message: string): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Manage authentication');

  auth
    .command('setup')
    .description('Interactive setup wizard — guides you to get an API key')
    .action(async () => {
      // Skip wizard if env var is set
      if (process.env.BUILDBEAR_API_KEY) {
        console.log(chalk.green('✅ BUILDBEAR_API_KEY env var detected. No setup needed.'));
        return;
      }

      console.log(chalk.bold('\nWelcome to BuildBear CLI! Let\'s get you set up. 🐻\n'));

      console.log(chalk.cyan('Step 1 of 3 — Create an account (if you haven\'t already)'));
      console.log(chalk.yellow('→ Open: https://app.buildbear.io/signup'));
      await pressEnter('Press Enter once you have an account...');

      console.log();
      console.log(chalk.cyan('Step 2 of 3 — Get your API key'));
      console.log(chalk.yellow('→ Open: https://app.buildbear.io/settings/api-keys'));
      console.log('→ Click "Create API Key", give it a name, copy it.');
      console.log('  (Keys are shown once — save it somewhere safe!)');
      await pressEnter('Press Enter once you have your API key...');

      console.log();
      console.log(chalk.cyan('Step 3 of 3 — Enter your API key'));
      const apiKey = await prompt('API Key: ', true);

      if (!apiKey) {
        console.error(chalk.red('Error: API key cannot be empty.'));
        process.exit(1);
      }

      saveConfig({ apiKey });
      console.log();
      console.log(chalk.green(`✅ All set! Your API key is stored at ${getConfigFilePath()}`));
      console.log("Run `buildbear sandbox create --network mainnet` to create your first sandbox.");
    });

  auth
    .command('login')
    .description('Store API key (direct prompt, no wizard)')
    .action(async () => {
      if (process.env.BUILDBEAR_API_KEY) {
        console.log(chalk.green('✅ BUILDBEAR_API_KEY env var detected. No login needed.'));
        return;
      }
      const apiKey = await prompt('API Key: ', true);
      if (!apiKey) {
        console.error(chalk.red('Error: API key cannot be empty.'));
        process.exit(1);
      }
      saveConfig({ apiKey });
      console.log(chalk.green(`✅ API key stored at ${getConfigFilePath()}`));
    });

  auth
    .command('logout')
    .description('Clear stored credentials')
    .action(() => {
      clearConfig();
      printSuccess('Logged out. Credentials cleared.', false);
    });

  auth
    .command('status')
    .description('Show current authentication state')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      try {
        const usingEnv = !!process.env.BUILDBEAR_API_KEY;
        const config = loadConfig();
        const authenticated = isAuthenticated();
        const source = usingEnv ? 'env' : config.apiKey ? 'config' : 'none';

        if (opts.json) {
          console.log(JSON.stringify({ authenticated, source, configFile: getConfigFilePath() }));
          return;
        }

        if (!authenticated) {
          console.log(chalk.red('✗ Not authenticated'));
          console.log("Run `buildbear auth setup` to get started.");
        } else if (usingEnv) {
          console.log(chalk.green('✅ Authenticated via BUILDBEAR_API_KEY env var'));
        } else {
          console.log(chalk.green(`✅ Authenticated (key stored at ${getConfigFilePath()})`));
        }
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });
}
