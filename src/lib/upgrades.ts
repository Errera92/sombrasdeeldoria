// Catálogo central de upgrades permanentes (loja com gems)
export type UpgradeStat = "damage" | "range" | "fireRate" | "goldBonus" | "startingGold";

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  stat: UpgradeStat;
  maxLevel: number;
  costPerLevel: number; // em gems
  effectPerLevel: number; // valor adicionado por nível
  description: string;
  /** "percent" -> multiplicador (1 + level*effect); "flat" -> additive */
  kind: "percent" | "flat";
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: "tower_damage",
    name: "Dano Base",
    icon: "⚔️",
    stat: "damage",
    maxLevel: 5,
    costPerLevel: 50,
    effectPerLevel: 0.1,
    description: "+10% de dano em todas as torres",
    kind: "percent",
  },
  {
    id: "tower_range",
    name: "Alcance",
    icon: "🎯",
    stat: "range",
    maxLevel: 5,
    costPerLevel: 40,
    effectPerLevel: 0.08,
    description: "+8% de alcance em todas as torres",
    kind: "percent",
  },
  {
    id: "tower_firerate",
    name: "Velocidade de Ataque",
    icon: "💨",
    stat: "fireRate",
    maxLevel: 5,
    costPerLevel: 60,
    effectPerLevel: 0.1,
    description: "+10% de velocidade de ataque",
    kind: "percent",
  },
  {
    id: "gold_bonus",
    name: "Ouro Extra",
    icon: "💰",
    stat: "goldBonus",
    maxLevel: 3,
    costPerLevel: 80,
    effectPerLevel: 0.15,
    description: "+15% de ouro por inimigo",
    kind: "percent",
  },
  {
    id: "starting_gold",
    name: "Ouro Inicial",
    icon: "🪙",
    stat: "startingGold",
    maxLevel: 3,
    costPerLevel: 100,
    effectPerLevel: 50,
    description: "+50 de ouro inicial",
    kind: "flat",
  },
];

export type UpgradeLevels = Record<string, number>;

export function getMultiplier(stat: UpgradeStat, levels: UpgradeLevels): number {
  let value = stat === "startingGold" ? 0 : 1;
  for (const def of UPGRADES) {
    if (def.stat !== stat) continue;
    const lvl = levels[def.id] ?? 0;
    if (def.kind === "percent") value += def.effectPerLevel * lvl;
    else value += def.effectPerLevel * lvl;
  }
  return value;
}

export function computeMultipliers(levels: UpgradeLevels) {
  return {
    damage: getMultiplier("damage", levels),
    range: getMultiplier("range", levels),
    fireRate: getMultiplier("fireRate", levels),
    goldBonus: getMultiplier("goldBonus", levels),
    startingGoldBonus: getMultiplier("startingGold", levels),
  };
}
