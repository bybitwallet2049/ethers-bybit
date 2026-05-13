import './../../../node_modules/dotenv/config';
import { startEthSync } from './ethSync';
import { startBtcSync } from './btcSync';

async function main() {
  console.log('Starting sync services...');
  try {
    startEthSync();
  } catch (err) {
    console.error('Failed to start eth sync', err);
  }
  try {
    startBtcSync();
  } catch (err) {
    console.error('Failed to start btc sync', err);
  }
}

main();

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection', reason);
});

process.on('uncaughtException', (err) => {
  console.error('uncaughtException', err);
  process.exit(1);
});
