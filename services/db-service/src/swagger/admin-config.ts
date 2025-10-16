import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import path from 'path';
import fs from 'fs';

export function setupAdminSwagger(app: Express): void {
  try {
    // Read the Admin OpenAPI YAML file
    const yamlPath = path.join(__dirname, 'admin-openapi.yml');
    const swaggerDocument = fs.readFileSync(yamlPath, 'utf8');
    
    // Parse YAML to JSON
    const yaml = require('js-yaml');
    const swaggerSpec = yaml.load(swaggerDocument);
    
    // Serve admin swagger docs
    app.use('/admin-api-docs', swaggerUi.serveFiles(swaggerSpec), swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Design System Builder Admin API',
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 50px 0; }
        .swagger-ui .info .title { color: #dc2626; }
        .swagger-ui .info .description { color: #6b7280; }
      `,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
      },
    }));

    // Serve Admin OpenAPI spec as JSON
    app.get('/admin-api-docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    console.log('📚 Admin API Swagger documentation available at http://localhost:3001/admin-api-docs');
  } catch (error) {
    console.error('Failed to setup Admin Swagger documentation:', error);
  }
}

