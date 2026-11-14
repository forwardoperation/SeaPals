import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

if (process.platform !== "darwin") {
  throw new Error("This smoke check requires a Mac with Xcode and an iOS simulator runtime.");
}

const appPath = process.env.SEAREALM_SIMULATOR_APP;
const outputPath = process.env.SEAREALM_IOS_OUTPUT;
if (!appPath || !existsSync(appPath) || !outputPath) {
  throw new Error("Set SEAREALM_SIMULATOR_APP to the built .app and SEAREALM_IOS_OUTPUT to the output directory.");
}
mkdirSync(outputPath, { recursive: true });

function command(executable, args, timeout = 120_000) {
  const result = spawnSync(executable, args, { encoding: "utf8", timeout });
  if (result.error || result.status !== 0) {
    throw new Error(`${executable} ${args.join(" ")} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  }
  return result.stdout.trim();
}

const simctl = (...args) => command("xcrun", ["simctl", ...args]);
const bundleId = command("/usr/libexec/PlistBuddy", ["-c", "Print CFBundleIdentifier", path.join(appPath, "Info.plist")]);
const available = JSON.parse(simctl("list", "devices", "available", "--json")).devices;
const runtimeEntries = Object.entries(available)
  .filter(([runtime]) => runtime.includes(".iOS-"))
  .sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }));
const results = [];

for (const family of ["iPhone", "iPad"]) {
  const match = runtimeEntries.flatMap(([runtime, devices]) => devices
    .filter((device) => device.isAvailable && device.name.startsWith(family))
    .map((device) => ({ ...device, runtime })))[0];
  if (!match) throw new Error(`No available ${family} simulator. Install an iOS runtime in Xcode.`);
  console.log(`Launching SeaRealm on ${match.name} (${match.runtime}).`);
  try {
    if (match.state !== "Booted") simctl("boot", match.udid);
    simctl("bootstatus", match.udid, "-b");
    simctl("status_bar", match.udid, "override", "--time", "9:41", "--batteryState", "charged", "--batteryLevel", "100");
    simctl("install", match.udid, appPath);
    const launch = simctl("launch", "--terminate-running-process", match.udid, bundleId);
    console.log(launch);
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    // A successful launch alone can hide an immediate crash. Verify the app
    // still has a running process before saving evidence of the native UI.
    const processes = simctl("spawn", match.udid, "launchctl", "list");
    const processLine = processes.split("\n").find((line) => line.includes(bundleId) && /^\d+\s/.test(line));
    if (!processLine) throw new Error(`SeaRealm exited after launch on ${match.name}.`);
    const screenshot = `${family.toLowerCase()}-home.png`;
    simctl("io", match.udid, "screenshot", path.join(outputPath, screenshot));
    results.push({ family, device: match.name, runtime: match.runtime, bundleId, launch, screenshot });
    writeFileSync(path.join(outputPath, "simulator-launches.json"), JSON.stringify(results, null, 2));
  } finally {
    // These are disposable CI simulators, shut down between families to leave
    // enough memory for WKWebView on the standard hosted Mac.
    spawnSync("xcrun", ["simctl", "shutdown", match.udid], { encoding: "utf8", timeout: 30_000 });
  }
}
console.log("Both native simulator launches passed. Inspect the screenshots for rendering problems.");
