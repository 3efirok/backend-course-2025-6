# Inventory Service — Lab 6

Express.js inventory service that lets you register items with photos, list/inspect them, update name/description, replace photos, delete items, and search via an HTML form.

Built with: **Node.js**, **Express**, **Commander**, **Multer**, **swagger-ui-express**, **superagent**, **nodemon**.

## Project layout

```
.
├── .gitignore
├── README.md
├── package.json
├── package-lock.json
├── index.js                # main entry point: CLI, Express, routes
├── swagger.js              # OpenAPI 3 document (separate module)
├── RegisterForm.html       # registration form (multipart/form-data)
├── SearchForm.html         # search form (x-www-form-urlencoded)
├── collection.json         # Postman collection (v2.1)
└── cache/                  # photo cache — created automatically on startup
```

## Install

```bash
npm install
```

Installs: `express`, `commander`, `multer`, `swagger-ui-express`, `superagent` + `nodemon` (dev).

## Run

The server requires three CLI arguments (Commander.js):

| Short | Long | Required | Meaning |
| --- | --- | --- | --- |
| `-h` | `--host`  | yes | host address (e.g. `127.0.0.1`) |
| `-p` | `--port`  | yes | port (e.g. `3000`) |
| `-c` | `--cache` | yes | path to the photo cache directory; created automatically if missing |

```bash
# direct
node index.js --host 127.0.0.1 --port 3000 --cache ./cache

# npm scripts
npm start         # node index.js --host 127.0.0.1 --port 3000 --cache ./cache
npm run dev       # same, but with nodemon for auto-restart
```

If any required argument is missing, Commander prints a clear error and the process exits with code 1.

On startup, the server logs:

```
Inventory service running at http://127.0.0.1:3000
Swagger UI available at  http://127.0.0.1:3000/api-docs
Cache directory:         /abs/path/to/cache
```

## Endpoint reference

Default base URL: `http://127.0.0.1:3000`.

Each item is represented as:

```json
{
  "id": 1,
  "inventory_name": "Drill",
  "description": "Cordless 18V",
  "photoUrl": "http://127.0.0.1:3000/cache/1700000000000-123456789.jpg"
}
```

### POST `/register`

Register a new inventory item.

- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `inventory_name` *(string, required)* — name of the item
  - `description` *(string, optional)* — free-form description
  - `photo` *(file, optional)* — any image; stored in the cache directory under a generated unique name
- **Responses:**
  - `201 Created` — JSON body of the created item, including `id` and `photoUrl`
  - `400 Bad Request` — `inventory_name` is missing or empty (any uploaded file is removed to avoid orphans)
  - `405 Method Not Allowed` — any method other than POST

```bash
# success
curl -i -X POST http://127.0.0.1:3000/register \
  -F "inventory_name=Drill" \
  -F "description=Cordless 18V" \
  -F "photo=@./drill.jpg"

# missing name → 400
curl -i -X POST http://127.0.0.1:3000/register -F "description=oops"
```

### GET `/inventory`

List all inventory items.

- **Responses:**
  - `200 OK` — JSON array of items (each: `id`, `inventory_name`, `description`, `photoUrl`)
  - `405 Method Not Allowed` — any method other than GET

```bash
curl http://127.0.0.1:3000/inventory
```

### GET `/inventory/:id`

Get one inventory item.

- **Path params:** `id` *(integer)*
- **Responses:**
  - `200 OK` — JSON body of the item
  - `404 Not Found` — no item with this id
  - `405 Method Not Allowed` — method other than GET / PUT / DELETE

```bash
curl http://127.0.0.1:3000/inventory/1
```

### PUT `/inventory/:id`

Update name and/or description.

- **Path params:** `id` *(integer)*
- **Content-Type:** `application/json`
- **Body (any subset):**
  - `inventory_name` *(string)*
  - `description` *(string)*
- **Responses:**
  - `200 OK` — JSON of the updated item
  - `404 Not Found` — no item with this id
  - `405 Method Not Allowed`

```bash
curl -X PUT http://127.0.0.1:3000/inventory/1 \
  -H "Content-Type: application/json" \
  -d '{"inventory_name":"Updated drill","description":"New desc"}'
```

### GET `/inventory/:id/photo`

Return the raw photo bytes for an item.

- **Path params:** `id` *(integer)*
- **Response headers:** `Content-Type: image/jpeg`
- **Responses:**
  - `200 OK` — image bytes
  - `404 Not Found` — item or photo missing
  - `405 Method Not Allowed`

```bash
curl -o photo.jpg http://127.0.0.1:3000/inventory/1/photo
```

### PUT `/inventory/:id/photo`

Replace the photo for an item. Old file is unlinked from the cache directory.

- **Path params:** `id` *(integer)*
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `photo` *(file, required)*
- **Responses:**
  - `200 OK` — JSON of the updated item with new `photoUrl`
  - `400 Bad Request` — no `photo` field in the request
  - `404 Not Found` — no item with this id
  - `405 Method Not Allowed`

```bash
curl -X PUT http://127.0.0.1:3000/inventory/1/photo \
  -F "photo=@./new.jpg"
```

### DELETE `/inventory/:id`

Remove an item; its photo file is also unlinked from the cache directory.

- **Path params:** `id` *(integer)*
- **Responses:**
  - `200 OK` — `{ "message": "Deleted", "id": <id> }`
  - `404 Not Found`
  - `405 Method Not Allowed`

```bash
curl -X DELETE http://127.0.0.1:3000/inventory/1
```

### POST `/search`

Form handler used by `SearchForm.html`. Renders an HTML page.

- **Content-Type:** `application/x-www-form-urlencoded`
- **Fields:**
  - `id` *(string, required)* — item id to look up
  - `has_photo` *(string, optional)* — when set to `true` / `on`, the response includes the photo link and an inline preview
- **Responses:**
  - `200 OK` — HTML page with the item details
  - `404 Not Found`
  - `405 Method Not Allowed`

```bash
curl -X POST http://127.0.0.1:3000/search -d "id=1&has_photo=true"
```

### GET `/RegisterForm.html` and GET `/SearchForm.html`

Serve the HTML forms. Open in a browser:

- <http://127.0.0.1:3000/RegisterForm.html> — POSTs to `/register` (multipart/form-data)
- <http://127.0.0.1:3000/SearchForm.html> — POSTs to `/search` (x-www-form-urlencoded)

### Method Not Allowed

Any unsupported method on a known route, **and any request to an unknown route**, returns `405 Method Not Allowed`.

```bash
curl -i -X DELETE http://127.0.0.1:3000/inventory      # 405
curl -i http://127.0.0.1:3000/totally-unknown-path     # 405
```

## Swagger / OpenAPI

The OpenAPI 3 specification lives in [`swagger.js`](swagger.js) — `index.js` only mounts it at runtime:

```js
const buildSwaggerDocument = require('./swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(buildSwaggerDocument(host, port)));
```

Open <http://127.0.0.1:3000/api-docs> — every endpoint, request body, and response code is documented there. The `servers` URL is filled in with the actual host/port the process was started with, so the **Try it out** button works without manual configuration.

To edit the spec, change `swagger.js` and restart the server (`npm run dev` reloads automatically).

## Postman collection

`collection.json` is a Postman v2.1 collection. To import:

1. Postman → **Import → File → Upload** → select `collection.json`.
2. The collection uses a `baseUrl` variable (default `http://127.0.0.1:3000`) — change it under **Variables** if needed.
3. For requests with file uploads (`Register item`, `Update photo`), pick a real file in the form-data `photo` field before sending.

Included requests:

- Register item
- Bad request without inventory_name *(expects 400)*
- Get all inventory
- Get inventory by ID
- Not found by wrong ID *(expects 404)*
- Update inventory
- Get photo
- Update photo
- Search inventory
- Delete inventory
- Register form (HTML) / Search form (HTML)

## Git history

The local repository has five logical commits matching the lab specification:

```
Add Swagger documentation and Postman collection
Add HTML forms and search endpoint
Add inventory API endpoints
Add command line arguments and server startup
Initial project setup
```

The `origin` remote is already configured (`git@github.com:3efirok/backend-course-2025-6.git`). Push with:

```bash
git push -u origin main
```
