import { GameEngine } from "./engine";
import { parseFile } from "./parser";
import { optimizedStrategy, basicStrategy } from "./strategy";
import * as fs from "fs";

const fileName = "input.txt";

(async () => {
  const { budget, turns, resources } = await parseFile(`input/${fileName}`);

  const engine = new GameEngine(budget, turns, resources);

  // Prepare output file
  const outputFile = `output/${fileName}`;
  const outputLines: string[] = [];

  while (!engine.isGameOver()) {
    const buyIds = optimizedStrategy(engine);
    if (buyIds.length > 0) {
      const success = engine.purchaseResources(buyIds);
      if (success) {
        const line = `${engine.currentTurn} ${buyIds.length} ${buyIds.join(
          " "
        )}`;
        outputLines.push(line); // Collect lines for file
        console.log(line); // Optional: keep console output
      }
    }
    engine.runTurn();
  }

  // Write to file
  fs.writeFileSync(outputFile, outputLines.join("\n"), "utf8");
  console.log(`Output written to ${outputFile}`);
  console.log(`Total Score: ${engine.getTotalScore()}`);
})();
