import {
  eraseDevice,
  getDeviceId,
  HardSimulatorError,
  measureBootTime,
  shutdownDevice,
  SoftSimulatorError,
  waitForSystemIdle,
} from "./simctl.ts";
import { styles } from "./styles.ts";

export interface BenchmarkResult {
  iosVersion: string;
  deviceName: string;
  bootTimeMs: number;
  runs: number;
  timeToIdleMs?: number; // Time until system becomes idle after boot
}

/**
 * Benchmarks the boot time of a specific iOS simulator
 * Measures boot time and time to system idle
 *
 * @param iosVersion The iOS version to benchmark
 * @param deviceName The device name to benchmark
 * @param runCount Number of times to repeat benchmarks
 * @param idleThreshold Load average threshold to consider system idle
 * @param spawnCommands Commands to execute in simulator after boot
 * @param idleTimeout Maximum seconds to wait for system to become idle
 */
export async function runBootBenchmark(
  iosVersion: string,
  deviceName: string,
  runCount: number = 1,
  idleThreshold: number = 2.0,
  spawnCommands: string[] | null = null,
  idleTimeout: number = 300,
): Promise<BenchmarkResult | null> {
  try {
    console.log(`\n========================================`);
    console.log(
      `BENCHMARK: iOS ${styles.iosVersion(iosVersion)}`
    );
    console.log(`========================================`);

    // Get device ID - a SoftSimulatorError here means device/runtime not found
    const deviceId = await getDeviceId(iosVersion, deviceName);

    let totalBootTimeMs = 0;
    let totalTimeToIdleMs = 0;

    for (let i = 0; i < runCount; i++) {
      console.log(`\n--- Run ${i + 1} of ${runCount} ---`);

      if (i > 0) { // Skip first run since system is likely already stable
        console.log(`\nWaiting 60 seconds for system load to stabilize...`);
        let waitSecs = 0;

        while (waitSecs < 60) {
          await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 second intervals
          waitSecs += 10;
          const loadAvg = Deno.loadavg();
          console.log(
            `  Waited ${waitSecs}s of 60s (current 1m load: ${
              loadAvg[0].toFixed(2)
            })...`,
          );
        }
      }

      console.log(`\n--- Boot Test ---`);
      await eraseDevice(deviceId);

      const bootTime = await measureBootTime(deviceId, spawnCommands);
      totalBootTimeMs += bootTime;

      const timeToIdle = await waitForSystemIdle(idleThreshold, idleTimeout);
      totalTimeToIdleMs += bootTime + timeToIdle;

      await shutdownDevice(deviceId);
    }

    const avgBootTimeMs = totalBootTimeMs / runCount;
    const avgTimeToIdleMs = totalTimeToIdleMs / runCount;

    return {
      iosVersion,
      deviceName,
      bootTimeMs: avgBootTimeMs,
      runs: runCount,
      timeToIdleMs: avgTimeToIdleMs,
    };
  } catch (error: any) {
    if (error instanceof SoftSimulatorError) {
      // Soft errors (like device not found) are reported but allow other benchmarks to continue
      console.error(
        styles.error(`Non-critical error benchmarking ${deviceName} (iOS ${iosVersion}): ${error.message}`)
      );
      return null; // Return null to skip this benchmark
    } else if (error instanceof HardSimulatorError) {
      // Hard errors (like simulator shutdown failure) abort this benchmark but allow others
      console.error(
        styles.error(`Critical error benchmarking ${deviceName} (iOS ${iosVersion}): ${error.message}`)
      );

      // Try to clean up by shutting down the simulator if we have a device ID
      try {
        console.log(
          styles.warning(`Attempting to shut down simulator to avoid leaving it running...`)
        );
        await shutdownDevice("booted");
      } catch (shutdownError: any) {
        console.error(
          styles.error(`Failed to shut down simulator during error recovery: ${shutdownError.message}`)
        );
      }

      return null; // Return null to skip this benchmark but continue with others
    } else {
      // Other unexpected errors
      console.error(
        styles.error(`Unexpected error benchmarking ${deviceName} (iOS ${iosVersion}): ${error.message}`)
      );
      throw error; // Re-throw unexpected errors to be handled at the command level
    }
  }
}
