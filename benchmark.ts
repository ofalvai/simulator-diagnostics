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
}

/**
 * Benchmarks the boot time of a specific iOS simulator
 * Measures both cold and warm boot times
 */
export async function runBootBenchmark(
  iosVersion: string,
  deviceName: string
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

    // COLD BOOT: Erase device to ensure a cold boot
    console.log(`\n--- Cold Boot Test ---`);
    await eraseDevice(deviceId);

    const coldBootTimeMs = await measureBootTime(deviceId);

    // Shut down the simulator after measurement
    await shutdownDevice(deviceId);

    // WARM BOOT: Boot again without erasing for warm boot measurement
    console.log(`\n--- Warm Boot Test ---`);
    const warmBootTimeMs = await measureBootTime(deviceId);

    // Shut down the simulator after measurement
    await shutdownDevice(deviceId);

    return {
      iosVersion,
      deviceName,
      coldBootTimeMs,
      warmBootTimeMs,
      differenceMs: coldBootTimeMs - warmBootTimeMs,
    };
  } catch (error: any) {
    console.error(
      `%cError benchmarking ${deviceName} (iOS ${iosVersion}): ${error.message}`,
      styles.error,
    );
    return null;
  }
}