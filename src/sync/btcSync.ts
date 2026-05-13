import axios from 'axios';
import https from 'https';

async function createBtcClient() {
  const url = process.env.BITCOIN_RPC_URL || 'https://127.0.0.1:8332';
  const username = process.env.BITCOIN_RPC_USER || '';
  const password = process.env.BITCOIN_RPC_PASS || '';
  const insecure = process.env.BITCOIN_RPC_INSECURE === 'true';

  const httpsAgent = new https.Agent({ rejectUnauthorized: !insecure });

  const client = axios.create({
    baseURL: url,
    httpsAgent,
    auth: {
      username,
      password,
    },
    headers: { 'Content-Type': 'application/json' },
    timeout: 5000,
  });

  return client;
}

export async function startBtcSync() {
  const client = await createBtcClient();
  console.log('[btcSync] connecting to', process.env.BITCOIN_RPC_URL || 'https://127.0.0.1:8332');

  let lastKnown = -1;

  async function poll() {
    try {
      const res = await client.post('', {
        jsonrpc: '1.0',
        id: '1',
        method: 'getblockcount',
        params: [],
      });
      const height: number = res.data.result;
      if (lastKnown < 0) lastKnown = height - 1;

      if (height > lastKnown) {
        for (let i = lastKnown + 1; i <= height; i++) {
          try {
            const hashRes = await client.post('', {
              jsonrpc: '1.0',
              id: '1',
              method: 'getblockhash',
              params: [i],
            });
            const hash = hashRes.data.result;
            const blockRes = await client.post('', {
              jsonrpc: '1.0',
              id: '1',
              method: 'getblock',
              params: [hash],
            });
            const block = blockRes.data.result;
            console.log(`[btc] block ${i} hash=${hash} txs=${block.tx.length}`);
            // TODO: process txs or persist as needed
          } catch (err) {
            console.warn('[btc] error processing block', i, err.message || err);
          }
        }
        lastKnown = height;
      }
    } catch (err) {
      console.error('[btc] poll error', err.message || err);
    } finally {
      setTimeout(poll, Number(process.env.BTC_POLL_INTERVAL_MS || 5000));
    }
  }

  poll();
  console.log('[btcSync] started');
}
