export interface MissionProgress {
  id: string
  title: string
  description: string
  icon: string
  category: string
  gemsReward: number
  repeatable: boolean
  progress: number
  conditionValue: number
  timesCompleted: number
  completedAt: string | null
}

export interface PhaseResultPayload {
  wave: number
  gold: number
  victory: boolean
  stageId: number
  phaseIndex: number
  tookDamage: boolean
  towersUsed: number
  phaseSeconds: number
  enemiesKilled: number
  goldSpent: number
  usedUpgrade: boolean
  stageComplete: boolean
  allPhasesNoDamage: boolean
}

export interface PhaseResultResponse {
  gems: number
  highScore: number
  score: number
  earned: number
  missionsEarned: Array<{
    id: string
    title: string
    gems: number
    icon: string
  }>
}

export const CATEGORY_LABELS: Record<string, string> = {
  stage:   '🗺️ Estágios',
  phase:   '⚔️ Fases',
  combat:  '💀 Combate',
  economy: '💰 Economia',
  mastery: '🏆 Maestria',
}

export const CATEGORY_COLORS: Record<string, string> = {
  stage:   'border-amber-600 bg-amber-950/40',
  phase:   'border-blue-600 bg-blue-950/40',
  combat:  'border-red-600 bg-red-950/40',
  economy: 'border-yellow-500 bg-yellow-950/40',
  mastery: 'border-purple-600 bg-purple-950/40',
}
