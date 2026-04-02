import { Command } from 'commander';
import * as fs from 'fs';
import { rpcRequest } from '../lib/http.js';
import { printJson, exitWithError } from '../lib/output.js';

export function registerRpcCommand(program: Command): void {
  program
    .command('rpc <rpcUrl>')
    .description('Direct JSON-RPC passthrough to sandbox')
    .requiredOption('--method <method>', 'JSON-RPC method name')
    .option('--params <json>', 'JSON array of params (or @file.json to read from file)', '[]')
    .option('--json', 'Output as JSON (always true for rpc, included for consistency)')
    .option('--quiet', 'Suppress output except errors')
    .action(async (
      rpcUrl: string,
      opts: { method: string; params: string; json?: boolean; quiet?: boolean }
    ) => {
      try {
        let paramsRaw = opts.params;

        // Support @file.json syntax
        if (paramsRaw.startsWith('@')) {
          const filePath = paramsRaw.slice(1);
          if (!fs.existsSync(filePath)) {
            throw new Error(`Params file not found: ${filePath}`);
          }
          paramsRaw = fs.readFileSync(filePath, 'utf-8').trim();
        }

        let params: unknown[];
        try {
          params = JSON.parse(paramsRaw) as unknown[];
        } catch {
          throw new Error(`Invalid JSON in --params: ${paramsRaw}`);
        }

        if (!Array.isArray(params)) {
          throw new Error('--params must be a JSON array');
        }

        const result = await rpcRequest<unknown>(rpcUrl, opts.method, params);

        printJson({ method: opts.method, result });
      } catch (err) {
        exitWithError(err, true);
      }
    });
}
