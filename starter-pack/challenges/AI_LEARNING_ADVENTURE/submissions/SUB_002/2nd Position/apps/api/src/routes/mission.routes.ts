import type { MissionDetailDto } from '@ai-learning-adventure/types';
import type { ApiContext } from '../context.ts';
import { requireString } from '../http/response.ts';
import * as catalogService from '../services/catalog.service.ts';

export function handleGetMission(ctx: ApiContext, missionId: string): MissionDetailDto {
  const id = requireString(missionId, 'missionId', 128);
  return catalogService.getMissionDetail(ctx.dbHandle.db, id);
}
