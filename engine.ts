import { ResourceDefinition, Turn, ActiveResource } from "./types";

export class GameEngine {
  budget: number;
  turns: Turn[];
  resources: ResourceDefinition[];
  activeResources: ActiveResource[] = [];
  currentTurn: number = 0;
  totalScore: number = 0;
  totalStoredBuildings: number = 0;
  totalAccumulatorCapacity: number = 0;

  constructor(budget: number, turns: Turn[], resources: ResourceDefinition[]) {
    this.budget = budget;
    this.turns = turns;
    this.resources = resources;
  }

  purchaseResources(resourceIds: number[]): boolean {
    const cost = resourceIds.reduce((sum, id) => {
      const def = this.resources.find((r) => r.id === id)!;
      return sum + def.activationCost;
    }, 0);

    if (cost > this.budget) return false;

    this.budget -= cost;
    for (const id of resourceIds) {
      const def = this.resources.find((r) => r.id === id)!;
      const newResource: ActiveResource = {
        definition: def,
        remainingLife: def.lifecycle,
        cooldownRemaining: 0,
        turnsRemainingActive: def.activeTurns,
      };
      this.applyCTypeEffects(newResource);
      this.activeResources.push(newResource);

      if (def.effectType === "E") {
        this.totalAccumulatorCapacity += def.effectValue || 0;
      }
    }
    return true;
  }

  private applyCTypeEffects(newResource: ActiveResource) {
    const cResources = this.activeResources.filter(
      (r) => r.definition.effectType === "C" && r.turnsRemainingActive > 0
    );
    const totalCPercentage = cResources.reduce(
      (sum, c) => sum + (c.definition.effectValue || 0),
      0
    );
    const factor = 1 + totalCPercentage / 100;
    newResource.remainingLife = Math.max(
      1,
      Math.floor(newResource.definition.lifecycle * factor)
    );
  }

  runTurn(): number {
    const turn = this.turns[this.currentTurn];
    let buildingsPowered = 0;
    let maintenanceCost = 0;
    let profitPerBuilding = turn.profitPerBuilding;
    let minBuildings = turn.minBuildings;
    let maxBuildings = turn.maxBuildings;

    // Apply special effects
    const activeEffects = this.activeResources
      .filter((r) => r.turnsRemainingActive > 0 && r.remainingLife > 0)
      .reduce((acc, r) => {
        acc[r.definition.effectType] = acc[r.definition.effectType] || [];
        acc[r.definition.effectType].push(r);
        return acc;
      }, {} as Record<string, ActiveResource[]>);

    // A: Smart Meter
    const totalAPercentage = activeEffects["A"]
      ? activeEffects["A"].reduce(
          (sum, r) => sum + (r.definition.effectValue || 0),
          0
        )
      : 0;
    const aFactor = 1 + totalAPercentage / 100;

    let baseBuildings = this.activeResources.reduce(
      (sum, r) => sum + (r.definition.buildingsPowered || 0),
      0
    );

    // Apply A-type effects AFTER base calculation
    const adjustedBuildings = Math.floor(baseBuildings * aFactor);
    buildingsPowered = adjustedBuildings;

    // B: Distribution Facility
    const totalBPercentage = activeEffects["B"]
      ? activeEffects["B"].reduce(
          (sum, r) => sum + (r.definition.effectValue || 0),
          0
        )
      : 0;
    const bFactor = 1 + totalBPercentage / 100;
    minBuildings = Math.max(0, Math.floor(turn.minBuildings * bFactor));
    maxBuildings = Math.max(0, Math.floor(turn.maxBuildings * bFactor));

    // D: Renewable Plant
    const totalDPercentage = activeEffects["D"]
      ? activeEffects["D"].reduce(
          (sum, r) => sum + (r.definition.effectValue || 0),
          0
        )
      : 0;
    const dFactor = 1 + totalDPercentage / 100;
    profitPerBuilding = Math.max(
      0,
      Math.floor(turn.profitPerBuilding * dFactor)
    );

    // Update resources and calculate buildings powered
    this.activeResources.forEach((res) => {
      if (res.remainingLife <= 0) return;

      if (res.cooldownRemaining > 0) {
        res.cooldownRemaining--;
        if (res.cooldownRemaining === 0 && res.remainingLife > 0) {
          res.turnsRemainingActive = res.definition.activeTurns;
        }
      } else if (res.turnsRemainingActive > 0) {
        const adjustedRU = Math.max(
          0,
          Math.floor(res.definition.buildingsPowered * aFactor)
        );
        buildingsPowered += adjustedRU;
        maintenanceCost += res.definition.periodicCost;
        res.turnsRemainingActive--;

        if (
          res.turnsRemainingActive === 0 &&
          res.definition.maintenanceTurns > 0
        ) {
          res.cooldownRemaining = res.definition.maintenanceTurns;
        }
      }
      res.remainingLife--;
    });

    // E: Accumulator handling
    const surplus = buildingsPowered - maxBuildings;
    if (surplus > 0) {
      this.totalStoredBuildings = Math.min(
        this.totalAccumulatorCapacity,
        this.totalStoredBuildings + surplus
      );
      buildingsPowered = maxBuildings;
    }

    if (buildingsPowered < minBuildings) {
      const needed = minBuildings - buildingsPowered;
      if (this.totalStoredBuildings >= needed) {
        this.totalStoredBuildings -= needed;
        buildingsPowered = minBuildings;
      } else {
        buildingsPowered += this.totalStoredBuildings;
        this.totalStoredBuildings = 0;
      }
    }

    // Remove expired E capacity
    const activeEResources = this.activeResources.filter(
      (r) => r.definition.effectType === "E" && r.remainingLife > 0
    );
    this.totalAccumulatorCapacity = activeEResources.reduce(
      (sum, e) => sum + (e.definition.effectValue || 0),
      0
    );
    this.totalStoredBuildings = Math.min(
      this.totalStoredBuildings,
      this.totalAccumulatorCapacity
    );

    // Calculate profit
    let profit = 0;
    if (buildingsPowered >= minBuildings) {
      profit = Math.min(buildingsPowered, maxBuildings) * profitPerBuilding;
    }

    this.budget += profit - maintenanceCost;
    this.totalScore += profit;
    this.currentTurn++;

    // Remove expired resources
    this.activeResources = this.activeResources.filter(
      (r) => r.remainingLife > 0
    );

    return profit;
  }

  isGameOver(): boolean {
    return this.currentTurn >= this.turns.length;
  }

  getTotalScore(): number {
    return this.totalScore;
  }
}
