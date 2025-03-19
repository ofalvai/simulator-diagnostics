import { getAllRuntimes } from "./simctl.ts";
import { runBootBenchmark } from "./benchmark.ts";
import { printBenchmarkSummary } from "./reporting.ts";
import { styles } from "./styles.ts";

/**
 * Runs the benchmark-boot command that measures iOS simulator boot times
 */
export async function benchmarkBootCommand(
  iosVersions: string[],
  deviceNames: string[]
): Promise<void> {
  if (iosVersions.length === 0 || deviceNames.length === 0) {
    console.error("Please provide both --ios and --device flags");
    console.error(
      'Example: deno run main.ts benchmark-boot --ios 16.4 --ios 17.0 --device "iPhone 15" --device "iPhone 14"'
    );
    Deno.exit(1);
  }

  console.log("Gathering information about available iOS runtimes...");
  await getAllRuntimes();

  console.log(
    `\nStarting benchmarks for %c${iosVersions.length}%c iOS version(s) and %c${deviceNames.length}%c device(s)...`,
    styles.timingValue,
    styles.reset,
    styles.timingValue,
    styles.reset
  );

  const results = [];

  // Run benchmark for each combination of iOS version and device
  for (const iosVersion of iosVersions) {
    for (const deviceName of deviceNames) {
      const result = await runBootBenchmark(iosVersion, deviceName);
      if (result) {
        results.push(result);
      }
    }
  }

  // Print summary of results
  printBenchmarkSummary(results, deviceNames);
}