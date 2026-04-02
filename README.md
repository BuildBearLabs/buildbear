# BuildBear CLI

`buildbear` is the official CLI for the [BuildBear](https://app.buildbear.io) blockchain sandbox platform. It lets developers and AI agents manage sandboxes, fund wallets, take snapshots, and inspect contracts — entirely from the terminal.

## Install

```bash
curl -fsSL https://install.buildbear.io/cli | bash
```

Or via npm:

```bash
npm install -g buildbear
```

Requires Node.js 20+.

## Quick Start

```bash
# 1. Authenticate
buildbear auth setup

# 2. Create a sandbox
buildbear sandbox create --network mainnet --name my-env
# → RPC URL: https://rpc.buildbear.io/yielding-mysterio-055e0fb6

RPC=https://rpc.buildbear.io/yielding-mysterio-055e0fb6

# 3. Fund a wallet
buildbear faucet native $RPC --address 0xYourWallet --amount 10

# 4. Snapshot before tests
buildbear snapshot take $RPC
# → Snapshot: 0x1

# 5. Revert after tests
buildbear snapshot revert $RPC --snapshot 0x1

# 6. Clean up
buildbear sandbox delete $RPC
```

## Commands

### Authentication

```bash
buildbear auth setup      # Interactive wizard (first-time setup)
buildbear auth login      # Direct API key prompt
buildbear auth logout     # Clear stored credentials
buildbear auth status     # Show auth state
```

### Sandbox Management

```bash
buildbear sandbox create --network <chainId|name> [--fork-block N] [--chain-id N] [--prefund addr1,addr2]
buildbear sandbox list
buildbear sandbox delete <rpcUrl>
buildbear sandbox networks
buildbear status <rpcUrl>
```

### Faucet

```bash
buildbear faucet native <rpcUrl> --address <wallet> --amount <ether>
buildbear faucet erc20 <rpcUrl> --token <contractAddr> --address <wallet> --amount <amount>
```

### Snapshots

```bash
buildbear snapshot take <rpcUrl>
buildbear snapshot revert <rpcUrl> --snapshot <snapshotId>
```

### Contracts

```bash
buildbear contract source <rpcUrl> --address <contractAddr>
buildbear contract abi <rpcUrl> --address <contractAddr>
buildbear contract verify <rpcUrl> --address <contractAddr> --type etherscan|sourcify
```

### Utilities

```bash
buildbear rpc <rpcUrl> --method <method> --params '[...]'  # JSON-RPC passthrough
buildbear init                                              # Interactive project setup
buildbear --version
buildbear --help
```

## Global Flags

All commands support:
- `--json` — machine-readable JSON output (for CI and AI agents)
- `--quiet` — suppress all output except errors

## Authentication

API key is stored at `~/.config/buildbear/config.json` (mode 600).

Set `BUILDBEAR_API_KEY` environment variable to override (CI-safe):

```bash
export BUILDBEAR_API_KEY=your_key_here
buildbear sandbox list --json
```

## Project Config (`.buildbear.json`)

Run `buildbear init` in your project directory to create a local config file. When present, `rpcUrl` defaults are read from it so you don't need to pass them every time.

```json
{
  "rpcUrl": "https://rpc.buildbear.io/yielding-mysterio-055e0fb6",
  "network": "Ethereum Mainnet",
  "chainId": 1234,
  "explorerUrl": "https://explorer.buildbear.io/yielding-mysterio-055e0fb6"
}
```

## CI/CD (GitHub Actions)

```yaml
- name: Install BuildBear CLI
  run: npm install -g buildbear
  env:
    BUILDBEAR_API_KEY: ${{ secrets.BUILDBEAR_API_KEY }}

- name: Create sandbox
  run: |
    RPC_URL=$(buildbear sandbox create --network mainnet --json | jq -r .rpcUrl)
    echo "BB_RPC_URL=$RPC_URL" >> $GITHUB_ENV

- name: Run tests
  run: forge test --rpc-url $BB_RPC_URL

- name: Cleanup
  if: always()
  run: buildbear sandbox delete $BB_RPC_URL --json
```

## Agent Usage

```bash
# Always use --json for machine-readable output
RPC_URL=$(buildbear sandbox create --network mainnet --json | jq -r .rpcUrl)
buildbear faucet native $RPC_URL --address 0xWallet --amount 100 --json
SNAPSHOT=$(buildbear snapshot take $RPC_URL --json | jq -r .snapshotId)
buildbear snapshot revert $RPC_URL --snapshot $SNAPSHOT --json
buildbear sandbox delete $RPC_URL --json
```
