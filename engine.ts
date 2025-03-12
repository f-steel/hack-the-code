import { ResourceDefinition, Turn, ActiveResource } from "./types";

export class GameEngine {
  budget: number;
  turns: Turn[];
  resources: ResourceDefinition[];
  activeResources: ActiveResource[] = [];
  currentTurn: number = 0;
  totalScore: number = 0; // Track total profit

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
        storedBuildings: def.effectType === "E" ? 0 : undefined,
      };
      this.applyCTypeEffects(newResource); // Apply C-type effects at purchase
      this.activeResources.push(newResource);
    }
    return true;
  }

  private applyCTypeEffects(newResource: ActiveResource) {
    const cResources = this.activeResources.filter(
      (r) => r.definition.effectType === "C" && r.turnsRemainingActive > 0
    );
    for (const c of cResources) {
      const percentage = c.definition.effectValue!;
      const factor =
        percentage >= 0 ? 1 + percentage / 100 : 1 / (1 - percentage / 100);
      newResource.remainingLife = Math.max(
        1,
        Math.floor(newResource.definition.lifecycle * factor)
      );
    }
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
    let aFactor = 1;
    if (activeEffects["A"]) {
      activeEffects["A"].forEach((r) => {
        const percentage = r.definition.effectValue!;
        aFactor *=
          percentage >= 0 ? 1 + percentage / 100 : 1 - percentage / 100;
      });
    }

    // B: Distribution Facility
    if (activeEffects["B"]) {
      let bFactor = 1;
      activeEffects["B"].forEach((r) => {
        const percentage = r.definition.effectValue!;
        bFactor *=
          percentage >= 0 ? 1 + percentage / 100 : 1 - percentage / 100;
      });
      minBuildings = Math.max(0, Math.floor(minBuildings * bFactor));
      maxBuildings = Math.max(0, Math.floor(maxBuildings * bFactor));
    }

    // D: Renewable Plant
    if (activeEffects["D"]) {
      let dFactor = 1;
      activeEffects["D"].forEach((r) => {
        const percentage = r.definition.effectValue!;
        dFactor *=
          percentage >= 0 ? 1 + percentage / 100 : 1 - percentage / 100;
      });
      profitPerBuilding = Math.max(0, Math.floor(profitPerBuilding * dFactor));
    }

    // Update resources and calculate buildings powered
    this.activeResources.forEach((res) => {
      if (res.remainingLife <= 0) return;

      if (res.cooldownRemaining > 0) {
        res.cooldownRemaining--;
        if (res.cooldownRemaining === 0 && res.remainingLife > 0) {
          res.turnsRemainingActive = res.definition.activeTurns; // Restart active period
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

    // E: Accumulator
    let storedBuildings = 0;
    const eResources = this.activeResources.filter(
      (r) => r.definition.effectType === "E" && r.turnsRemainingActive > 0
    );
    if (eResources.length > 0) {
      const surplus = buildingsPowered - maxBuildings;
      if (surplus > 0) {
        eResources.forEach((e) => {
          const capacity = e.definition.effectValue!;
          e.storedBuildings = Math.min(
            capacity,
            (e.storedBuildings || 0) + surplus / eResources.length
          );
        });
        buildingsPowered = maxBuildings;
      }
      if (buildingsPowered < minBuildings) {
        const needed = minBuildings - buildingsPowered;
        let available = eResources.reduce(
          (sum, e) => sum + (e.storedBuildings || 0),
          0
        );
        if (available >= needed) {
          let remaining = needed;
          eResources.forEach((e) => {
            const take = Math.min(remaining, e.storedBuildings || 0);
            e.storedBuildings! -= take;
            remaining -= take;
          });
          buildingsPowered = minBuildings;
        }
      }
    }

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
