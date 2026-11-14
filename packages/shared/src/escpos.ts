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

/** Tabela PC437 — comum em MPT-II / impressoras 58mm chinesas em modo Latin */
function cmdCharsetPc437(): Uint8Array {
  return new Uint8Array([ESC, 0x74, 0]);
}

function cmdPrinterReady(): Uint8Array {
  return concatBytes([cmdInit(), cmdCharsetPc437(), new Uint8Array([ESC, 0x32])]);
}

function cmdAlign(align: 'left' | 'center' | 'right'): Uint8Array {
  const n = align === 'left' ? 0 : align === 'center' ? 1 : 2;
  return new Uint8Array([ESC, 0x61, n]);
}

function cmdBold(on: boolean): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 1 : 0]);
}

function cmdTextLine(text: string): Uint8Array {
  return concatBytes([encodeText(text), new Uint8Array([0x0d, 0x0a])]);
}

function cmdCutPaper(feedLines = 4): Uint8Array {
  const n = Math.min(255, Math.max(1, feedLines));
  // Avanca papel e corte total (GS V 0) — acionam guilhotina na MPT-II e similares
  return concatBytes([cmdFeed(n), new Uint8Array([GS, 0x56, 0x00])]);
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

function formatBrl(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

/** Linha com texto à esquerda e valor à direita (largura em caracteres). */
function lineLeftRight(left: string, right: string, width: number): string {
  const l = normalizePrintText(left);
  const r = normalizePrintText(right);
  const gap = width - l.length - r.length;
  if (gap >= 1) return l + ' '.repeat(gap) + r;
  const maxLeft = Math.max(1, width - r.length - 1);
  return `${l.slice(0, maxLeft)} ${r}`;
}

function buildViaProducao(venda: Venda, loja: LojaInfo, chars: number): Uint8Array {
  const parts: Uint8Array[] = [
    cmdPrinterReady(),
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
    cmdTextLine('-'.repeat(chars)),
  );

  for (const it of venda.itens) {
    parts.push(
      cmdBold(true),
      cmdTextLine(lineLeftRight(`${it.quantidade}x ${it.nome}`, formatBrl(it.subtotal), chars)),
      cmdBold(false),
    );
    for (const o of it.opcoes) {
      const extra = o.preco > 0 ? ` +${formatBrl(o.preco)}` : '';
      parts.push(cmdTextLine(`  * ${o.nome}${extra}`));
    }
    if (it.observacao) parts.push(cmdBold(true), cmdTextLine(`OBS: ${it.observacao}`), cmdBold(false));
    // Linha vazia entre itens — separa pedidos na cozinha/produção
    parts.push(cmdTextLine(''));
  }

  const qtd = venda.itens.reduce((s, i) => s + i.quantidade, 0);
  parts.push(
    cmdTextLine('-'.repeat(chars)),
    cmdTextLine(`Itens: ${qtd}`),
    cmdBold(true),
    cmdTextLine(lineLeftRight('TOTAL', formatBrl(venda.total), chars)),
    cmdBold(false),
    cmdTextLine(`Pagamento: ${venda.pagamento}`),
  );
  if (venda.pagamento === 'Dinheiro') {
    parts.push(
      cmdTextLine(lineLeftRight('Recebido', formatBrl(venda.valorRecebido), chars)),
      cmdTextLine(lineLeftRight('Troco', formatBrl(venda.troco), chars)),
    );
  }
  parts.push(cmdFeed(2));
  return concatBytes(parts);
}

/** 2a via: senha para o cliente + nome da empresa */
function buildViaCliente(venda: Venda, loja: LojaInfo): Uint8Array {
  const senha = venda.senha?.trim();
  if (!senha) {
    return concatBytes([cmdFeed(1)]);
  }

  return concatBytes([
    cmdAlign('center'),
    cmdBold(true),
    cmdTextLine(loja.nome),
    cmdBold(false),
    cmdTextLine('2a VIA - CLIENTE'),
    cmdTextLine(''),
    cmdTextSize(2, 2),
    cmdBold(true),
    cmdTextLine(`#${senha}`),
    cmdBold(false),
    cmdTextSize(1, 1),
    cmdFeed(2),
  ]);
}

export function buildTwoViaReceipt(venda: Venda, loja: LojaInfo, config: PrinterConfig): Uint8Array {
  const chars = config.larguraPapel === '58mm' ? 32 : 42;
  const producao = buildViaProducao(venda, loja, chars);
  const chunks: Uint8Array[] = [producao];

  if (venda.senha?.trim()) {
    chunks.push(cmdCutPaper(5), buildViaCliente(venda, loja));
  }

  chunks.push(cmdCutPaper(6));
  return concatBytes(chunks);
}

/** Cupom minimo para teste (MPT-II e similares) — poucos comandos ESC/POS */
export function buildSimpleTestReceipt(loja: LojaInfo): Uint8Array {
  return concatBytes([
    cmdPrinterReady(),
    cmdAlign('center'),
    cmdBold(true),
    cmdTextLine('GTech PDV'),
    cmdTextLine('TESTE IMPRESSAO'),
    cmdBold(false),
    cmdTextLine(loja.nome),
    cmdTextLine(''),
    cmdAlign('left'),
    cmdTextLine('Bluetooth OK'),
    cmdTextLine('Senha #99'),
    cmdTextLine('1x TESTE - R$ 1,00'),
    cmdFeed(4),
    cmdCutPaper(5),
    cmdFeed(2),
  ]);
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}
