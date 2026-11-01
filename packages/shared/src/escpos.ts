import type { LojaInfo, PrinterConfig, Venda } from './types';

/** Remove acentos para impressoras ESC/POS básicas */
export function normalizePrintText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n\r]/g, '?');
}

function encodeText(text: string): Uint8Array {
  const normalized = normalizePrintText(text);
  const bytes = new Uint8Array(normalized.length);
  for (let i = 0; i < normalized.length; i++) bytes[i] = normalized.charCodeAt(i);
  return bytes;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

const ESC = 0x1b;
const GS = 0x1d;

function cmdInit(): Uint8Array {
  return new Uint8Array([ESC, 0x40]);
}

function cmdAlign(align: 'left' | 'center' | 'right'): Uint8Array {
  const n = align === 'left' ? 0 : align === 'center' ? 1 : 2;
  return new Uint8Array([ESC, 0x61, n]);
}

function cmdBold(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 1 : 0]);
}

function cmdTextLine(text: string): Uint8Array {
  return concatBytes([encodeText(text), new Uint8Array([0x0a])]);
}

function cmdCut(): Uint8Array {
  return new Uint8Array([GS, 0x56, 0x00]);
}

function cmdFeed(lines = 3): Uint8Array {
  return new Uint8Array([ESC, 0x64, lines]);
}

/** GS ! — escala de caractere (1–8) */
function cmdTextSize(width: number, height: number): Uint8Array {
  const w = Math.min(8, Math.max(1, width)) - 1;
  const h = Math.min(8, Math.max(1, height)) - 1;
  return new Uint8Array([GS, 0x21, (w << 4) | h]);
}

function buildViaProducao(venda: Venda, loja: LojaInfo, chars: number): Uint8Array {
  const parts: Uint8Array[] = [
    cmdInit(),
    cmdAlign('center'),
    cmdBold(true),
    cmdTextLine('*** 1a VIA - PRODUCAO ***'),
    cmdBold(false),
    cmdTextLine(loja.nome),
    cmdTextLine(`${venda.data} ${venda.hora}`),
    cmdTextLine(''),
  ];

  if (venda.senha?.trim()) {
    parts.push(
      cmdBold(true),
      cmdTextLine('SENHA'),
      cmdTextSize(2, 2),
      cmdTextLine(`#${venda.senha}`),
      cmdTextSize(1, 1),
      cmdBold(false),
      cmdTextLine(''),
    );
  }

  parts.push(
    cmdAlign('left'),
    cmdTextLine(`CLIENTE: ${venda.cliente}`),
    cmdTextLine('-'.repeat(chars)),
  );

  for (const it of venda.itens) {
    parts.push(cmdBold(true), cmdTextLine(`${it.quantidade}x ${it.nome}`), cmdBold(false));
    for (const o of it.opcoes) parts.push(cmdTextLine(`  * ${o.nome}`));
    if (it.observacao) parts.push(cmdBold(true), cmdTextLine(`OBS: ${it.observacao}`), cmdBold(false));
  }

  const qtd = venda.itens.reduce((s, i) => s + i.quantidade, 0);
  parts.push(
    cmdTextLine('-'.repeat(chars)),
    cmdTextLine(`Itens: ${qtd}`),
    cmdTextLine(`Pagamento: ${venda.pagamento}`),
    cmdFeed(2),
  );
  return concatBytes(parts);
}

/** 2a via: somente numero da senha para o cliente */
function buildViaCliente(venda: Venda): Uint8Array {
  const senha = venda.senha?.trim();
  if (!senha) {
    return concatBytes([cmdInit(), cmdFeed(1)]);
  }

  return concatBytes([
    cmdInit(),
    cmdAlign('center'),
    cmdTextSize(3, 3),
    cmdBold(true),
    cmdTextLine(`#${senha}`),
    cmdBold(false),
    cmdTextSize(1, 1),
    cmdFeed(4),
  ]);
}

export function buildTwoViaReceipt(venda: Venda, loja: LojaInfo, config: PrinterConfig): Uint8Array {
  const chars = config.larguraPapel === '58mm' ? 32 : 42;
  const producao = buildViaProducao(venda, loja, chars);
  const chunks: Uint8Array[] = [producao];

  if (venda.senha?.trim()) {
    chunks.push(
      concatBytes([cmdAlign('center'), cmdTextLine('- - - CORTE - - -'), cmdFeed(1)]),
      buildViaCliente(venda),
    );
  }

  chunks.push(cmdCut(), cmdFeed(3));
  return concatBytes(chunks);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
