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

export interface Turn {
  minBuildings: number;
  maxBuildings: number;
  profitPerBuilding: number;
}

export interface ActiveResource {
  definition: ResourceDefinition;
  remainingLife: number;
  cooldownRemaining: number;
  turnsRemainingActive: number;
  storedBuildings?: number; // For E-type
}
