// Leitor da nota com o PaddleOCR, rodando no próprio celular (sem servidor): acerta bem mais
// que o Tesseract em foto de cupom. Os arquivos vêm do próprio site (/ocr, ver scripts/copy-ocr.mjs)
// e ficam guardados no aparelho depois do primeiro uso.

import type * as Ort from 'onnxruntime-web';
import { parseReceipt } from './parse';
import { findBoxes, ctcDecode, joinLines, type TextBox } from './paddleCore';
import { prepareReceipt, straighten, type Quad } from './prepare';
import type { ReadProgress, ReceiptReader } from './reader';

const BASE = '/ocr/paddle-v1';
/** Maior lado da imagem no detector: as letras do cupom precisam continuar legíveis. */
const DET_EDGE = 1920;
/** Altura e largura máxima da linha no reconhecedor. */
const REC_HEIGHT = 48;
const REC_MAX_WIDTH = 1280;

interface Engine {
  ort: typeof Ort;
  det: Ort.InferenceSession;
  rec: Ort.InferenceSession;
  chars: string[];
}

let loading: Promise<Engine> | null = null;

async function load(report: (p: ReadProgress) => void): Promise<Engine> {
  report({ fraction: 0.05, label: 'Preparando o leitor…' });
  // Fora do pacote do app (são pesados e só quem lê nota precisa): vem direto de /ocr.
  const url = `${window.location.origin}/ocr/ort/ort.wasm.min.mjs`;
  const ort = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)) as typeof Ort;
  ort.env.wasm.wasmPaths = `${window.location.origin}/ocr/ort/`;
  // Em outra linha de execução, para a tela não travar enquanto lê.
  ort.env.wasm.proxy = true;
  ort.env.wasm.numThreads = 1;
  report({ fraction: 0.1, label: 'Carregando o leitor…' });
  const options: Ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'] };
  const [det, rec, dict] = await Promise.all([
    ort.InferenceSession.create(`${BASE}/det.onnx`, options),
    ort.InferenceSession.create(`${BASE}/rec.onnx`, options),
    fetch(`${BASE}/dict.txt`).then((r) => {
      if (!r.ok) throw new Error('sem dicionário');
      return r.text();
    }),
  ]);
  return { ort, det, rec, chars: [...dict.replace(/\r/g, '').replace(/\n$/, '').split('\n'), ' '] };
}

/** Imagem cinza como entrada da rede: 3 canais iguais, de -1 a 1. */
function tensor(ort: typeof Ort, gray: Uint8ClampedArray, w: number, h: number): Ort.Tensor {
  const data = new Float32Array(3 * w * h);
  for (let i = 0; i < w * h; i++) {
    const v = gray[i] / 127.5 - 1;
    data[i] = v;
    data[w * h + i] = v;
    data[2 * w * h + i] = v;
  }
  return new ort.Tensor('float32', data, [1, 3, h, w]);
}

/** Acha as caixas de texto, nas coordenadas da imagem preparada. */
async function detect(e: Engine, page: HTMLCanvasElement): Promise<Quad[]> {
  const scale = Math.min(1, DET_EDGE / Math.max(page.width, page.height));
  // O detector só aceita múltiplos de 32.
  const w = Math.max(32, Math.round((page.width * scale) / 32) * 32);
  const h = Math.max(32, Math.round((page.height * scale) / 32) * 32);
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const ctx = small.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('sem canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(page, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = px[i * 4];
  const input = tensor(e.ort, gray, w, h);
  const out = await e.det.run({ [e.det.inputNames[0]]: input });
  input.dispose();
  const map = out[e.det.outputNames[0]];
  const boxes = findBoxes(map.data as Float32Array, w, h);
  map.dispose();
  const kx = page.width / w;
  const ky = page.height / h;
  return boxes.map((q) => q.map((p) => ({ x: p.x * kx, y: p.y * ky })) as Quad);
}

/** Lê o texto de uma caixa. */
async function recognize(e: Engine, rgba: Uint8ClampedArray, pw: number, ph: number, q: Quad): Promise<string> {
  const len = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
  const tall = Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y);
  const w = Math.min(REC_MAX_WIDTH, Math.max(32, Math.round((len / Math.max(1, tall)) * REC_HEIGHT)));
  const input = tensor(e.ort, straighten(rgba, pw, ph, q, w, REC_HEIGHT), w, REC_HEIGHT);
  const out = await e.rec.run({ [e.rec.inputNames[0]]: input });
  input.dispose();
  const scores = out[e.rec.outputNames[0]];
  const [, steps, classes] = scores.dims;
  const text = ctcDecode(scores.data as Float32Array, steps, classes, e.chars);
  scores.dispose();
  return text;
}

export const paddleReader: ReceiptReader = {
  async read(image, onProgress, signal) {
    const stopIfCancelled = () => {
      if (signal.aborted) throw new DOMException('cancelado', 'AbortError');
    };
    const report = (p: ReadProgress) => !signal.aborted && onProgress(p);
    report({ fraction: 0.02, label: 'Ajustando a foto…' });
    const page = await prepareReceipt(image);
    stopIfCancelled();

    loading ??= load(report).catch((err) => {
      loading = null; // deixa tentar de novo na próxima foto
      throw err;
    });
    const engine = await loading;
    stopIfCancelled();

    report({ fraction: 0.2, label: 'Procurando o texto…' });
    const quads = await detect(engine, page);
    stopIfCancelled();

    const ctx = page.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('sem canvas');
    const rgba = ctx.getImageData(0, 0, page.width, page.height).data;
    const boxes: TextBox[] = [];
    for (let i = 0; i < quads.length; i++) {
      report({ fraction: 0.3 + (0.68 * i) / quads.length, label: 'Lendo os itens da nota…' });
      boxes.push({ corners: quads[i], text: await recognize(engine, rgba, page.width, page.height, quads[i]) });
      stopIfCancelled();
    }
    report({ fraction: 1, label: 'Pronto' });
    return parseReceipt(joinLines(boxes));
  },
};
