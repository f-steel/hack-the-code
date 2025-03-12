import { GameEngine } from "./engine";
import { ResourceDefinition, Turn } from "./types";

export function optimizedStrategy(engine: GameEngine): number[] {
  const currentTurn = engine.currentTurn;
  const affordableResources = engine.resources
    .filter((r) => r.activationCost <= engine.budget)
    .sort((a, b) => a.activationCost - b.activationCost);

  if (affordableResources.length === 0) return [];

  // Look ahead to assess future turn requirements
  const futureTurns = engine.turns.slice(currentTurn, currentTurn + 5);
  const maxFutureMinBuildings = Math.max(
    ...futureTurns.map((t) => t.minBuildings)
  );
  const avgFutureMinBuildings =
    futureTurns.reduce((sum, t) => sum + t.minBuildings, 0) /
    futureTurns.length;
  const currentMinBuildings = engine.turns[currentTurn].minBuildings;

  // Calculate current and projected capacity
  const currentPowerCapacity = calculateCurrentPowerCapacity(engine);
  const projectedDeficit = Math.max(
    0,
    maxFutureMinBuildings - currentPowerCapacity
  );

  // Adjust scoring parameters based on game state
  const accumulatorPriority = projectedDeficit > 0 ? 1.7 : 0.9;
  const hasShortage = currentPowerCapacity < currentMinBuildings;

  const scoredResources = affordableResources
    .map((r) => ({
      resource: r,
      score: calculateImprovedResourceScore(r, engine, {
        accumulatorPriority,
        projectedDeficit,
        maxFutureMinBuildings,
        avgFutureMinBuildings,
        hasShortage,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const purchases: ResourceDefinition[] = [];
  let remainingBudget = engine.budget;

  // Special handling for urgent situations (imminent failure to meet minimum)
  if (hasShortage) {
    // Focus entirely on power-generating resources in crisis mode
    const powerResources = scoredResources.filter(
      (sr) =>
        sr.resource.buildingsPowered > 0 &&
        sr.resource.activationCost <= remainingBudget
    );

    for (const { resource } of powerResources) {
      if (remainingBudget >= resource.activationCost && purchases.length < 50) {
        purchases.push(resource);
        remainingBudget -= resource.activationCost;

        // Check if we've resolved the shortage
        const newCapacity =
          calculateCurrentPowerCapacity(engine) +
          purchases.reduce((sum, p) => sum + p.buildingsPowered, 0);
        if (newCapacity >= currentMinBuildings) break;
      }
    }

    // If we still have budget and haven't resolved the shortage, buy E-type resources
    // to use accumulated power if available
    if (
      remainingBudget > 0 &&
      purchases.length < 50 &&
      calculateCurrentPowerCapacity(engine) +
        purchases.reduce((sum, p) => sum + p.buildingsPowered, 0) <
        currentMinBuildings
    ) {
      const eResources = scoredResources.filter(
        (sr) =>
          sr.resource.effectType === "E" &&
          sr.resource.activationCost <= remainingBudget
      );

      for (const { resource } of eResources) {
        if (
          remainingBudget >= resource.activationCost &&
          purchases.length < 50
        ) {
          purchases.push(resource);
          remainingBudget -= resource.activationCost;
          break; // Just need one for now
        }
      }
    }
  }

  // If not in crisis mode or we've handled the immediate crisis, proceed with strategic purchases
  if (!hasShortage || purchases.length > 0) {
    // Maintain a balanced portfolio based on current needs
    for (const { resource } of scoredResources) {
      // Skip if we can't afford it or we're at max purchases
      if (resource.activationCost > remainingBudget || purchases.length >= 50) {
        continue;
      }

      // For power resources, buy multiples if highly valuable
      if (resource.buildingsPowered > 0) {
        const maxCount = Math.min(
          Math.floor(remainingBudget / resource.activationCost),
          50 - purchases.length
        );

        // Calculate optimal count based on future needs and budget
        const optimalCount = calculateOptimalCount(
          resource,
          engine,
          maxCount,
          projectedDeficit
        );

        if (optimalCount > 0) {
          purchases.push(...Array(optimalCount).fill(resource));
          remainingBudget -= optimalCount * resource.activationCost;
        }
      }
      // For effect resources, be more selective
      else if (isEffectResourceWorthBuying(resource, engine, currentTurn)) {
        purchases.push(resource);
        remainingBudget -= resource.activationCost;
      }
    }
  }

  return purchases.map((r) => r.id);
}

function calculateImprovedResourceScore(
  res: ResourceDefinition,
  engine: GameEngine,
  context: {
    accumulatorPriority: number;
    projectedDeficit: number;
    maxFutureMinBuildings: number;
    avgFutureMinBuildings: number;
    hasShortage: boolean;
  }
): number {
  const currentTurn = engine.currentTurn;
  const turnsLeft = engine.turns.length - currentTurn;
  const {
    accumulatorPriority,
    projectedDeficit,
    maxFutureMinBuildings,
    hasShortage,
  } = context;
  let score = 0;

  // Base power value - more nuanced than before
  const powerValue =
    res.buildingsPowered > 0
      ? Math.pow(res.buildingsPowered, 1.5) * 50 // Exponential value for power
      : 1;

  // Cost efficiency now considers both activation and lifetime costs
  const lifetimeCost =
    res.activationCost + res.periodicCost * Math.min(res.lifecycle, turnsLeft);
  const costEfficiency = (powerValue / lifetimeCost) * 100;

  // More sophisticated lifecycle alignment - peak value is at 80% of turns left
  const optimalLifecycle = Math.ceil(turnsLeft * 0.8);
  const lifecycleAlignment =
    1 + Math.max(0, 1 - Math.abs(res.lifecycle - optimalLifecycle) / turnsLeft);

  // Calculate ROI (Return on Investment)
  const expectedTurnsActive = Math.min(
    res.lifecycle,
    Math.ceil(
      res.lifecycle *
        (res.activeTurns / (res.activeTurns + res.maintenanceTurns))
    )
  );
  const potentialProfit =
    res.buildingsPowered *
    expectedTurnsActive *
    getAverageTurnProfit(engine, currentTurn);
  const roi = potentialProfit / lifetimeCost;

  // Dynamic effect value based on game state
  let effectBonus = 1;
  switch (res.effectType) {
    case "B":
      // B is more valuable when we have power to spare or approaching high thresholds
      effectBonus = hasShortage ? 1.0 : 2.5;
      break;
    case "A":
      // A's value scales with our power capacity
      const currentPower = calculateCurrentPowerCapacity(engine);
      effectBonus = 1.0 + currentPower / maxFutureMinBuildings;
      break;
    case "C":
      // C is more valuable early in the game and with high-value resources
      effectBonus = currentTurn < engine.turns.length / 3 ? 2.0 : 1.2;
      break;
    case "D":
      // D is more valuable with high profitability turns ahead
      effectBonus = 1.6;
      break;
    case "E":
      // E value is dynamic based on our projected deficit
      effectBonus = projectedDeficit > 0 ? accumulatorPriority : 0.8;
      // Bonus for E capacity relative to needs
      if (res.effectValue) {
        effectBonus *= 1 + Math.min(1, res.effectValue / projectedDeficit);
      }
      break;
    case "X":
      effectBonus = 1.0;
  }

  // Urgency factor - immediate power needs get priority
  const urgencyFactor = hasShortage && res.buildingsPowered > 0 ? 10.0 : 1.0;

  // Special bonus for resources that help meet thresholds
  const thresholdBonus =
    res.buildingsPowered > 0 &&
    res.buildingsPowered >= engine.turns[currentTurn].minBuildings / 4
      ? 3.0
      : 1.0;

  // Calculate final score with weighted components
  score =
    (costEfficiency * 0.3 + roi * 0.4) *
    effectBonus *
    lifecycleAlignment *
    thresholdBonus *
    urgencyFactor;

  return score;
}

function calculateCurrentPowerCapacity(engine: GameEngine): number {
  // Consider all active resources and their remaining lifecycle
  return (
    engine.activeResources.reduce((total, resource) => {
      if (resource.remainingLife <= 0 || resource.turnsRemainingActive <= 0)
        return total;

      // Apply A-type effects if any
      const aEffectMultiplier = calculateAEffectMultiplier(engine);
      return (
        total +
        Math.floor(resource.definition.buildingsPowered * aEffectMultiplier)
      );
    }, 0) + engine.totalStoredBuildings
  ); // Include stored power from E-type resources
}

function calculateAEffectMultiplier(engine: GameEngine): number {
  const activeAEffects = engine.activeResources.filter(
    (r) =>
      r.definition.effectType === "A" &&
      r.turnsRemainingActive > 0 &&
      r.remainingLife > 0
  );

  const totalAPercentage = activeAEffects.reduce(
    (sum, r) => sum + (r.definition.effectValue || 0),
    0
  );

  return 1 + totalAPercentage / 100;
}

function getAverageTurnProfit(engine: GameEngine, startTurn: number): number {
  const remainingTurns = engine.turns.slice(startTurn);
  return (
    remainingTurns.reduce((sum, turn) => sum + turn.profitPerBuilding, 0) /
    Math.max(1, remainingTurns.length)
  );
}

function calculateOptimalCount(
  resource: ResourceDefinition,
  engine: GameEngine,
  maxCount: number,
  projectedDeficit: number
): number {
  if (maxCount <= 0) return 0;

  // For power resources, calculate how many we need to meet projected deficit
  if (resource.buildingsPowered > 0) {
    // If we have a projected deficit, buy enough to cover it (up to max)
    if (projectedDeficit > 0) {
      const neededCount = Math.ceil(
        projectedDeficit / resource.buildingsPowered
      );
      return Math.min(neededCount, maxCount);
    }
    // Otherwise buy at most 3 based on resource efficiency
    else {
      const efficiency = resource.buildingsPowered / resource.activationCost;
      // Buy more if the resource is very efficient
      return Math.min(Math.max(1, Math.floor(efficiency * 2)), 3, maxCount);
    }
  }

  return 1; // Default to buying one for effect resources
}

function isEffectResourceWorthBuying(
  resource: ResourceDefinition,
  engine: GameEngine,
  currentTurn: number
): boolean {
  // Evaluate based on effect type and game state
  switch (resource.effectType) {
    case "A":
      // Worth it if we have enough power-generating resources to benefit
      return (
        calculateCurrentPowerCapacity(engine) >=
        engine.turns[currentTurn].minBuildings * 0.7
      );
    case "B":
      // Worth it if we have power to spare or approaching high thresholds
      return (
        calculateCurrentPowerCapacity(engine) >=
        engine.turns[currentTurn].minBuildings * 0.9
      );
    case "C":
      // Worth it early in the game
      return currentTurn < engine.turns.length * 0.4;
    case "D":
      // Always good if affordable and we can meet minimum requirements
      return (
        calculateCurrentPowerCapacity(engine) >=
        engine.turns[currentTurn].minBuildings
      );
    case "E":
      // Worth it if we anticipate volatility in future turns
      const futureTurns = engine.turns.slice(currentTurn, currentTurn + 5);
      const minRequirementVolatility = calculateVolatility(
        futureTurns.map((t) => t.minBuildings)
      );
      return (
        minRequirementVolatility > 0.15 ||
        currentTurn < engine.turns.length * 0.3
      ); // More valuable early
    default:
      return false;
  }
}

function calculateVolatility(values: number[]): number {
  if (values.length <= 1) return 0;

  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
    values.length;
  return Math.sqrt(variance) / avg; // Coefficient of variation
}
