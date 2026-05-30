import { useCallback, useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { supabase } from '@/integrations/supabase/client'
import type { MissionProgress, PhaseResultPayload, PhaseResultResponse } from '@/lib/missions'
import { submitPhaseResult } from '@/lib/missions.functions'

export function useMissions(userId: string | undefined) {
  const [missions, setMissions] = useState<MissionProgress[]>([])
  const [loading, setLoading] = useState(true)
  const submitFn = useServerFn(submitPhaseResult)

  const refresh = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.rpc('get_player_missions')
    if (data) {
      setMissions(data.map(m => ({
        id: m.id,
        title: m.title,
        description: m.description,
        icon: m.icon,
        category: m.category,
        gemsReward: m.gems_reward,
        repeatable: m.repeatable,
        progress: m.progress,
        conditionValue: m.condition_value,
        timesCompleted: m.times_completed,
        completedAt: m.completed_at,
      })))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  const submitResult = useCallback(async (
    payload: PhaseResultPayload
  ): Promise<PhaseResultResponse | null> => {
    try {
      const res = await submitFn({ data: payload })
      await refresh()
      return res
    } catch (e) {
      console.error(e)
      return null
    }
  }, [submitFn, refresh])

  return { missions, loading, refresh, submitResult }
}
