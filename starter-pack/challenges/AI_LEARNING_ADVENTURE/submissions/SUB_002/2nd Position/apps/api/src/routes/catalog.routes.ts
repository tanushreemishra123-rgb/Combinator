import type { ApiContext } from '../context.ts';
import { badRequest } from '../http/errors.ts';
import * as catalogService from '../services/catalog.service.ts';

export type CatalogRouteResult = catalogService.CatalogResult;

export function handleGetCatalog(ctx: ApiContext, url: URL): CatalogRouteResult {
  const includeParam = url.searchParams.get('include');
  const include: catalogService.CatalogInclude = { missions: true, awards: true };

  if (includeParam !== null && includeParam.trim() !== '') {
    include.missions = false;
    include.awards = false;
    for (const rawToken of includeParam.split(',')) {
      const token = rawToken.trim();
      if (!token) continue;
      switch (token) {
        case 'missions':
          include.missions = true;
          break;
        case 'awards':
          include.awards = true;
          break;
        default:
          throw badRequest(`Query parameter "include" contains unsupported value "${token}". Allowed values: missions, awards.`);
      }
    }
  }

  return catalogService.getCatalog(ctx.dbHandle.db, include);
}
