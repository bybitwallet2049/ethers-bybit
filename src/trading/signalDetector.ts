import axios from 'axios';
import fs from 'fs';
import path from 'path';

type Kline = { open_time: number; open: string; high: string; low: string; close: string; volume: string; };

const BYBIT_API_HOST = process.env.BYBIT_API_HOST || 'https://api.bybit.com'; // or testnet url

async function fetchKlines(symbol: string, interval = '1', limit = 200): Promise<Kline[]> {
  // Bybit V5 kline endpoint: GET /v5/market/kline?symbol=BTCUSDT&interval=1&limit=200
  const url = `${BYBIT_API_HOST}/v5/market/kline`;
  const resp = await axios.get(url, { params: { symbol, interval, limit } });
  // Response structure: resp.data.result.list = array of arrays [t, o, h, l, c, v, ...]
  const list = resp.data?.result?.list;
  if (!list) throw new Error('Invalid kline response');
  return list.map((row: any) => ({
    open_time: Number(row[0]),
    open: row[1],
    high: row[2],
    low: row[3],
    close: row[4],
    volume: row[5],
  }));
}

function toNumber(s: string) { return Number(s); }

// Ichimoku calculator
function ichimoku(lines: Kline[], tenkan = 9, kijun = 26, senkouB = 52) {
  const closes = lines.map(k => toNumber(k.close));
  const highs = lines.map(k => toNumber(k.high));
  const lows = lines.map(k => toNumber(k.low));

  const tenkanArr: (number | null)[] = [];
  const kijunArr: (number | null)[] = [];
  const senkouA: (number | null)[] = []; // shifted forward by kijun
  const senkouBArr: (number | null)[] = [];

  for (let i = 0; i < lines.length; i++) {
    // Tenkan (conversion): (9-period high + low)/2
    if (i + 1 >= tenkan) {
      const high = Math.max(...highs.slice(i + 1 - tenkan, i + 1));
      const low = Math.min(...lows.slice(i + 1 - tenkan, i + 1));
      tenkanArr[i] = (high + low) / 2;
    } else tenkanArr[i] = null;

    // Kijun (base): (26-period high + low)/2
    if (i + 1 >= kijun) {
      const high = Math.max(...highs.slice(i + 1 - kijun, i + 1));
      const low = Math.min(...lows.slice(i + 1 - kijun, i + 1));
      kijunArr[i] = (high + low) / 2;
    } else kijunArr[i] = null;

    // Senkou B: (52-period high+low)/2
    if (i + 1 >= senkouB) {
      const high = Math.max(...highs.slice(i + 1 - senkouB, i + 1));
      const low = Math.min(...lows.slice(i + 1 - senkouB, i + 1));
      senkouBArr[i] = (high + low) / 2;
    } else senkouBArr[i] = null;
  }

  // Senkou A is (tenkan + kijun)/2 shifted forward by kijun (i -> i + kijun)
  for (let i = 0; i < lines.length; i++) {
    const t = tenkanArr[i];
    const k = kijunArr[i];
    const val = (t !== null && k !== null) ? (t + k) / 2 : null;
    const targetIndex = i + kijun;
    if (targetIndex < lines.length) {
      senkouA[targetIndex] = val;
    }
  }

  return {
    tenkan: tenkanArr,
    kijun: kijunArr,
    senkouA,
    senkouB: senkouBArr,
  };
}

function avgVolume(lines: Kline[], lookback = 20) {
  const vols = lines.slice(-lookback).map(k => toNumber(k.volume));
  return vols.reduce((a, b) => a + b, 0) / vols.length;
}

type Signal = {
  timestamp: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  price: number;
  volume: number;
  uid?: string;
  reason?: string;
};

const OUTPATH = path.resolve(process.cwd(), 'signals.jsonl');
function persistSignal(sig: Signal) {
  const line = JSON.stringify(sig) + '\n';
  fs.appendFileSync(OUTPATH, line, { encoding: 'utf8' });
}

export async function detectSignalForSymbol(symbol: string, opts?: {
  interval?: string;
  uid?: string;
  volumeMultiplier?: number;
}) : Promise<Signal | null> {
  const interval = opts?.interval || '1'; // 1-minute default
  const uid = opts?.uid;
  const volMultiplier = opts?.volumeMultiplier ?? 1.0;

  const klines = await fetchKlines(symbol, interval, 200);
  if (klines.length < 60) return null;

  const ich = ichimoku(klines);
  const lastIdx = klines.length - 1;
  const price = toNumber(klines[lastIdx].close);
  const v = toNumber(klines[lastIdx].volume);
  const avgVol = avgVolume(klines, 20);

  const senA = ich.senkouA[lastIdx] ?? null;
  const senB = ich.senkouB[lastIdx] ?? null;

  let signal: Signal | null = null;

  if (senA !== null && senB !== null) {
    const cloudBull = senA > senB;
    const cloudBear = senA < senB;

    // long if price above both spans and cloud bullish and volume high enough
    if (price > senA && price > senB && cloudBull && v >= avgVol * volMultiplier) {
      signal = {
        timestamp: Date.now(),
        symbol,
        side: 'LONG',
        price,
        volume: v,
        uid,
        reason: `price>${senA.toFixed(2)},${senB.toFixed(2)} cloudBull vol ${v} avg ${avgVol.toFixed(2)}`,
      };
    } else if (price < senA && price < senB && cloudBear && v >= avgVol * volMultiplier) {
      signal = {
        timestamp: Date.now(),
        symbol,
        side: 'SHORT',
        price,
        volume: v,
        uid,
        reason: `price<${senA.toFixed(2)},${senB.toFixed(2)} cloudBear vol ${v} avg ${avgVol.toFixed(2)}`,
      };
    }
  }

  if (signal) {
    persistSignal(signal);
    console.log('Signal detected:', signal);
  } else {
    console.log(`[no-signal] ${symbol} price=${price} vol=${v} avgVol=${avgVol.toFixed(2)}`);
  }

  return signal;
}

// Example runner
if (require.main === module) {
  (async () => {
    try {
      // pairs to monitor
      const pairs = ['BTCUSDT', 'ETHUSDT']; // Bybit symbol format
      const uid = process.env.BYBIT_UID || 'local-uid';
      for (const p of pairs) {
        await detectSignalForSymbol(p, { interval: '1', uid, volumeMultiplier: 1.2 });
      }
    } catch (err) {
      console.error('error detect', err);
    }
  })();
}
