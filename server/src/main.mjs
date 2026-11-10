// PROVISIONAL — arranque del servidor de pautas. Ver README.md.
import { createServer } from 'node:http';
import { loadConfig } from './config.mjs';
import { openStore } from './store.mjs';
import { createApp } from './app.mjs';

const config = loadConfig();
const store = openStore(config.dataDir);
const server = createServer(createApp(config, store));
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;

const purge = () => {
  const n = store.purgeExpired(Date.now());
  if (n) console.log(`caducadas y borradas: ${n}`);
};
purge();
const timer = setInterval(purge, 60 * 60_000);

server.listen(config.port, config.host, () => console.log(`servidor de pautas en ${config.host}:${config.port} · enlaces con ${config.publicUrl}`));

const stop = () => {
  clearInterval(timer);
  server.close(() => { store.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
