# Inventory Service — Lab 6

Express.js inventory service that lets you register items with photos, list/inspect them, update name/description, replace photos, delete items, and search via an HTML form.

Built with: **Node.js**, **Express**, **Commander**, **Multer**, **swagger-ui-express**, **superagent**, **nodemon**.

## Files

```
.
├── .gitignore
├── README.md
├── package.json
├── package-lock.json
├── index.js                # main entry point
├── RegisterForm.html       # registration form
├── SearchForm.html         # search form
├── collection.json         # Postman collection (v2.1)
└── cache/                  # created automatically on startup
```

## Install

```bash
npm install
```

## Run

The server requires three CLI arguments:

| Flag | Long form | Meaning |
| --- | --- | --- |
| `-h` | `--host` | host address |
| `-p` | `--port` | port |
| `-c` | `--cache` | path to the photo cache directory (created automatically if missing) |

```bash
# direct
node index.js --host 127.0.0.1 --port 3000 --cache ./cache

# npm scripts
npm start         # node index.js ...
npm run dev       # nodemon index.js ...
```

If any required argument is missing, the program prints an error and exits.

## URLs

- Service: <http://127.0.0.1:3000>
- Swagger UI: <http://127.0.0.1:3000/api-docs>
- Registration form: <http://127.0.0.1:3000/RegisterForm.html>
- Search form: <http://127.0.0.1:3000/SearchForm.html>

## API

| Method | Path | Description |
| --- | --- | --- |
| POST   | `/register`               | create item (multipart/form-data, fields `inventory_name`, `description`, `photo`) — **201** on success, **400** if `inventory_name` missing |
| GET    | `/inventory`              | list all items — **200** |
| GET    | `/inventory/:id`          | one item — **200** / **404** |
| PUT    | `/inventory/:id`          | update name and/or description (JSON) — **200** / **404** |
| GET    | `/inventory/:id/photo`    | photo bytes (`Content-Type: image/jpeg`) — **200** / **404** |
| PUT    | `/inventory/:id/photo`    | replace photo (multipart, field `photo`) — **200** / **404** |
| DELETE | `/inventory/:id`          | remove item and unlink its photo — **200** / **404** |
| GET    | `/RegisterForm.html`      | registration HTML form |
| GET    | `/SearchForm.html`        | search HTML form |
| POST   | `/search`                 | search by id (x-www-form-urlencoded, fields `id`, `has_photo`) — **200** / **404** |

Any other HTTP method on these (or any unknown) routes returns **405 Method Not Allowed**.

## Quick test with curl

```bash
# register (no name → 400)
curl -i -X POST http://127.0.0.1:3000/register -F "description=oops"

# register with photo
curl -i -X POST http://127.0.0.1:3000/register \
  -F "inventory_name=Drill" \
  -F "description=Cordless 18V" \
  -F "photo=@/path/to/photo.jpg"

# list
curl http://127.0.0.1:3000/inventory

# get one
curl http://127.0.0.1:3000/inventory/1

# update
curl -X PUT http://127.0.0.1:3000/inventory/1 \
  -H "Content-Type: application/json" \
  -d '{"inventory_name":"Updated drill","description":"New desc"}'

# fetch photo
curl -o photo.jpg http://127.0.0.1:3000/inventory/1/photo

# update photo
curl -X PUT http://127.0.0.1:3000/inventory/1/photo \
  -F "photo=@/path/to/new.jpg"

# search via form handler
curl -X POST http://127.0.0.1:3000/search -d "id=1&has_photo=true"

# delete
curl -X DELETE http://127.0.0.1:3000/inventory/1

# 405 — wrong method on a known route
curl -i -X DELETE http://127.0.0.1:3000/inventory
```

## Swagger

Open <http://127.0.0.1:3000/api-docs> after starting the server. All endpoints, request bodies, and response codes are documented there.

## Postman

`collection.json` is a Postman v2.1 collection. To import:

1. Open Postman.
2. **Import → File → Upload** → select `collection.json`.
3. The collection uses a `baseUrl` variable (default `http://127.0.0.1:3000`) — change it under **Variables** if needed.
4. For requests with file uploads (Register, Update photo), pick a real file in the form-data **photo** field before sending.
