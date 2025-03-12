export type ResourceEffectType = "A" | "B" | "C" | "D" | "E" | "X";

export interface ResourceDefinition {
  id: number;
  activationCost: number;
  periodicCost: number;
  activeTurns: number;
  maintenanceTurns: number;
  lifecycle: number;
  buildingsPowered: number;
  effectType: ResourceEffectType;
  effectValue?: number; // Percentage for A, B, C, D; capacity for E
}

// Current definition (correct)
export interface Turn {
  minBuildings: number; // TM_t
  maxBuildings: number; // TX_t
  profitPerBuilding: number; // TR_t
}

export interface ActiveResource {
  definition: ResourceDefinition;
  remainingLife: number;
  cooldownRemaining: number;
  turnsRemainingActive: number;
  storedBuildings?: number; // For E-type
}
