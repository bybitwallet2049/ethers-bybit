import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

type AnyObject = Record<string, any>;

/**
 * Load a YAML config file with ${VAR} placeholders and substitute from process.env.
 * - Reads file at configPath (relative to project root).
 * - Replaces ${VAR_NAME} with process.env.VAR_NAME (if set), otherwise leaves blank or fallback.
 */
export function loadConfigFile(configPath = path.resolve(process.cwd(), 'config/viribele.yaml'), fallback: AnyObject = {}): AnyObject {
  const raw = fs.readFileSync(configPath, 'utf8');

  // Replace ${VAR_NAME} with process.env.VAR_NAME || fallback.VAR_NAME || ''
  const replaced = raw.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name: string) => {
    if (process.env[name] !== undefined) return process.env[name] as string;
    if (fallback[name] !== undefined) return String(fallback[name]);
    return '';
  });

  // Parse YAML to object
  const parsed = yaml.load(replaced) as AnyObject;
  return parsed || {};
}

// If run directly, load dotenv and print config (dev only)
if (require.main === module) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config();
  } catch (e) {
    /* ignore if dotenv not installed */
  }

  const cfg = loadConfigFile();
  // Mask secrets when printing
  const masked = JSON.parse(JSON.stringify(cfg));
  if (masked.bybit && masked.bybit.api_secret) masked.bybit.api_secret = '***';
  if (masked.wallet && masked.wallet.eth_private_key_buffer) masked.wallet.eth_private_key_buffer = '***';
  if (masked.wallet && masked.wallet.btc_private_key_buffer) masked.wallet.btc_private_key_buffer = '***';

  // eslint-disable-next-line no-console
  console.log('Loaded config:', JSON.stringify(masked, null, 2));
}
