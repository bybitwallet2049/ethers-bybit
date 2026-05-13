import { ethers } from 'ethers';

export async function startEthSync() {
  const ethUrl = process.env.ETH_NODE_URL || process.env.RPC_URL || 'http://127.0.0.1:8545';
  console.log('[ethSync] connecting to', ethUrl);
  const provider = new ethers.JsonRpcProvider(ethUrl);

  provider.on('block', async (blockNumber: number) => {
    try {
      console.log(`[eth] new block: ${blockNumber}`);
      const block = await provider.getBlock(blockNumber);
      console.log(`[eth] block ${blockNumber} hash=${block.hash} txs=${block.transactions?.length ?? 0}`);
      // TODO: persist block info to DB or process transactions
    } catch (err) {
      console.error('[eth] error fetching block', err);
    }
  });

  provider._start(); // ensure provider active (no-op in many environments)
  console.log('[ethSync] started');
}
