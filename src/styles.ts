import { blue, bold, green, magenta, red, yellow } from "@std/fmt/colors";

export function resetColor(text: string): string {
  return text;
}

// Export styling functions that can be nested in console.log
export const styles = {
  header: (text: string) => bold(blue(text)),
  success: (text: string) => green(text),
  warning: (text: string) => yellow(text),
  error: (text: string) => red(text),

  deviceName: (text: string) => bold(magenta(text)),
  iosVersion: (text: string) => bold(blue(text)),

  timingValue: (text: string) => red(text),

  // For backward compatibility with code that hasn't been refactored yet
  reset: "",
};
