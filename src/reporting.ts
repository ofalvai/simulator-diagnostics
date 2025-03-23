import { styles } from "./styles.ts";
import { BenchmarkResult } from "./benchmark.ts";

/**
 * Prints a formatted summary of benchmark results
 * Groups results by device with iOS versions as rows in a table
 * Uses console.table() for a cleaner tabular display
 */
export function printBenchmarkSummary(
  results: BenchmarkResult[],
  deviceNames: string[],
): void {
  if (results.length === 0) {
    console.error("No results to display.");
    return;
  }

  console.log(`\n============================================`);
  console.log(styles.header('SUMMARY OF ALL BENCHMARKS'));
  console.log(
    styles.deviceName(`(Average across ${results[0]?.runs || 1} runs)`),
  );
  console.log(`============================================`);

  // If we only have one device, just pass the results directly
  if (deviceNames.length === 1) {
    printResultTable(results);
  } else {
    // For multiple devices, group by device and show a table for each
    const deviceGroups = groupResultsByDevice(results);
    for (const [deviceName, deviceResults] of deviceGroups) {
      console.log(`\n${styles.deviceName(`Device: ${deviceName}`)}`);
      printResultTable(deviceResults);
    }
  }
}

/**
 * Creates and prints a table for a set of benchmark results
 */
function printResultTable(results: BenchmarkResult[]): void {
  const tableData = results.map((result) => ({
    "iOS Version": result.iosVersion,
    "Boot Time (sec)": (result.bootTimeMs / 1000).toFixed(1),
    "Time to Idle (sec)": result.timeToIdleMs
      ? (result.timeToIdleMs / 1000).toFixed(1)
      : "N/A",
  }));

  console.table(tableData);
}

/**
 * Groups benchmark results by device name
 */
function groupResultsByDevice(
  results: BenchmarkResult[],
): Map<string, BenchmarkResult[]> {
  const deviceGroups = new Map<string, BenchmarkResult[]>();

  for (const result of results) {
    if (!deviceGroups.has(result.deviceName)) {
      deviceGroups.set(result.deviceName, []);
    }
    deviceGroups.get(result.deviceName)?.push(result);
  }

  return deviceGroups;
}

/**
 * Groups benchmark results by iOS version
 */
function groupResultsByIosVersion(
  results: BenchmarkResult[],
): Map<string, BenchmarkResult[]> {
  const iosGroups = new Map<string, BenchmarkResult[]>();

  for (const result of results) {
    if (!iosGroups.has(result.iosVersion)) {
      iosGroups.set(result.iosVersion, []);
    }
    iosGroups.get(result.iosVersion)?.push(result);
  }

  return iosGroups;
}
