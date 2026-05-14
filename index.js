const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { Command } = require('commander');
const swaggerUi = require('swagger-ui-express');
// superagent is required by the lab specification, even though we don't actively use it.
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
  console.error('Error: missing required CLI arguments. Use -h <host> -p <port> -c <cachePath>.');
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

// Static access to forms
app.use(express.static(__dirname));

// Multer storage: keep original extension, give the file a unique name.
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

// Expose cached files (so photoUrl works in the browser).
app.use('/cache', express.static(absoluteCacheDir));

// ---------- Swagger ----------
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Inventory Service API',
    version: '1.0.0',
    description: 'Lab 6 — Inventory service. Express + Commander + Multer + Swagger.',
  },
  servers: [{ url: `http://${host}:${port}` }],
  paths: {
    '/register': {
      post: {
        summary: 'Register a new inventory item',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['inventory_name'],
                properties: {
                  inventory_name: { type: 'string' },
                  description: { type: 'string' },
                  photo: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created' },
          400: { description: 'Bad Request — inventory_name is missing' },
        },
      },
    },
    '/inventory': {
      get: {
        summary: 'Get all inventory items',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/inventory/{id}': {
      get: {
        summary: 'Get one inventory item by id',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } },
      },
      put: {
        summary: 'Update an inventory item',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  inventory_name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } },
      },
      delete: {
        summary: 'Delete an inventory item',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } },
      },
    },
    '/inventory/{id}/photo': {
      get: {
        summary: 'Get the photo of an item',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK — image/jpeg' }, 404: { description: 'Not Found' } },
      },
      put: {
        summary: 'Update the photo of an item',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { photo: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } },
      },
    },
    '/search': {
      post: {
        summary: 'Search an item by id (HTML form handler)',
        requestBody: {
          required: true,
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'string' },
                  has_photo: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } },
      },
    },
    '/RegisterForm.html': { get: { summary: 'Inventory registration HTML form', responses: { 200: { description: 'OK' } } } },
    '/SearchForm.html': { get: { summary: 'Inventory search HTML form', responses: { 200: { description: 'OK' } } } },
  },
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ---------- Routes ----------

// HTML forms — explicit routes (in addition to express.static) for clarity.
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
    // Remove the uploaded file if validation failed — no orphan files in cache.
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

  // Remove the old file if there was one.
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

// POST /search — handler for SearchForm.html.
app.post('/search', (req, res) => {
  const { id, has_photo } = req.body;
  const item = inventory.find((it) => it.id === Number(id));
  if (!item) return res.status(404).send('Not Found');

  const includePhoto = has_photo === 'true' || has_photo === 'on' || has_photo === true;
  const photoLink = item.photo ? buildPhotoUrl(req, item.photo) : null;

  // Render simple HTML so the form result is human-readable.
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
// Each route only declares the methods we support above — anything else returns 405.
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
  console.log(`Swagger UI available at  http://${host}:${port}/api-docs`);
  console.log(`Cache directory:         ${absoluteCacheDir}`);
});
