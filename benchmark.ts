import {
  eraseDevice,
  getDeviceId,
  measureBootTime,
  shutdownDevice,
} from "./simctl.ts";
import { styles } from "./styles.ts";

export interface BenchmarkResult {
  iosVersion: string;
  deviceName: string;
  coldBootTimeMs: number;
  warmBootTimeMs: number;
  differenceMs: number;
  runs: number;
}

/**
 * Benchmarks the boot time of a specific iOS simulator
 * Measures both cold and warm boot times
 */
export async function runBootBenchmark(
  iosVersion: string,
  deviceName: string,
  runCount: number = 1
): Promise<BenchmarkResult | null> {
  try {
    console.log(`\n========================================`);
    console.log(
      `BENCHMARK: iOS %c${iosVersion}%c`,
      styles.iosVersion,
      styles.reset,
    );
    console.log(`========================================`);

    const deviceId = await getDeviceId(iosVersion, deviceName);
    
    let totalColdBootTimeMs = 0;
    let totalWarmBootTimeMs = 0;
    
    for (let i = 0; i < runCount; i++) {
      console.log(`\n--- Run ${i + 1} of ${runCount} ---`);
      
      // COLD BOOT: Erase device to ensure a cold boot
      console.log(`\n--- Cold Boot Test ---`);
      await eraseDevice(deviceId);

      const coldBootTime = await measureBootTime(deviceId);
      totalColdBootTimeMs += coldBootTime;

      // Shut down the simulator after measurement
      await shutdownDevice(deviceId);

      // WARM BOOT: Boot again without erasing for warm boot measurement
      console.log(`\n--- Warm Boot Test ---`);
      const warmBootTime = await measureBootTime(deviceId);
      totalWarmBootTimeMs += warmBootTime;

      // Shut down the simulator after measurement
      await shutdownDevice(deviceId);
    }
    
    // Calculate average times
    const avgColdBootTimeMs = totalColdBootTimeMs / runCount;
    const avgWarmBootTimeMs = totalWarmBootTimeMs / runCount;

    return {
      iosVersion,
      deviceName,
      coldBootTimeMs: avgColdBootTimeMs,
      warmBootTimeMs: avgWarmBootTimeMs,
      differenceMs: avgColdBootTimeMs - avgWarmBootTimeMs,
      runs: runCount,
    };
  } catch (error: any) {
    console.error(
      `%cError benchmarking ${deviceName} (iOS ${iosVersion}): ${error.message}`,
      styles.error,
    );
    return null;
  }
}