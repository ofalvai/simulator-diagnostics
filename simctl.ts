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

export async function getCoreSimulatorVersion(): Promise<string> {
  const command = new Deno.Command("/usr/libexec/PlistBuddy", {
    args: ["-c", "print 'CFBundleVersion'", "/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Resources/Info.plist"],
  });

  try {
    const { stdout } = await command.output();
    return new TextDecoder().decode(stdout).trim();
  } catch (error) {
    console.error("Failed to get CoreSimulator version:", error);
    return "unknown";
  }
}

export async function getMacOSVersion(): Promise<string> {
  const command = new Deno.Command("sw_vers", {
    args: ["--productVersion"],
  });

  try {
    const { stdout } = await command.output();
    return new TextDecoder().decode(stdout).trim();
  } catch (error) {
    console.error("Failed to get macOS version:", error);
    return "unknown";
  }
}

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

  // First boot the simulator
  const bootCommand = new Deno.Command("xcrun", {
    args: ["simctl", "bootstatus", deviceId, "-b"],
  });

  const { code: bootCode } = await bootCommand.output();

  if (bootCode !== 0) {
    throw new Error(`Failed to boot simulator with ID: ${deviceId}`);
  }
  
  console.log(`Basic boot completed. Launching Settings app to verify full usability...`);
  
  // Then launch an app to ensure the simulator is fully usable
  const launchCommand = new Deno.Command("xcrun", {
    args: ["simctl", "launch", "booted", "com.apple.Preferences"],
  });
  
  const { code: launchCode } = await launchCommand.output();
  
  if (launchCode !== 0) {
    throw new Error(`Failed to launch Settings app on booted simulator`);
  }

  const endTime = performance.now();
  const totalTime = Math.round((endTime - startTime) / 1000);
  console.log(`Full boot + app launch time: ${totalTime}s`);
  return endTime - startTime;
}

/**
 * Executes a command in the simulator
 * @param command The command to execute in the simulator
 */
export async function executeCommand(command: string): Promise<void> {
  console.log(`Executing in simulator: ${command}`);
  
  try {
    // Use xcrun simctl spawn booted to run the command in the simulator
    const process = new Deno.Command("xcrun", {
      args: ["simctl", "spawn", "booted", ...command.split(' ')],
    });
    
    const { code, stdout } = await process.output();
    
    if (code === 0) {
      console.log(`%cCommand executed successfully in simulator`, styles.success);
      
      // Display command output if any
      const output = new TextDecoder().decode(stdout).trim();
      if (output) {
        console.log(`Command output:\n${output}`);
      }
    } else {
      console.error(`%cCommand failed in simulator with exit code ${code}`, styles.error);
    }
  } catch (error) {
    console.error(`%cError executing command in simulator: ${error.message}`, styles.error);
  }
}

/**
 * Waits for the system to become idle by monitoring the load average
 * @param idleThreshold The load average threshold to consider the system idle
 * @param commandToRun Optional command to run before waiting for idle
 * @returns The time in milliseconds that it took for the system to become idle
 */
export async function waitForSystemIdle(idleThreshold: number, commandToRun: string | null = null): Promise<number> {
  // If a command was provided, execute it first
  if (commandToRun) {
    await executeCommand(commandToRun);
  }
  
  console.log(`Waiting for system to idle...`);
  const startTime = performance.now();
  let isIdle = false;
  
  // Poll every few seconds
  while (!isIdle) {
    const loadAvg = Deno.loadavg();
    const oneMinuteLoad = loadAvg[0];
    console.log(`1m load: ${oneMinuteLoad.toFixed(2)} (threshold: ${idleThreshold})...`);
    
    if (oneMinuteLoad < idleThreshold) {
      isIdle = true;
    } else {
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  const endTime = performance.now();
  const totalIdleWaitTime = Math.round((endTime - startTime) / 1000);
  console.log(`%cSystem idle reached after ${totalIdleWaitTime}s`, styles.success);
  
  return endTime - startTime;
}

export async function shutdownDevice(deviceId: string): Promise<void> {
  const command = new Deno.Command("xcrun", {
    args: ["simctl", "shutdown", deviceId],
  });

  const { code } = await command.output();

  if (code !== 0) {
    throw new Error(`Failed to shutdown simulator with ID: ${deviceId}`);
  }

  console.log("%cSimulator shut down successfully.", styles.success);
}
