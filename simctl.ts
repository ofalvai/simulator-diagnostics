import { styles } from "./styles.ts";

/**
 * Custom error classes for different types of failures
 */
export class SimulatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SimulatorError";
  }
}

/**
 * Soft errors that can be reported but don't require aborting the benchmark
 * Examples: Device/runtime not found, simulator not available
 */
export class SoftSimulatorError extends SimulatorError {
  constructor(message: string) {
    super(message);
    this.name = "SoftSimulatorError";
  }
}

/**
 * Hard errors that should abort the benchmark process
 * Examples: Simulator shutdown fails, system commands fail
 */
export class HardSimulatorError extends SimulatorError {
  constructor(message: string) {
    super(message);
    this.name = "HardSimulatorError";
  }
}

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
    throw new SoftSimulatorError(
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

  throw new SoftSimulatorError(
    `No available device found with name "${deviceName}" for iOS version "${iosVersion}"`,
  );
}

export async function eraseDevice(deviceId: string): Promise<void> {
  console.log(`Erasing simulator with ID: ${deviceId} to ensure cold boot...`);

  const command = new Deno.Command("xcrun", {
    args: ["simctl", "erase", deviceId],
  });

  const { code, stderr } = await command.output();

  if (code !== 0) {
    const errorMessage = new TextDecoder().decode(stderr);
    throw new HardSimulatorError(`Failed to erase simulator with ID: ${deviceId}. ${errorMessage}`);
  }

  console.log("%cSimulator erased successfully.", styles.success);
}

export async function measureBootTime(deviceId: string, commands: string[] | null = null): Promise<number> {
  console.log(`Booting simulator with ID: ${deviceId}`);

  const startTime = performance.now();

  // First boot the simulator
  const bootCommand = new Deno.Command("xcrun", {
    args: ["simctl", "bootstatus", deviceId, "-b"],
  });

  const { code: bootCode, stderr } = await bootCommand.output();

  if (bootCode !== 0) {
    const errorMessage = new TextDecoder().decode(stderr);
    throw new HardSimulatorError(`Failed to boot simulator with ID: ${deviceId}. ${errorMessage}`);
  }
  
  // Execute user-specified commands immediately after boot if provided
  if (commands && commands.length > 0) {
    console.log(`Executing ${commands.length} post-boot command(s) in simulator...`);
    
    for (let i = 0; i < commands.length; i++) {
      console.log(`%cExecuting command ${i + 1} of ${commands.length}:%c`, styles.header, styles.reset);
      // Consider all post-boot commands as critical
      await executeCommand(commands[i], true);
    }
  }
  
  console.log(`Basic boot completed. Launching Settings app to verify full usability...`);
  
  // Then launch an app to ensure the simulator is fully usable
  const launchCommand = new Deno.Command("xcrun", {
    args: ["simctl", "launch", "booted", "com.apple.Preferences"],
  });
  
  const { code: launchCode, stderr: launchStderr } = await launchCommand.output();
  
  if (launchCode !== 0) {
    const errorMessage = new TextDecoder().decode(launchStderr);
    throw new HardSimulatorError(`Failed to launch Settings app on booted simulator. ${errorMessage}`);
  }

  const endTime = performance.now();
  const totalTime = Math.round((endTime - startTime) / 1000);
  console.log(`Full boot + app launch time: ${totalTime}s`);
  return endTime - startTime;
}

/**
 * Executes a command in the simulator
 * @param command The command to execute in the simulator
 * @param critical Whether this command is critical and should cause a hard error on failure
 */
export async function executeCommand(command: string, critical: boolean = false): Promise<void> {
  console.log(`Executing in simulator: ${command}`);
  
  try {
    // Use xcrun simctl spawn booted to run the command in the simulator
    const process = new Deno.Command("xcrun", {
      args: ["simctl", "spawn", "booted", ...command.split(' ')],
    });
    
    const { code, stdout, stderr } = await process.output();
    
    if (code === 0) {
      console.log(`%cCommand executed successfully in simulator`, styles.success);
      
      // Display command output if any
      const output = new TextDecoder().decode(stdout).trim();
      if (output) {
        console.log(`Command output:\n${output}`);
      }
    } else {
      const errorOutput = new TextDecoder().decode(stderr).trim();
      console.error(`%cCommand failed in simulator with exit code ${code}`, styles.error);
      
      if (critical) {
        throw new HardSimulatorError(`Critical command failed in simulator: ${command}. Exit code: ${code}. Error: ${errorOutput}`);
      } else {
        throw new SoftSimulatorError(`Command failed in simulator: ${command}. Exit code: ${code}. Error: ${errorOutput}`);
      }
    }
  } catch (error: any) {
    if (error instanceof SimulatorError) {
      throw error; // Re-throw simulator errors
    }
    
    // Handle other types of errors
    console.error(`%cError executing command in simulator: ${error.message}`, styles.error);
    
    if (critical) {
      throw new HardSimulatorError(`Critical error executing command in simulator: ${error.message}`);
    } else {
      throw new SoftSimulatorError(`Error executing command in simulator: ${error.message}`);
    }
  }
}

/**
 * Waits for the system to become idle by monitoring the load average
 * @param idleThreshold The load average threshold to consider the system idle
 * @param idleTimeout Maximum seconds to wait for system to become idle
 * @returns The time in milliseconds that it took for the system to become idle
 */
export async function waitForSystemIdle(idleThreshold: number, idleTimeout: number = 300): Promise<number> {
  
  console.log(`Waiting for system to idle...`);
  const startTime = performance.now();
  let isIdle = false;
  
  // Calculate timeout end time
  const timeoutTime = startTime + (idleTimeout * 1000);
  
  // Poll every few seconds
  while (!isIdle && performance.now() < timeoutTime) {
    const currentTime = performance.now();
    const elapsedSeconds = Math.round((currentTime - startTime) / 1000);
    
    const loadAvg = Deno.loadavg();
    const oneMinuteLoad = loadAvg[0];
    console.log(`[${elapsedSeconds}s] 1m load: ${oneMinuteLoad.toFixed(2)} (threshold: ${idleThreshold})...`);
    
    if (oneMinuteLoad < idleThreshold) {
      isIdle = true;
    } else {
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  const endTime = performance.now();
  const totalIdleWaitTime = Math.round((endTime - startTime) / 1000);
  
  if (isIdle) {
    console.log(`%cSystem idle reached after ${totalIdleWaitTime}s`, styles.success);
  } else {
    console.log(`%cTimed out waiting for system to become idle after ${idleTimeout}s`, styles.warning);
  }
  
  return endTime - startTime;
}

export async function shutdownDevice(deviceId: string): Promise<void> {
  const command = new Deno.Command("xcrun", {
    args: ["simctl", "shutdown", deviceId],
  });

  const { code, stdout, stderr } = await command.output();
  
  if (code !== 0) {
    const combinedOutput = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
    console.error(`%cError shutting down simulator: ${combinedOutput}`, styles.error);
    throw new HardSimulatorError(`Failed to shutdown simulator with ID: ${deviceId}. This is a critical error as it may leave the simulator running.`);
  }

  console.log("%cSimulator shut down successfully.", styles.success);
}
