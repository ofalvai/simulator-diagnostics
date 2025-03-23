import { getAllRuntimes, getCoreSimulatorVersion, getMacOSVersion } from "./simctl.ts";
import { runBootBenchmark } from "./benchmark.ts";
import { printBenchmarkSummary } from "./reporting.ts";
import { styles } from "./styles.ts";

/**
 * Runs the benchmark-boot command that measures iOS simulator boot times
 */
export async function benchmarkBootCommand(
  iosVersions: string[],
  deviceNames: string[],
  runCount: number = 1,
  idleThreshold: number = 2.0,
  spawnCommands: string[] | null = null,
  idleTimeout: number = 300
): Promise<void> {
  if (iosVersions.length === 0 || deviceNames.length === 0) {
    console.error("Please provide both --ios and --device flags");
    console.error(
      'Example: deno run main.ts benchmark-boot --ios 16.4 --ios 17.0 --device "iPhone 15" --device "iPhone 14" --runs 3'
    );
    Deno.exit(1);
  }

  const macOSVersion = await getMacOSVersion();
  const coreSimulatorVersion = await getCoreSimulatorVersion();
  
  console.log(`%cmacOS version: %c${macOSVersion}`, styles.header, styles.timingValue);
  console.log(`%cCoreSimulator.framework version: %c${coreSimulatorVersion}`, styles.header, styles.timingValue);

  console.log("Gathering information about available iOS runtimes...");
  await getAllRuntimes();

  console.log(
    `\nStarting benchmarks for %c${iosVersions.length}%c iOS version(s) and %c${deviceNames.length}%c device(s) with %c${runCount}%c run(s)...`,
    styles.timingValue,
    styles.reset,
    styles.timingValue,
    styles.reset,
    styles.timingValue,
    styles.reset
  );

  const results = [];

  // Display the commands that will be spawned after boot if provided
  if (spawnCommands && spawnCommands.length > 0) {
    console.log(`%cCommands to execute in simulator after boot:`, styles.header);
    spawnCommands.forEach((cmd, index) => {
      console.log(`  %c${index + 1}. %c${cmd}`, styles.timingValue, styles.deviceName);
    });
  }

  // Run benchmark for each combination of iOS version and device
  for (const iosVersion of iosVersions) {
    for (const deviceName of deviceNames) {
      const result = await runBootBenchmark(iosVersion, deviceName, runCount, idleThreshold, spawnCommands, idleTimeout);
      if (result) {
        results.push(result);
      }
    }
  }

  // Print summary of results
  printBenchmarkSummary(results, deviceNames);
}
