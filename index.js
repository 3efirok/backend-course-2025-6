const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
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

const absoluteCacheDir = path.resolve(cacheDir);
if (!fs.existsSync(absoluteCacheDir)) {
  fs.mkdirSync(absoluteCacheDir, { recursive: true });
  console.log(`Cache directory created at: ${absoluteCacheDir}`);
}

// ---------- App setup ----------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/cache', express.static(absoluteCacheDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, absoluteCacheDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${unique}${ext}`);
  },
});
const upload = multer({ storage });

// ---------- In-memory storage ----------
let inventory = [];
let nextId = 1;

const buildPhotoUrl = (req, filename) =>
  filename ? `${req.protocol}://${req.get('host')}/cache/${filename}` : null;

// ---------- Routes ----------

// HTML forms.
app.get('/RegisterForm.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});
app.get('/SearchForm.html', (_req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

// POST /register — create a new inventory item.
app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name || inventory_name.trim() === '') {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).send('Bad Request: inventory_name is required');
  }

  const item = {
    id: nextId++,
    inventory_name: inventory_name.trim(),
    description: description || '',
    photo: req.file ? req.file.filename : null,
    photoUrl: req.file ? buildPhotoUrl(req, req.file.filename) : null,
  };
  inventory.push(item);
  res.status(201).json(item);
});

// GET /inventory — list everything.
app.get('/inventory', (req, res) => {
  const list = inventory.map((it) => ({
    id: it.id,
    inventory_name: it.inventory_name,
    description: it.description,
    photoUrl: it.photo ? buildPhotoUrl(req, it.photo) : null,
  }));
  res.status(200).json(list);
});

// GET /inventory/:id — single item.
app.get('/inventory/:id', (req, res) => {
  const item = inventory.find((it) => it.id === Number(req.params.id));
  if (!item) return res.status(404).send('Not Found');
  res.status(200).json({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photoUrl: item.photo ? buildPhotoUrl(req, item.photo) : null,
  });
});

// PUT /inventory/:id — update name/description.
app.put('/inventory/:id', (req, res) => {
  const item = inventory.find((it) => it.id === Number(req.params.id));
  if (!item) return res.status(404).send('Not Found');

  const { inventory_name, description } = req.body;
  if (inventory_name !== undefined) item.inventory_name = inventory_name;
  if (description !== undefined) item.description = description;

  res.status(200).json({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photoUrl: item.photo ? buildPhotoUrl(req, item.photo) : null,
  });
});

// GET /inventory/:id/photo — return the photo bytes.
app.get('/inventory/:id/photo', (req, res) => {
  const item = inventory.find((it) => it.id === Number(req.params.id));
  if (!item || !item.photo) return res.status(404).send('Not Found');

  const filePath = path.join(absoluteCacheDir, item.photo);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not Found');

  res.setHeader('Content-Type', 'image/jpeg');
  res.status(200).sendFile(filePath);
});

// PUT /inventory/:id/photo — replace the photo.
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const item = inventory.find((it) => it.id === Number(req.params.id));
  if (!item) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(404).send('Not Found');
  }
  if (!req.file) return res.status(400).send('Bad Request: photo is required');

  if (item.photo) {
    fs.unlink(path.join(absoluteCacheDir, item.photo), () => {});
  }
  item.photo = req.file.filename;
  item.photoUrl = buildPhotoUrl(req, req.file.filename);
  res.status(200).json(item);
});

// DELETE /inventory/:id — remove from list and unlink the photo file.
app.delete('/inventory/:id', (req, res) => {
  const idx = inventory.findIndex((it) => it.id === Number(req.params.id));
  if (idx === -1) return res.status(404).send('Not Found');

  const [removed] = inventory.splice(idx, 1);
  if (removed.photo) {
    fs.unlink(path.join(absoluteCacheDir, removed.photo), () => {});
  }
  res.status(200).json({ message: 'Deleted', id: removed.id });
});

// POST /search — form handler that renders an HTML response.
app.post('/search', (req, res) => {
  const { id, has_photo } = req.body;
  const item = inventory.find((it) => it.id === Number(id));
  if (!item) return res.status(404).send('Not Found');

  const includePhoto = has_photo === 'true' || has_photo === 'on' || has_photo === true;
  const photoLink = item.photo ? buildPhotoUrl(req, item.photo) : null;

  let html = `<!DOCTYPE html><html><body>
    <h2>Inventory item #${item.id}</h2>
    <p><strong>Name:</strong> ${item.inventory_name}</p>
    <p><strong>Description:</strong> ${item.description}</p>`;
  if (includePhoto && photoLink) {
    html += `<p><strong>Photo:</strong> <a href="${photoLink}">${photoLink}</a></p>
             <p><img src="${photoLink}" alt="photo" style="max-width:300px"></p>`;
  }
  html += `<p><a href="/SearchForm.html">Back to search</a></p></body></html>`;
  res.status(200).send(html);
});

// ---------- 405 Method Not Allowed ----------
// Express tries the handlers above first; these only fire when the method doesn't match.
app.all('/register', (req, res) => res.status(405).set('Allow', 'POST').send('Method Not Allowed'));
app.all('/inventory', (req, res) => res.status(405).set('Allow', 'GET').send('Method Not Allowed'));
app.all('/inventory/:id', (req, res) =>
  res.status(405).set('Allow', 'GET, PUT, DELETE').send('Method Not Allowed'),
);
app.all('/inventory/:id/photo', (req, res) =>
  res.status(405).set('Allow', 'GET, PUT').send('Method Not Allowed'),
);
app.all('/search', (req, res) => res.status(405).set('Allow', 'POST').send('Method Not Allowed'));

// Catch-all: any unknown route also returns 405 per lab spec.
app.all('*', (_req, res) => res.status(405).send('Method Not Allowed'));

// ---------- Start ----------
app.listen(Number(port), host, () => {
  console.log(`Inventory service running at http://${host}:${port}`);
  console.log(`Cache directory:         ${absoluteCacheDir}`);
});
