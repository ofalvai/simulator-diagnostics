import {
  eraseDevice,
  getDeviceId,
  measureBootTime,
  shutdownDevice,
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
  idleTimeout: number = 300
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
    
    let totalBootTimeMs = 0;
    let totalTimeToIdleMs = 0;
    
    for (let i = 0; i < runCount; i++) {
      console.log(`\n--- Run ${i + 1} of ${runCount} ---`);
      
      // Wait for system to stabilize before starting the benchmark
      if (i > 0) { // Skip first run since system is likely already stable
        console.log(`\nWaiting 60 seconds for system load to stabilize...`);
        let waitSecs = 0;
        
        // Show progress every 10 seconds
        while (waitSecs < 60) {
          await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second intervals
          waitSecs += 10;
          const loadAvg = Deno.loadavg();
          console.log(`  Waited ${waitSecs}s of 60s (current 1m load: ${loadAvg[0].toFixed(2)})...`);
        }
        
        console.log(`%cSystem stabilization wait complete.`, styles.success);
      }
      
      // Erase device to ensure a clean state
      console.log(`\n--- Boot Test ---`);
      await eraseDevice(deviceId);

      const bootTime = await measureBootTime(deviceId, spawnCommands);
      totalBootTimeMs += bootTime;

      const timeToIdle = await waitForSystemIdle(idleThreshold, idleTimeout);
      totalTimeToIdleMs += bootTime + timeToIdle;
      
      // Shut down the simulator after measurement
      await shutdownDevice(deviceId);
    }
    
    // Calculate average times
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
    console.error(
      `%cError benchmarking ${deviceName} (iOS ${iosVersion}): ${error.message}`,
      styles.error,
    );
    return null;
  }
}
