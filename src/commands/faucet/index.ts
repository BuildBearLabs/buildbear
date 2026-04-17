import { Command } from 'commander';
import { rpcRequest } from '../../lib/http.js';
import { checkSandboxLive, validateEthAddress } from '../../lib/sandbox.js';
import { printJson, printSuccess, exitWithError } from '../../lib/output.js';
import { getProjectRpcUrl } from '../../lib/config.js';

export function registerFaucetCommands(program: Command): void {
  const faucet = program.command('faucet').description('Fund native or ERC-20 tokens in a sandbox');

  faucet
    .command('native [rpcUrl]')
    .description('Fund native tokens (ETH, MATIC, etc.) to a wallet')
    .requiredOption('--address <walletAddress>', 'Wallet address to fund')
    .option('--amount <amountInEther>', 'Amount in ether (default: 1)', '1')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (
      rpcUrl: string | undefined,
      opts: { address: string; amount: string; json?: boolean; quiet?: boolean }
    ) => {
      try {
        if (!rpcUrl) {
          rpcUrl = getProjectRpcUrl() ?? undefined;
          if (!rpcUrl) {
            throw new Error('No RPC URL provided and no .buildbear.json found in current directory. Run buildbear init or pass an RPC URL.');
          }
        }
        validateEthAddress(opts.address, '--address');
        await checkSandboxLive(rpcUrl);
        // Convert ether to wei (use BigInt to avoid float precision issues)
        const amountEther = parseFloat(opts.amount);
        if (isNaN(amountEther) || amountEther <= 0) {
          throw new Error('Amount must be a positive number.');
        }
        // Convert to wei: multiply by 10^18
        const weiAmount = BigInt(Math.floor(amountEther * 1e9)) * BigInt(1e9);

        const result = await rpcRequest<unknown>(rpcUrl, 'buildbear_nativeFaucet', [
          {
            address: opts.address,
            balance: weiAmount.toString(),
            unit: 'wei',
          },
        ]);

        if (opts.json) {
          printJson({ result, address: opts.address, amount: opts.amount, rpcUrl });
          return;
        }

        printSuccess(`Sent ${opts.amount} native tokens to ${opts.address}`, opts.quiet ?? false);
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });

  faucet
    .command('erc20 [rpcUrl]')
    .description('Mint ERC-20 tokens to a wallet')
    .requiredOption('--token <contractAddress>', 'ERC-20 token contract address')
    .requiredOption('--address <walletAddress>', 'Wallet address to fund')
    .option('--amount <amount>', 'Amount in token units (default: 1000)', '1000')
    .option('--json', 'Output as JSON')
    .option('--quiet', 'Suppress output except errors')
    .action(async (
      rpcUrl: string | undefined,
      opts: { token: string; address: string; amount: string; json?: boolean; quiet?: boolean }
    ) => {
      try {
        if (!rpcUrl) {
          rpcUrl = getProjectRpcUrl() ?? undefined;
          if (!rpcUrl) {
            throw new Error('No RPC URL provided and no .buildbear.json found in current directory. Run buildbear init or pass an RPC URL.');
          }
        }
        validateEthAddress(opts.address, '--address');
        validateEthAddress(opts.token, '--token');
        await checkSandboxLive(rpcUrl);
        // Use BigInt arithmetic for token amounts to avoid float precision loss
        const amountNum = parseFloat(opts.amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          throw new Error('Amount must be a positive number.');
        }
        // Default to wei units; user passes whole token units scaled by 10^18
        const weiBigInt = BigInt(Math.floor(amountNum * 1e9)) * BigInt(1e9);

        const result = await rpcRequest<unknown>(rpcUrl, 'buildbear_ERC20Faucet', [
          {
            address: opts.address,
            token: opts.token,
            balance: weiBigInt.toString(),
            unit: 'wei',
          },
        ]);

        if (opts.json) {
          printJson({ result, address: opts.address, token: opts.token, amount: opts.amount, rpcUrl });
          return;
        }

        printSuccess(
          `Sent ${opts.amount} ERC-20 tokens (${opts.token}) to ${opts.address}`,
          opts.quiet ?? false
        );
      } catch (err) {
        exitWithError(err, opts.json ?? false);
      }
    });
}
