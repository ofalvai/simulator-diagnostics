export async function getCoreSimulatorVersion(): Promise<string> {
  const command = new Deno.Command("/usr/libexec/PlistBuddy", {
    args: [
      "-c",
      "print 'CFBundleVersion'",
      "/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Resources/Info.plist",
    ],
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
