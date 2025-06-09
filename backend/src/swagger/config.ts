import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import path from 'path';
import fs from 'fs';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Design System Builder API',
      version: '1.0.0',
      description: 'API documentation for the Design System Builder application',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'http://localhost:3001/api' 
          : 'http://localhost:3001/api',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
  },
  apis: [], // We'll use the YAML file instead
};

export function setupSwagger(app: Express): void {
  try {
    // Read the OpenAPI YAML file
    const yamlPath = path.join(__dirname, 'openapi.yml');
    const swaggerDocument = fs.readFileSync(yamlPath, 'utf8');
    
    // Parse YAML to JSON
    const yaml = require('js-yaml');
    const swaggerSpec = yaml.load(swaggerDocument);
    
    // Serve swagger docs
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Design System Builder API',
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 50px 0; }
        .swagger-ui .info .title { color: #3b82f6; }
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

    // Serve OpenAPI spec as JSON
    app.get('/api-docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    console.log('📚 Swagger documentation available at http://localhost:3001/api-docs');
  } catch (error) {
    console.error('Failed to setup Swagger documentation:', error);
  }
} 