const fs = require('fs');
const path = require('path');
const express = require('express');
const { Command } = require('commander');
const superagent = require('superagent');

// ---------- CLI arguments ----------
const program = new Command();
program
  .requiredOption('-h, --host <host>', 'server host address')
  .requiredOption('-p, --port <port>', 'server port')
  .requiredOption('-c, --cache <path>', 'path to cache directory for uploaded photos');

try {
  program.parse(process.argv);
} catch (err) {
  console.error('Error: missing required CLI arguments. Use --host <host> --port <port> --cache <path>.');
  process.exit(1);
}

const { host, port, cache: cacheDir } = program.opts();

// Auto-create the cache directory if it does not exist.
const absoluteCacheDir = path.resolve(cacheDir);
if (!fs.existsSync(absoluteCacheDir)) {
  fs.mkdirSync(absoluteCacheDir, { recursive: true });
  console.log(`Cache directory created at: ${absoluteCacheDir}`);
}

// ---------- App setup ----------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Start ----------
app.listen(Number(port), host, () => {
  console.log(`Inventory service running at http://${host}:${port}`);
  console.log(`Cache directory:         ${absoluteCacheDir}`);
});
