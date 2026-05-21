// OpenAPI 3 specification for the inventory service.
// `host` and `port` are injected at runtime so the "Try it out" button in
// Swagger UI hits the actual server the user started.
module.exports = function buildSwaggerDocument(host, port) {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Inventory Service API',
      version: '1.0.0',
      description: 'Lab 6 — Inventory service. Express + Commander + Multer + Swagger.',
    },
    servers: [{ url: `http://${host}:${port}` }],
    components: {
      schemas: {
        InventoryItem: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            inventory_name: { type: 'string', example: 'Drill' },
            description: { type: 'string', example: 'Cordless 18V' },
            photoUrl: {
              type: 'string',
              nullable: true,
              example: 'http://127.0.0.1:3000/cache/1700000000000-123456789.jpg',
            },
          },
        },
      },
    },
    paths: {
      '/register': {
        post: {
          tags: ['inventory'],
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
            201: {
              description: 'Created',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/InventoryItem' } },
              },
            },
            400: { description: 'Bad Request — inventory_name is missing' },
            405: { description: 'Method Not Allowed' },
          },
        },
      },
      '/inventory': {
        get: {
          tags: ['inventory'],
          summary: 'Get all inventory items',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/InventoryItem' },
                  },
                },
              },
            },
            405: { description: 'Method Not Allowed' },
          },
        },
      },
      '/inventory/{id}': {
        get: {
          tags: ['inventory'],
          summary: 'Get one inventory item by id',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/InventoryItem' } },
              },
            },
            404: { description: 'Not Found' },
            405: { description: 'Method Not Allowed' },
          },
        },
        put: {
          tags: ['inventory'],
          summary: 'Update an inventory item (name and/or description)',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          ],
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
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/InventoryItem' } },
              },
            },
            404: { description: 'Not Found' },
            405: { description: 'Method Not Allowed' },
          },
        },
        delete: {
          tags: ['inventory'],
          summary: 'Delete an inventory item',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: {
            200: { description: 'OK' },
            404: { description: 'Not Found' },
            405: { description: 'Method Not Allowed' },
          },
        },
      },
      '/inventory/{id}/photo': {
        get: {
          tags: ['inventory'],
          summary: 'Get the photo of an item (image/jpeg)',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          responses: {
            200: {
              description: 'OK',
              content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } } },
            },
            404: { description: 'Not Found' },
            405: { description: 'Method Not Allowed' },
          },
        },
        put: {
          tags: ['inventory'],
          summary: 'Update the photo of an item',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          ],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['photo'],
                  properties: { photo: { type: 'string', format: 'binary' } },
                },
              },
            },
          },
          responses: {
            200: { description: 'OK' },
            400: { description: 'Bad Request — photo is required' },
            404: { description: 'Not Found' },
            405: { description: 'Method Not Allowed' },
          },
        },
      },
      '/search': {
        post: {
          tags: ['inventory'],
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
                    has_photo: { type: 'string', description: 'Send "true" or "on" to include the photo link' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'OK (HTML response)' },
            404: { description: 'Not Found' },
            405: { description: 'Method Not Allowed' },
          },
        },
      },
      '/RegisterForm.html': {
        get: {
          tags: ['forms'],
          summary: 'Inventory registration HTML form',
          responses: { 200: { description: 'OK' } },
        },
      },
      '/SearchForm.html': {
        get: {
          tags: ['forms'],
          summary: 'Inventory search HTML form',
          responses: { 200: { description: 'OK' } },
        },
      },
    },
  };
};
