import { GameEngine } from "./engine";
import { ResourceDefinition } from "./types";

export function optimizedStrategy(engine: GameEngine): number[] {
  const currentTurn = engine.currentTurn;
  const affordableResources = engine.resources
    .filter((r) => r.activationCost <= engine.budget)
    .sort((a, b) => a.activationCost - b.activationCost);

  if (affordableResources.length === 0) return [];

  const scoredResources = affordableResources
    .map((r) => ({
      resource: r,
      score: calculateResourceScore(r, engine),
    }))
    .sort((a, b) => b.score - a.score);

  const purchases: ResourceDefinition[] = [];
  let remainingBudget = engine.budget;

  // 1. Priority to IMMEDIATE power-generating resources
  const criticalResources = scoredResources.filter(
    (sr) =>
      sr.resource.buildingsPowered > 0 &&
      sr.resource.activationCost <= remainingBudget
  );

  // 2. Buy as many critical resources as possible
  criticalResources.forEach(({ resource }) => {
    const maxCount = Math.min(
      Math.floor(remainingBudget / resource.activationCost),
      50 - purchases.length
    );
    if (maxCount > 0) {
      purchases.push(...Array(maxCount).fill(resource));
      remainingBudget -= maxCount * resource.activationCost;
    }
  });

  // 3. Then consider effect resources
  scoredResources.forEach(({ resource }) => {
    if (
      resource.buildingsPowered === 0 &&
      resource.activationCost <= remainingBudget &&
      purchases.length < 50
    ) {
      purchases.push(resource);
      remainingBudget -= resource.activationCost;
    }
  });

  return purchases.map((r) => r.id);
}

function calculateResourceScore(
  res: ResourceDefinition,
  engine: GameEngine
): number {
  const currentTurn = engine.currentTurn;
  const turnsLeft = engine.turns.length - currentTurn;
  let score = 0;

  // Base scoring - prioritize immediate power generation
  const immediatePower = res.buildingsPowered > 0 ? 1000 : 1;
  const costEfficiency =
    immediatePower / (res.activationCost + res.periodicCost);

  // Effect bonuses
  let effectBonus = 1;
  switch (res.effectType) {
    case "B":
      effectBonus = 1.5; // Helps meet TM thresholds
      break;
    case "A":
    case "D":
      effectBonus = 1.3;
      break;
    case "E":
      effectBonus = 0.7; // De-prioritize accumulators without base power
  }

  // Lifecycle alignment
  const lifeBonus = res.lifecycle >= turnsLeft ? 2 : 1;

  score = costEfficiency * effectBonus * lifeBonus;

  // Massive boost for resources that can help meet current TM
  const currentTM = engine.turns[currentTurn].minBuildings;
  if (res.buildingsPowered > 0 && res.buildingsPowered >= currentTM / 5) {
    score *= 5;
  }

  return score;
}
