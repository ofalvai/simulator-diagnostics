# iOS Simulator Diagnostics

A small CLI tool for measuring and benchmarking iOS simulator performance on macOS, comparing different sim runtimes on the same machine.


## Usage

```bash
brew install deno
deno run --allow-run --allow-sys src/main.ts benchmark-boot \
  --runs 3 \
  --ios 18.4 --ios 18.3 --ios 18.1 --ios 18.0 --ios 17.5 --ios 16.4 \
  --idle-threshold 8 \
  --device 'iPhone 11' \
  --idle-timeout 1000 \
  --spawn-after-boot "launchctl bootout system/com.apple.diagnosticd"
```

Output:

```
SUMMARY OF ALL BENCHMARKS
(Average across 3 runs)
============================================
┌───────┬─────────────┬─────────────────┬────────────────────┐
│ (idx) │ iOS Version │ Boot Time (sec) │ Time to Idle (sec) │
├───────┼─────────────┼─────────────────┼────────────────────┤
│     0 │ "18.4"      │ "32.8"          │ "187.1"            │
│     1 │ "18.3"      │ "30.0"          │ "191.3"            │
│     2 │ "18.1"      │ "25.7"          │ "208.0"            │
│     3 │ "18.0"      │ "29.4"          │ "206.7"            │
│     4 │ "17.5"      │ "27.1"          │ "122.4"            │
│     5 │ "16.4"      │ "22.2"          │ "98.3"             │
└───────┴─────────────┴─────────────────┴────────────────────┘
```

## What It Measures

- **Boot Time**: Time from simulator launch to the point `simctl` reports it as booted
- **Time to Idle**: Total time from launch until system load average drops below threshold
- **System Information**: macOS version, CoreSimulator framework version, available iOS runtimes

## Command Options

### `benchmark-boot`

Benchmark iOS simulator boot times with the following options:

- `--ios <version>` - iOS version to benchmark (can be used multiple times)
- `--device <name>` - Device name to benchmark (can be used multiple times)  
- `--runs <number>` - Number of times to repeat benchmarks (default: 1)
- `--idle-threshold <number>` - Load average threshold to consider system idle (default: 2.0)
- `--idle-timeout <seconds>` - Maximum time to wait for system to become idle (default: 300)
- `--spawn-after-boot <command>` - Command to execute in simulator after boot (can be specified multiple times)


