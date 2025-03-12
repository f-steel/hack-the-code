import { GameEngine } from "./engine";

export function basicStrategy(engine: GameEngine): number[] {
  const turn = engine.turns[engine.currentTurn];
  const affordable = engine.resources
    .filter((r) => r.activationCost <= engine.budget)
    .sort((a, b) => a.activationCost - b.activationCost);

  if (affordable.length === 0) return [];

  // Prioritize E for stability, D for profit boost, then X for simplicity
  const eResource = affordable.find((r) => r.effectType === "E");
  const dResource = affordable.find(
    (r) => r.effectType === "D" && r.effectValue! > 0
  );
  const xResource = affordable.find((r) => r.effectType === "X");

  if (
    eResource &&
    turn.minBuildings >
      engine.activeResources.reduce(
        (sum, r) =>
          sum +
          (r.turnsRemainingActive > 0 ? r.definition.buildingsPowered : 0),
        0
      )
  ) {
    return [eResource.id]; // Buy E if we risk missing minBuildings
  }
  if (dResource) return [dResource.id]; // Boost profit with D
  if (xResource) return [xResource.id]; // Fallback to cheapest X

  return [affordable[0].id]; // Default to cheapest
}
