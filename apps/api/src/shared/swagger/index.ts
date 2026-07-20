import { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { OpenAPIV3 } from 'openapi-types';
import logger from '../utils/logger';

interface RouteEntry {
  path: string;
  methods: string[];
}

function extractRoutes(app: Express, basePath: string = ''): RouteEntry[] {
  const routes: RouteEntry[] = [];
  const stack = (app as any)._router?.stack || [];
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      const fullPath = normalizePath(basePath + layer.route.path);
      routes.push({ path: fullPath, methods });
    } else if (layer.handle?.stack && layer.name === 'router') {
      const routerPath = layer.regexp.source
        .replace(/\\\//g, '/')
        .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param')
        .replace(/\(\?:\(\[\^\\\/\]\+\?\)\|\(\)\)/g, ':param?')
        .replace(/\(\?:\[\^\\\/\]\+\?\)/g, ':param')
        .replace(/\(\[\^\\\/\]\+\?\)/g, ':param')
        .replace(/\(\?=\/\\\|\\\$\)/g, '')
        .replace(/\(\?:\[\^\\\/\]\*\\\/\)\?\(\[\^\\\/\]\+\\\$\)/g, '')
        .replace(/[\\^$?|+*]/g, '')
        .replace(/\/\//g, '/')
        .trim();
      const subRoutes = extractRoutes(layer.handle, normalizePath(basePath + '/' + routerPath));
      routes.push(...subRoutes);
    }
  }
  return routes;
}

function normalizePath(p: string): string {
  return '/' + p.replace(/^\/+/, '').replace(/\/+$/, '');
}

function resolveParamName(path: string): string {
  const m = path.match(/:([^/]+)/);
  return m ? m[1] : 'id';
}

const SUMMARY_MAP: Record<string, string> = {
  GET_LIST: 'List resources',
  GET_ONE: 'Get resource by ID',
  CREATE: 'Create resource',
  UPDATE: 'Update resource',
  DELETE: 'Delete resource',
  ACTION: 'Execute action',
};

function guessSummary(method: string, path: string): string {
  const hasId = path.includes(':param');
  if (method === 'GET' && !hasId) return SUMMARY_MAP.GET_LIST;
  if (method === 'GET' && hasId) return SUMMARY_MAP.GET_ONE;
  if (method === 'POST') return SUMMARY_MAP.CREATE;
  if (method === 'PATCH') return SUMMARY_MAP.UPDATE;
  if (method === 'PUT') return SUMMARY_MAP.UPDATE;
  if (method === 'DELETE') return SUMMARY_MAP.DELETE;
  return SUMMARY_MAP.ACTION;
}

function extractTags(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  const tag = parts[0] || 'General';
  return [tag.charAt(0).toUpperCase() + tag.slice(1)];
}

function buildOpenApiSpec(routes: RouteEntry[]): OpenAPIV3.Document {
  const paths: OpenAPIV3.PathsObject = {};
  const tagSet = new Set<string>();

  for (const route of routes) {
    const swaggerPath = route.path.replace(/:([^/]+)/g, '{$1}');
    if (!paths[swaggerPath]) paths[swaggerPath] = {};
    const tags = extractTags(route.path);
    tags.forEach(t => tagSet.add(t));

    for (const method of route.methods) {
      const m = method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
      const params: OpenAPIV3.ParameterObject[] = [];
      const paramMatches = route.path.match(/:([^/]+)/g);
      if (paramMatches) {
        for (const pm of paramMatches) {
          params.push({
            name: pm.slice(1),
            in: 'path',
            required: true,
            schema: { type: 'string' },
          });
        }
      }

      (paths[swaggerPath] as any)[m] = {
        summary: guessSummary(method, route.path),
        tags,
        parameters: params,
        responses: {
          '200': { description: 'Success' },
          '400': { description: 'Bad request' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
          '500': { description: 'Internal server error' },
        },
      } as any;
    }
  }

  return {
    openapi: '3.0.0',
    info: {
      title: 'CareDesk API',
      version: '1.0.0',
      description: 'Healthcare workforce management platform API',
    },
    servers: [{ url: '/', description: 'Current server' }],
    tags: Array.from(tagSet).map(name => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  };
}

export function setupSwagger(app: Express): void {
  const routes = extractRoutes(app);
  const spec = buildOpenApiSpec(routes);

  // Relax CSP for Swagger UI (it uses inline scripts/styles)
  app.use('/docs', (_req: Request, res: Response, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:"
    );
    next();
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec as any, { explorer: true }));
  app.get('/docs.json', (_req: Request, res: Response) => res.json(spec));
  logger.info({ routeCount: routes.length }, `Swagger docs available at /docs`);
}
