import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'buildbear');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
  apiKey?: string;
}

export function getApiKey(): string {
  // Env var takes precedence
  if (process.env.BUILDBEAR_API_KEY) {
    return process.env.BUILDBEAR_API_KEY;
  }
  const config = loadConfig();
  if (!config.apiKey) {
    throw new Error(
      "Not authenticated. Run 'buildbear auth setup' to get started, or set BUILDBEAR_API_KEY env var."
    );
  }
  return config.apiKey;
}

export function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as Config;
  } catch {
    return {};
  }
}

export function saveConfig(config: Config): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}

export function isAuthenticated(): boolean {
  if (process.env.BUILDBEAR_API_KEY) return true;
  const config = loadConfig();
  return !!config.apiKey;
}

export function getConfigFilePath(): string {
  return CONFIG_FILE;
}

interface ProjectConfig {
  rpcUrl?: string;
  forkChainId?: number;
  [key: string]: unknown;
}

export function getProjectRpcUrl(): string | null {
  const projectConfigPath = path.join(process.cwd(), '.buildbear.json');
  if (!fs.existsSync(projectConfigPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(projectConfigPath, 'utf-8');
    const config = JSON.parse(raw) as ProjectConfig;
    return config.rpcUrl ?? null;
  } catch {
    return null;
  }
}
