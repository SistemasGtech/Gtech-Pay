/**
 * Capacitor resolve plugins via apps/pdv/node_modules/<pkg>/package.json.
 * Com npm workspaces o pacote fica na raiz; este link evita plugin nativo ausente no APK.
 */
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pdvRoot = join(root, 'apps', 'pdv');
const plugins = ['@devlas/capacitor-thermal-printer'];

for (const pkg of plugins) {
  const parts = pkg.split('/');
  const scope = parts.length === 2 ? parts[0] : null;
  const name = parts.length === 2 ? parts[1] : parts[0];
  const source = join(root, 'node_modules', ...parts);
  const linkDir = scope ? join(pdvRoot, 'node_modules', scope) : join(pdvRoot, 'node_modules');
  const linkPath = join(linkDir, name);

  if (!existsSync(source)) {
    console.warn(`[link-pdv-plugins] Pacote ausente (rode npm install): ${pkg}`);
    continue;
  }

  mkdirSync(linkDir, { recursive: true });
  if (existsSync(linkPath)) {
    try {
      rmSync(linkPath, { recursive: true, force: true });
    } catch {
      /* junction */
    }
  }

  try {
    symlinkSync(source, linkPath, 'junction');
    console.log(`[link-pdv-plugins] OK ${pkg}`);
  } catch (e) {
    console.warn(`[link-pdv-plugins] Falha ${pkg}:`, e);
  }
}
