import { parseArgs } from "@std/cli";
import {
  eraseDevice,
  getAllRuntimes,
  getDeviceId,
  measureBootTime,
  shutdownDevice,
} from "./simctl.ts";
import { styles } from "./styles.ts";

if (import.meta.main) {
  main();
}

async function runBootBenchmark(iosVersion: string, deviceName: string) {
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

async function main() {
  const { _: subcommands, ...flags } = parseArgs(Deno.args, {
    collect: ["ios", "device"], // Allow multiple iOS versions and devices
    string: ["ios", "device"], // Stream flags as strings
  });

  const command = subcommands[0];

  if (!command) {
    console.error("Please provide a command: benchmark-boot");
    Deno.exit(1);
  }

  if (command === "benchmark-boot") {
    const { ios, device } = flags;

    if (!ios || !device) {
      console.error("Please provide both --ios and --device flags");
      console.error(
        'Example: deno run main.ts benchmark-boot --ios 16.4 --ios 17.0 --device "iPhone 15" --device "iPhone 14"',
      );
      Deno.exit(1);
    }

    console.log("Gathering information about available iOS runtimes...");
    await getAllRuntimes();

    const iosVersions = Array.isArray(ios) ? ios : [ios];
    const deviceNames = Array.isArray(device) ? device : [device];
    const results = [];

    console.log(
      `\nStarting benchmarks for %c${iosVersions.length}%c iOS version(s) and %c${deviceNames.length}%c device(s)...`,
      styles.timingValue,
      styles.reset,
      styles.timingValue,
      styles.reset,
    );

    // Run benchmark for each combination of iOS version and device
    for (const iosVersion of iosVersions) {
      for (const deviceName of deviceNames) {
        const result = await runBootBenchmark(iosVersion, deviceName);
        if (result) {
          results.push(result);
        }
      }
    }

    // Print comprehensive summary if multiple tests were run
    if (results.length > 1) {
      console.log(`\n============================================`);
      console.log(`%cSUMMARY OF ALL BENCHMARKS`, styles.header);
      console.log(`============================================`);

      // Group by device
      const deviceGroups = new Map<string, any[]>();

      for (const result of results) {
        if (!deviceGroups.has(result.deviceName)) {
          deviceGroups.set(result.deviceName, []);
        }
        deviceGroups.get(result.deviceName)?.push(result);
      }

      // Print summary by device
      for (const [deviceName, deviceResults] of deviceGroups.entries()) {
        console.log(`\n%c${deviceName}:`, styles.deviceName);
        deviceResults.forEach((result) => {
          console.log(
            `  iOS %c${result.iosVersion}%c: Cold: %c${
              Math.round(result.coldBootTimeMs / 1000)
            }%cs, Warm: %c${
              Math.round(result.warmBootTimeMs / 1000)
            }%cs, Diff: %c${Math.round(result.differenceMs / 1000)}%cs`,
            styles.iosVersion,
            styles.reset,
            styles.timingValue,
            styles.reset,
            styles.timingValue,
            styles.reset,
            styles.timingValue,
            styles.reset,
          );
        });
      }
    }
  } else {
    console.error(`Unknown command: ${command}`);
    console.error("Available commands: benchmark-boot");
    Deno.exit(1);
  }
}
