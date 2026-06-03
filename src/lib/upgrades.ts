export type TowerType = "archer" | "dwarf" | "mage" | "global";
export type UpgradeStat = "damage" | "range" | "fireRate" | "splash" | "goldBonus" | "startingGold";

export interface UpgradeDef {
  id: string;
  towerType: TowerType;
  name: string;
  icon: string;
  stat: UpgradeStat;
  maxLevel: number;
  costPerLevel: number;
  effectPerLevel: number;
  description: string;
  kind: "percent" | "flat";
  sortOrder: number;
}

export const UPGRADES: UpgradeDef[] = [
  // Archer
  {
    id: "archer_damage",
    towerType: "archer",
    name: "Lâminas Élfica",
    icon: "🏹",
    stat: "damage",
    maxLevel: 8,
    costPerLevel: 60,
    effectPerLevel: 0.12,
    description: "+12% dano do Arqueiro",
    kind: "percent",
    sortOrder: 1,
  },
  {
    id: "archer_range",
    towerType: "archer",
    name: "Visão Aguçada",
    icon: "👁️",
    stat: "range",
    maxLevel: 7,
    costPerLevel: 50,
    effectPerLevel: 0.1,
    description: "+10% alcance do Arqueiro",
    kind: "percent",
    sortOrder: 2,
  },
  {
    id: "archer_firerate",
    towerType: "archer",
    name: "Corda Reforçada",
    icon: "⚡",
    stat: "fireRate",
    maxLevel: 7,
    costPerLevel: 70,
    effectPerLevel: 0.12,
    description: "+12% velocidade do Arqueiro",
    kind: "percent",
    sortOrder: 3,
  },
  // Dwarf
  {
    id: "dwarf_damage",
    towerType: "dwarf",
    name: "Martelo Rúnico",
    icon: "🔨",
    stat: "damage",
    maxLevel: 8,
    costPerLevel: 80,
    effectPerLevel: 0.15,
    description: "+15% dano do Anão",
    kind: "percent",
    sortOrder: 4,
  },
  {
    id: "dwarf_range",
    towerType: "dwarf",
    name: "Catapulta Anã",
    icon: "🪨",
    stat: "range",
    maxLevel: 7,
    costPerLevel: 60,
    effectPerLevel: 0.08,
    description: "+8% alcance do Anão",
    kind: "percent",
    sortOrder: 5,
  },
  {
    id: "dwarf_firerate",
    towerType: "dwarf",
    name: "Forja Acelerada",
    icon: "🔥",
    stat: "fireRate",
    maxLevel: 7,
    costPerLevel: 90,
    effectPerLevel: 0.1,
    description: "+10% velocidade do Anão",
    kind: "percent",
    sortOrder: 6,
  },
  // Mage
  {
    id: "mage_damage",
    towerType: "mage",
    name: "Cristal Arcano",
    icon: "💎",
    stat: "damage",
    maxLevel: 8,
    costPerLevel: 100,
    effectPerLevel: 0.15,
    description: "+15% dano do Mago",
    kind: "percent",
    sortOrder: 7,
  },
  {
    id: "mage_range",
    towerType: "mage",
    name: "Orbe Expandido",
    icon: "🔮",
    stat: "range",
    maxLevel: 7,
    costPerLevel: 80,
    effectPerLevel: 0.12,
    description: "+12% alcance do Mago",
    kind: "percent",
    sortOrder: 8,
  },
  {
    id: "mage_firerate",
    towerType: "mage",
    name: "Encantamento Veloz",
    icon: "✨",
    stat: "fireRate",
    maxLevel: 7,
    costPerLevel: 110,
    effectPerLevel: 0.1,
    description: "+10% velocidade do Mago",
    kind: "percent",
    sortOrder: 9,
  },
  {
    id: "mage_splash",
    towerType: "mage",
    name: "Onda de Choque",
    icon: "💥",
    stat: "splash",
    maxLevel: 7,
    costPerLevel: 120,
    effectPerLevel: 0.15,
    description: "+15% raio de splash do Mago",
    kind: "percent",
    sortOrder: 10,
  },
  // Global
  {
    id: "gold_bonus",
    towerType: "global",
    name: "Ouro Extra",
    icon: "💰",
    stat: "goldBonus",
    maxLevel: 5,
    costPerLevel: 80,
    effectPerLevel: 0.15,
    description: "+15% ouro por inimigo",
    kind: "percent",
    sortOrder: 11,
  },
  {
    id: "starting_gold",
    towerType: "global",
    name: "Ouro Inicial",
    icon: "🪙",
    stat: "startingGold",
    maxLevel: 5,
    costPerLevel: 100,
    effectPerLevel: 50,
    description: "+50 ouro inicial por fase",
    kind: "flat",
    sortOrder: 12,
  },
];


export const UPGRADES_BY_TOWER: Record<TowerType, UpgradeDef[]> = {
  archer: UPGRADES.filter((u) => u.towerType === "archer"),
  dwarf: UPGRADES.filter((u) => u.towerType === "dwarf"),
  mage: UPGRADES.filter((u) => u.towerType === "mage"),
  global: UPGRADES.filter((u) => u.towerType === "global"),
};

export type UpgradeLevels = Record<string, number>;

export function getTowerMultipliers(towerType: TowerType, levels: UpgradeLevels, globalLevels: UpgradeLevels) {
  const relevant = [
    ...UPGRADES.filter((u) => u.towerType === towerType),
    ...UPGRADES.filter((u) => u.towerType === "global"),
  ];

  const result: Record<string, number> = {
    damage: 1,
    range: 1,
    fireRate: 1,
    splash: 1,
    goldBonus: 1,
    startingGold: 0,
  };

  for (const def of relevant) {
    const lvl = def.towerType === "global" ? (globalLevels[def.id] ?? 0) : (levels[def.id] ?? 0);
    if (def.kind === "percent") {
      result[def.stat] = (result[def.stat] ?? 1) + def.effectPerLevel * lvl;
    } else {
      result[def.stat] = (result[def.stat] ?? 0) + def.effectPerLevel * lvl;
    }
  }
  return result;
}

export function computeMultipliers(levels: UpgradeLevels) {
  return {
    damage: getGlobalStat("damage", levels),
    range: getGlobalStat("range", levels),
    fireRate: getGlobalStat("fireRate", levels),
    goldBonus: getGlobalStat("goldBonus", levels),
    startingGoldBonus: getGlobalStat("startingGold", levels),
  };
}

function getGlobalStat(stat: string, levels: UpgradeLevels): number {
  let value = stat === "startingGold" ? 0 : 1;
  for (const def of UPGRADES) {
    if (def.stat !== stat) continue;
    const lvl = levels[def.id] ?? 0;
    if (def.kind === "percent") value += def.effectPerLevel * lvl;
    else value += def.effectPerLevel * lvl;
  }
  return value;
}
