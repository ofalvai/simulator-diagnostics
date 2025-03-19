#!/usr/bin/env -S deno run --allow-run --allow-read

import { parseArgs } from "@std/cli";
import { benchmarkBootCommand } from "./commands.ts";

/**
 * iOS Simulator Diagnostics CLI
 * A tool for measuring and benchmarking iOS simulator performance
 */

// Entry point
if (import.meta.main) {
  main();
}

/**
 * Main function that parses command line arguments and dispatches to appropriate command handlers
 */
async function main() {
  const { _: subcommands, ...flags } = parseArgs(Deno.args, {
    collect: ["ios", "device"], // Allow multiple iOS versions and devices
    string: ["ios", "device"], // Treat flags as strings
  });

  const command = subcommands[0];

  if (!command) {
    printUsage();
    Deno.exit(1);
  }

  // Process commands
  switch (command) {
    case "benchmark-boot": {
      const { ios, device } = flags;

      // Convert to arrays, handling both single and multiple values
      const iosVersions = ios ? (Array.isArray(ios) ? ios : [ios]) : [];
      const deviceNames = device
        ? (Array.isArray(device) ? device : [device])
        : [];

      await benchmarkBootCommand(iosVersions, deviceNames);
      break;
    }
    default: {
      console.error(`Unknown command: ${command}`);
      printUsage();
      Deno.exit(1);
    }
  }
}

/**
 * Prints CLI usage information
 */
function printUsage(): void {
  console.error("iOS Simulator Diagnostics");
  console.error("\nUsage:");
  console.error("  deno run main.ts <command> [options]");
  console.error("\nAvailable Commands:");
  console.error("  benchmark-boot    Benchmark iOS simulator boot times");
  console.error("\nOptions for benchmark-boot:");
  console.error(
    "  --ios <version>   iOS version to benchmark (can be used multiple times)",
  );
  console.error(
    "  --device <name>   Device name to benchmark (can be used multiple times)",
  );
  console.error("\nExample:");
  console.error(
    '  deno run main.ts benchmark-boot --ios 16.4 --ios 17.0 --device "iPhone 15" --device "iPhone 14"',
  );
  console.error("\nDiagnostic Information:");
  console.error("  • Shows CoreSimulator framework version");
  console.error("  • Lists available iOS simulator runtimes");
  console.error("  • Provides detailed boot time benchmarks for specified devices and iOS versions");
}
