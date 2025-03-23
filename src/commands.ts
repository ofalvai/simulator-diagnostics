import { runBootBenchmark } from "./benchmark.ts";
import { getCoreSimulatorVersion, getMacOSVersion } from "./macos.ts";
import { printBenchmarkSummary } from "./reporting.ts";
import { getAllRuntimes } from "./simctl.ts";
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
  idleTimeout: number = 300,
): Promise<void> {
  if (iosVersions.length === 0 || deviceNames.length === 0) {
    console.error("Please provide both --ios and --device flags");
    console.error(
      'Example: deno run main.ts benchmark-boot --ios 16.4 --ios 17.0 --device "iPhone 15" --device "iPhone 14" --runs 3',
    );
    Deno.exit(1);
  }

  const macOSVersion = await getMacOSVersion();
  const coreSimulatorVersion = await getCoreSimulatorVersion();

  console.log(
    `${styles.header('macOS version:')} ${styles.timingValue(macOSVersion)}`
  );
  console.log(
    `${styles.header('CoreSimulator.framework version:')} ${styles.timingValue(coreSimulatorVersion)}`
  );

  console.log("Gathering information about available iOS runtimes...");
  await getAllRuntimes();

  console.log(
    `\nStarting benchmarks for ${styles.timingValue(iosVersions.length.toString())} iOS version(s) and ${styles.timingValue(deviceNames.length.toString())} device(s) with ${styles.timingValue(runCount.toString())} run(s)...`
  );

  const results = [];

  if (spawnCommands && spawnCommands.length > 0) {
    console.log(
      styles.header(`Commands to execute in simulator after boot:`)
    );
    spawnCommands.forEach((cmd, index) => {
      console.log(
        `  ${styles.timingValue((index + 1).toString())}. ${styles.deviceName(cmd)}`
      );
    });
  }

  try {
    for (const iosVersion of iosVersions) {
      for (const deviceName of deviceNames) {
        const result = await runBootBenchmark(
          iosVersion,
          deviceName,
          runCount,
          idleThreshold,
          spawnCommands,
          idleTimeout,
        );
        if (result) {
          results.push(result);
        }
      }
    }
  } catch (error) {
    // Only unexpected errors should reach this level
    console.error(
      styles.error(`Benchmark process aborted due to unexpected error`)
    );
    console.error(error);
  } finally {
    if (results.length > 0) {
      printBenchmarkSummary(results, deviceNames);
    } else {
      console.error(
        styles.error(`No benchmark results were collected due to errors`)
      );
    }
  }
}
