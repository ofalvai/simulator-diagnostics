import { styles } from "./styles.ts";

interface Device {
  name: string;
  udid: string;
  state: string;
  isAvailable: boolean;
}

interface Devices {
  [version: string]: Device[];
}

interface SimCtlOutput {
  devices: Devices;
}

interface Runtime {
  buildversion: string;
  availability: string;
  name: string;
  identifier: string;
  version: string;
  isAvailable: boolean;
}

interface RuntimesOutput {
  runtimes: Runtime[];
}

// Cache for simulator devices and runtimes to avoid repeated calls to simctl
let cachedDevices: SimCtlOutput | null = null;
let cachedRuntimes: Runtime[] | null = null;

export async function getAllRuntimes(): Promise<Runtime[]> {
  if (cachedRuntimes) {
    return cachedRuntimes;
  }

  const command = new Deno.Command("xcrun", {
    args: ["simctl", "list", "runtimes", "--json"],
  });

  const { stdout } = await command.output();
  const output = new TextDecoder().decode(stdout);
  const runtimesOutput = JSON.parse(output) as RuntimesOutput;

  const iosRuntimes = runtimesOutput.runtimes.filter(
    (runtime) => runtime.name.includes("iOS"),
  );
  cachedRuntimes = iosRuntimes;

  console.log("%cAvailable iOS Runtimes:", styles.header);
  for (const runtime of iosRuntimes) {
    console.log(
      `- ${runtime.name} (version: %c${runtime.version}%c)`,
      styles.iosVersion,
      styles.reset,
    );
  }

  return iosRuntimes;
}

export async function getAllDevices(): Promise<SimCtlOutput> {
  if (cachedDevices) {
    return cachedDevices;
  }

  const command = new Deno.Command("xcrun", {
    args: ["simctl", "list", "devices", "--json"],
  });

  const { stdout } = await command.output();
  const output = new TextDecoder().decode(stdout);
  const simctlOutput = JSON.parse(output) as SimCtlOutput;

  cachedDevices = simctlOutput;

  return simctlOutput;
}

export async function getDeviceId(
  iosVersion: string,
  deviceName: string,
): Promise<string> {
  const runtimes = await getAllRuntimes();

  // Find matching runtime based on version
  const matchingRuntime = runtimes.find((runtime) => {
    // Try different matching strategies:
    // 1. Exact version match (e.g., "17.0")
    if (runtime.version === iosVersion) return true;
    // 2. Runtime name contains version (e.g., "iOS 17.0")
    if (runtime.name.includes(iosVersion)) return true;
    // 3. Check if major version matches for single digit versions (e.g., "17" matches "17.0")
    if (
      iosVersion.length === 2 && !iosVersion.includes(".") &&
      runtime.version.startsWith(iosVersion)
    ) return true;
    return false;
  });

  if (!matchingRuntime) {
    throw new Error(
      `No iOS runtime found matching version "${iosVersion}". Check available runtimes.`,
    );
  }

  const simctlOutput = await getAllDevices();
  const devices = simctlOutput.devices;

  // Try to find device under the exact runtime name
  for (const [runtimeName, deviceList] of Object.entries(devices)) {
    // Match either by runtime identifier or name
    if (
      runtimeName === matchingRuntime.identifier ||
      runtimeName === matchingRuntime.name
    ) {
      for (const device of deviceList) {
        if (device.name === deviceName && device.isAvailable) {
          return device.udid;
        }
      }
    }
  }

  // If not found by direct runtime match, fall back to looking through all devices
  // (sometimes the runtime names don't match exactly between the two APIs)
  for (const [runtimeName, deviceList] of Object.entries(devices)) {
    if (
      runtimeName.includes(matchingRuntime.version) ||
      runtimeName.includes(matchingRuntime.name)
    ) {
      for (const device of deviceList) {
        if (device.name === deviceName && device.isAvailable) {
          return device.udid;
        }
      }
    }
  }

  throw new Error(
    `No available device found with name "${deviceName}" for iOS version "${iosVersion}"`,
  );
}

export async function eraseDevice(deviceId: string): Promise<void> {
  console.log(`Erasing simulator with ID: ${deviceId} to ensure cold boot...`);

  const command = new Deno.Command("xcrun", {
    args: ["simctl", "erase", deviceId],
  });

  const { code } = await command.output();

  if (code !== 0) {
    throw new Error(`Failed to erase simulator with ID: ${deviceId}`);
  }

  console.log("%cSimulator erased successfully.", styles.success);
}

export async function measureBootTime(deviceId: string): Promise<number> {
  console.log(`Booting simulator with ID: ${deviceId}`);

  const startTime = performance.now();

  const command = new Deno.Command("xcrun", {
    args: ["simctl", "bootstatus", deviceId, "-b"],
  });

  const { code } = await command.output();

  if (code !== 0) {
    throw new Error(`Failed to boot simulator with ID: ${deviceId}`);
  }

  const endTime = performance.now();
  return endTime - startTime;
}

export async function shutdownDevice(deviceId: string): Promise<void> {
  console.log(`Shutting down simulator with ID: ${deviceId}...`);

  const command = new Deno.Command("xcrun", {
    args: ["simctl", "shutdown", deviceId],
  });

  const { code } = await command.output();

  if (code !== 0) {
    throw new Error(`Failed to shutdown simulator with ID: ${deviceId}`);
  }

  console.log("%cSimulator shut down successfully.", styles.success);
}
