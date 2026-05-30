import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { PhaseResultResponse } from '@/lib/missions'

const PhaseResultSchema = z.object({
  wave:              z.number().int().min(0).max(100),
  gold:              z.number().int().min(0).max(100000),
  victory:           z.boolean(),
  stageId:           z.number().int().min(0).max(10),
  phaseIndex:        z.number().int().min(0).max(4),
  tookDamage:        z.boolean(),
  towersUsed:        z.number().int().min(0).max(20),
  phaseSeconds:      z.number().int().min(0).max(600),
  enemiesKilled:     z.number().int().min(0).max(10000),
  goldSpent:         z.number().int().min(0).max(100000),
  usedUpgrade:       z.boolean(),
  stageComplete:     z.boolean(),
  allPhasesNoDamage: z.boolean(),
})

export const submitPhaseResult = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PhaseResultSchema.parse(input))
  .handler(async ({ data, context }): Promise<PhaseResultResponse> => {
    const { supabase } = context
    const { data: rows, error } = await supabase.rpc('process_phase_result', {
      p_wave:               data.wave,
      p_gold:               data.gold,
      p_victory:            data.victory,
      p_stage_id:           data.stageId,
      p_phase_index:        data.phaseIndex,
      p_took_damage:        data.tookDamage,
      p_towers_used:        data.towersUsed,
      p_phase_seconds:      data.phaseSeconds,
      p_enemies_killed:     data.enemiesKilled,
      p_gold_spent:         data.goldSpent,
      p_used_upgrade:       data.usedUpgrade,
      p_stage_complete:     data.stageComplete,
      p_all_phases_no_damage: data.allPhasesNoDamage,
    })
    if (error) throw new Error(error.message)
    const r = Array.isArray(rows) ? rows[0] : rows
    return {
      gems:            r?.gems        ?? 0,
      highScore:       r?.high_score  ?? 0,
      score:           r?.score       ?? 0,
      earned:          r?.earned      ?? 0,
      missionsEarned:  (r?.missions_earned as PhaseResultResponse['missionsEarned']) ?? [],
    }
  })
