import { styles } from "./styles.ts";
import { BenchmarkResult } from "./benchmark.ts";

/**
 * Prints a formatted summary of benchmark results
 * Groups results by iOS version first, then by device if multiple devices
 */
export function printBenchmarkSummary(
  results: BenchmarkResult[],
  deviceNames: string[]
): void {
  if (results.length === 0) {
    console.error("No results to display.");
    return;
  }

  console.log(`\n============================================`);
  console.log(`%cSUMMARY OF ALL BENCHMARKS`, styles.header);
  console.log(`%c(Average across ${results[0]?.runs || 1} runs)`, styles.deviceName);
  console.log(`============================================`);

  // For a single device, just print the results by iOS version
  if (deviceNames.length === 1) {
    printSingleDeviceSummary(results);
  } else {
    // For multiple devices, group by iOS version first, then by device
    printMultiDeviceSummary(results);
  }
}

/**
 * Prints a summary for a single device across multiple iOS versions
 */
function printSingleDeviceSummary(results: BenchmarkResult[]): void {
  const iosGroups = groupResultsByIosVersion(results);

  // Print summary by iOS version
  for (const [iosVersion, iosResults] of iosGroups.entries()) {
    console.log(`\niOS %c${iosVersion}%c:`, styles.iosVersion, styles.reset);

    // We only have one device, so just print its results
    const result = iosResults[0]; // Only one device per iOS version
    console.log(
      `  Cold: %c${Math.round(result.coldBootTimeMs / 1000)}%cs, Warm: %c${
        Math.round(result.warmBootTimeMs / 1000)
      }%cs, Diff: %c${Math.round(result.differenceMs / 1000)}%cs`,
      styles.timingValue,
      styles.reset,
      styles.timingValue,
      styles.reset,
      styles.timingValue,
      styles.reset
    );
  }
}

/**
 * Prints a summary for multiple devices across multiple iOS versions
 */
function printMultiDeviceSummary(results: BenchmarkResult[]): void {
  const iosGroups = groupResultsByIosVersion(results);

  for (const [iosVersion, iosResults] of iosGroups.entries()) {
    console.log(`\niOS %c${iosVersion}%c:`, styles.iosVersion, styles.reset);

    // Print each device's results under this iOS version
    for (const result of iosResults) {
      console.log(
        `  %c${result.deviceName}%c: Cold: %c${Math.round(
          result.coldBootTimeMs / 1000
        )}%cs, Warm: %c${Math.round(result.warmBootTimeMs / 1000)}%cs, Diff: %c${
          Math.round(result.differenceMs / 1000)
        }%cs`,
        styles.deviceName,
        styles.reset,
        styles.timingValue,
        styles.reset,
        styles.timingValue,
        styles.reset,
        styles.timingValue,
        styles.reset
      );
    }
  }
}

/**
 * Groups benchmark results by iOS version
 */
function groupResultsByIosVersion(
  results: BenchmarkResult[]
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
