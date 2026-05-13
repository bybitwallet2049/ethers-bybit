import 'dotenv/config';
import { ethers } from 'ethers';
import BybitAPI from 'bybit-api';
import axios from 'axios';
import * as bitcoin from 'bitcoinjs-lib';

// Example utilities for ethers (Ethereum), bybit-api (Bybit), and bitcoinjs-lib (Bitcoin)

// Ethers: create a wallet from private key and provider
export function createEthersWallet(privateKey?: string) {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error('RPC_URL is not set in environment');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  if (privateKey) {
    return new ethers.Wallet(privateKey, provider);
  }
  return provider;
}

// Bybit: create a client (bybit-api)
export function createBybitClient() {
  const key = process.env.BYBIT_API_KEY;
  const secret = process.env.BYBIT_API_SECRET;
  if (!key || !secret) throw new Error('BYBIT_API_KEY or BYBIT_API_SECRET not set');

  const client = new BybitAPI({
    key,
    secret,
    // default options; consult bybit-api docs for more configuration
  });
  return client;
}

// Example: fetch account balance using bybit-api (wrapper) or axios if you want custom call
export async function getBybitWalletBalance() {
  const client = createBybitClient();
  // the bybit-api library provides methods for REST endpoints; check its docs for exact method names
  // this is a generic example using axios to call a public Bybit endpoint
  try {
    const resp = await axios.get('https://api.bybit.com/v2/private/wallet/balance', {
      params: { // adjust params per Bybit API requirements
        // asset: 'USDT'
      }
    });
    return resp.data;
  } catch (err) {
    throw err;
  }
}

// Bitcoin: build a simple P2WPKH tx (example, NOT production-ready)
export function createBitcoinPayment({
  wif,
  toAddress,
  satoshis,
  network = process.env.BTC_NETWORK === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin,
}: {
  wif: string;
  toAddress: string;
  satoshis: number;
  network?: bitcoin.Network;
}) {
  const keyPair = bitcoin.ECPair.fromWIF(wif, network);
  const { address } = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network });
  if (!address) throw new Error('Failed to derive address');

  // NOTE: creating and signing a real transaction needs UTXO discovery and proper fee calculation.
  return { from: address, to: toAddress, amount: satoshis };
}

// Simple startup example
if (require.main === module) {
  (async () => {
    console.log('Example: ethers-bybit starter');
    console.log('ENV loaded:', !!process.env.BYBIT_API_KEY, !!process.env.RPC_URL);

    // show provider only (no private key used)
    try {
      const provider = createEthersWallet() as ethers.JsonRpcProvider;
      const block = await provider.getBlockNumber();
      console.log('Latest block:', block);
    } catch (e) {
      console.warn('Ethers example failed:', (e as Error).message);
    }

    // Bybit example (no sensitive logs)
    try {
      // const balance = await getBybitWalletBalance();
      // console.log('Bybit balance:', balance);
      console.log('Bybit client ready (not fetched in example)');
    } catch (e) {
      console.warn('Bybit example failed:', (e as Error).message);
    }
  })();
}
