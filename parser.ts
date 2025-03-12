import fs from "fs";
import readline from "readline";
import { ResourceDefinition, ResourceEffectType, Turn } from "./types";

export async function parseFile(filePath: string): Promise<{
  budget: number;
  turns: Turn[];
  resources: ResourceDefinition[];
}> {
  return new Promise((resolve) => {
    const readStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: readStream,
      crlfDelay: Infinity,
    });

    let budget = 0;
    let resourceCount = 0;
    let turnCount = 0;
    let lineIndex = 0;
    const turns: Turn[] = [];
    const resources: ResourceDefinition[] = [];

    rl.on("line", (line) => {
      const parts = line.trim().split(" ");
      if (lineIndex === 0) {
        // First line: D R T
        budget = parseInt(parts[0], 10);
        resourceCount = parseInt(parts[1], 10);
        turnCount = parseInt(parts[2], 10);
      } else if (lineIndex <= resourceCount) {
        // Resource lines
        const [
          id,
          activationCost,
          periodicCost,
          activeTurns,
          maintenanceTurns,
          lifecycle,
          buildingsPowered,
          effectType,
          effectValue,
        ] = parts;
        resources.push({
          id: parseInt(id, 10),
          activationCost: parseInt(activationCost, 10),
          periodicCost: parseInt(periodicCost, 10),
          activeTurns: parseInt(activeTurns, 10),
          maintenanceTurns: parseInt(maintenanceTurns, 10),
          lifecycle: parseInt(lifecycle, 10),
          buildingsPowered: parseInt(buildingsPowered, 10),
          effectType: effectType as ResourceEffectType,
          effectValue: effectValue ? parseInt(effectValue, 10) : undefined,
        });
      } else {
        // Turn lines
        const [minBuildings, maxBuildings, profitPerBuilding] = parts;
        turns.push({
          minBuildings: parseInt(minBuildings, 10),
          maxBuildings: parseInt(maxBuildings, 10),
          profitPerBuilding: parseInt(profitPerBuilding, 10),
        });
      }
      lineIndex++;
    });

    rl.on("close", () => {
      resolve({ budget, turns, resources });
    });
  });
}
