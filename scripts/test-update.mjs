// Updates Nebula Terminal 2.11.0 to the installer just built, the way the app's own
// updater does, and checks that Shelduck took its place: one app in Windows' list,
// the same settings, the same launchers. Then uninstalls and checks nothing is left.
// Windows only, and it changes the machine: CI runs it, on a runner that is thrown away.
//
//   node scripts/test-update.mjs nsis <Nebula Terminal setup.exe> <Shelduck setup.exe>
//   node scripts/test-update.mjs msi  <Nebula Terminal .msi>      <Shelduck .msi>

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const [kind, formerInstaller, installer] = process.argv.slice(2);
if (!["nsis", "msi"].includes(kind) || !formerInstaller || !installer) {
  console.error("usage: node scripts/test-update.mjs nsis|msi <old installer> <new installer>");
  process.exit(2);
}

const { LOCALAPPDATA: local, APPDATA: roaming, ProgramFiles: programs, ProgramData: shared, USERPROFILE: home, PUBLIC: everyone } = process.env;
const programFolder = kind === "nsis" ? local : programs;
const formerFolder = join(programFolder, "Nebula Terminal");
const formerApp = join(formerFolder, "nebula-terminal.exe");
const folder = join(programFolder, "Shelduck");
const app = join(folder, "shelduck.exe");
const formerData = join(local, "dev.awizz.nebula-terminal");
const data = join(local, "dev.awizz.shelduck");
const fragments = join(local, "Microsoft", "Windows Terminal", "Fragments");
const formerFragment = join(fragments, "Nebula Terminal", "nebula.json");
const fragment = join(fragments, "Shelduck", "shelduck.json");
const menuKey = (name) => `HKCU\\Software\\Classes\\Directory\\shell\\${name}`;

// The web view listens on a port Windows just handed out, so the test can read and write
// the app's settings. It is asked to through the machine's policy: started by an
// administrator, as on the runner, WebView2 ignores WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS.
const debugPort = await new Promise((found, failed) => {
  const server = createServer().once("error", failed);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close(() => found(port));
  });
});
const debugPolicy = "HKLM\\Software\\Policies\\Microsoft\\Edge\\WebView2\\AdditionalBrowserArguments";
const images = ["nebula-terminal.exe", "shelduck.exe"];
let debuggerSaid = "nothing";
const FONT_SIZE = 17;

const run = (file, args, options = {}) => spawnSync(file, args, { encoding: "utf8", windowsHide: true, ...options });
const output = (file, args) => run(file, args).stdout ?? "";
const step = (text) => console.log(`\n== ${text}`);

function check(condition, what) {
  if (!condition) throw new Error(what);
  console.log(`ok  ${what}`);
}

async function until(what, seconds, probe) {
  for (let waited = 0; waited < seconds; waited += 1) {
    const value = await probe();
    if (value) {
      console.log(`ok  ${what}`);
      return value;
    }
    await sleep(1000);
  }
  throw new Error(`${what} (waited ${seconds} s)`);
}

function install(file, args) {
  const result = run(file, args, { stdio: "inherit", timeout: 10 * 60 * 1000 });
  if (result.status !== 0) throw new Error(`${file} ${args.join(" ")} ended with ${result.status ?? result.error}`);
}

const msiexec = (...args) => install("msiexec.exe", [...args, "/norestart"]);

const running = (image) => output("tasklist", ["/FI", `IMAGENAME eq ${image}`, "/FO", "CSV", "/NH"]).toLowerCase().includes(image);
async function stop(image) {
  run("taskkill", ["/IM", image, "/F", "/T"]);
  await until(`${image} has stopped`, 30, () => !running(image));
  // The web view's own processes end a moment after the app, and write its storage then.
  await sleep(5000);
}

const start = (exe) => spawn(exe, [], { detached: true, stdio: "ignore" }).unref();

async function page() {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    debuggerSaid = JSON.stringify(targets.map(({ type, url }) => ({ type, url })));
    return targets.find((target) => target.type === "page" && target.url.includes("tauri.localhost"));
  } catch (error) {
    debuggerSaid = String(error.cause ?? error);
    return undefined;
  }
}

/** Runs `expression` in the app's page and returns its value. */
async function evaluate(expression) {
  const target = await until("the app's page answers", 90, page);
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  try {
    await new Promise((opened, refused) => {
      socket.onopen = opened;
      socket.onerror = () => refused(new Error("The web view refused the debugger."));
    });
    const reply = new Promise((received) => {
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id === 1) received(message);
      };
    });
    socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
    const { result } = await reply;
    if (result.exceptionDetails) throw new Error(`${expression}: ${result.exceptionDetails.text}`);
    return result.result.value;
  } finally {
    socket.close();
  }
}

const stored = (name) => evaluate(`localStorage.getItem(${JSON.stringify(name)})`);
const fontSize = async (name) => JSON.parse((await stored(name)) ?? "{}").fontSize;

const registered = (key) => run("reg", ["query", key]).status === 0;
const userPath = () => output("reg", ["query", "HKCU\\Environment", "/v", "Path"]).toLowerCase();

/** The apps Windows lists under "Installed apps". */
function installedApps() {
  const names = output("powershell", [
    "-NoProfile",
    "-Command",
    "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* -ErrorAction SilentlyContinue | ForEach-Object DisplayName",
  ]);
  return names.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
}

function shortcuts(name) {
  const roots = [
    join(roaming, "Microsoft", "Windows", "Start Menu"),
    join(shared, "Microsoft", "Windows", "Start Menu"),
    join(home, "Desktop"),
    join(everyone, "Desktop"),
  ];
  return roots.flatMap((root) => {
    if (!existsSync(root)) return [];
    return readdirSync(root, { recursive: true })
      .filter((file) => file.toLowerCase().endsWith(`${name.toLowerCase()}.lnk`))
      .map((file) => join(root, file));
  });
}

const onDesktop = (files) => files.some((file) => /\\Desktop\\/i.test(file));
const inStartMenu = (files) => files.some((file) => /\\Start Menu\\/i.test(file));

function describe() {
  console.log("\n-- what the machine looks like");
  console.log("apps:", installedApps().filter((name) => /nebula|shelduck/i.test(name)));
  console.log("shortcuts:", [...shortcuts("Nebula Terminal"), ...shortcuts("Shelduck")]);
  for (const path of [formerFolder, folder, formerData, data, join(data, "bin")]) {
    console.log(path, existsSync(path) ? readdirSync(path) : "(missing)");
  }
  console.log("PATH:", userPath().trim());
  console.log(output("tasklist", ["/FO", "CSV", "/NH"]).split(/\r?\n/).filter((line) => /nebula|shelduck|webview/i.test(line)).join("\n"));
  console.log(`debugger on port ${debugPort}:`, debuggerSaid);
  const webViews = "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'msedgewebview2.exe' -and $_.CommandLine -notmatch '--type=' } | ForEach-Object CommandLine";
  console.log("web views:", output("powershell", ["-NoProfile", "-Command", webViews]).trim());
}

async function test() {
  for (const image of images) {
    const added = run("reg", ["add", debugPolicy, "/v", image, "/t", "REG_SZ", "/d", `--remote-debugging-port=${debugPort} --remote-allow-origins=*`, "/f"]);
    if (added.status !== 0) throw new Error(`The debugger policy for ${image} was refused: ${added.stderr.trim()}`);
  }

  step(`Nebula Terminal 2.11.0 (${kind})`);
  if (kind === "nsis") install(resolve(formerInstaller), ["/S"]);
  else msiexec("/i", resolve(formerInstaller), "/quiet");
  check(existsSync(formerApp), `${formerApp} is installed`);
  const formerShortcuts = shortcuts("Nebula Terminal");
  check(inStartMenu(formerShortcuts), "Nebula Terminal is in the Start menu");

  step("Settings changed in Nebula Terminal");
  start(formerApp);
  const formerKey = "nebula-terminal.preferences.v4";
  await evaluate(`(() => {
    const preferences = JSON.parse(localStorage.getItem(${JSON.stringify(formerKey)}) || "{}");
    localStorage.setItem(${JSON.stringify(formerKey)}, JSON.stringify({ ...preferences, fontSize: ${FONT_SIZE}, windowsTerminalProfile: true }));
    location.reload();
    return true;
  })()`);
  await sleep(3000);
  await until("Nebula Terminal kept the font size", 30, async () => (await fontSize(formerKey)) === FONT_SIZE);
  await until("Nebula Terminal added its Explorer menu", 60, () => registered(menuKey("NebulaTerminal")));
  await until("Nebula Terminal added its command to PATH", 30, () => userPath().includes("dev.awizz.nebula-terminal\\bin"));
  await until("Nebula Terminal added its Windows Terminal profile", 30, () => existsSync(formerFragment));
  // Chromium writes local storage to disk a few seconds after a change.
  await sleep(15000);

  step("Update to Shelduck");
  if (kind === "nsis") {
    // The old app is left running: the installer has to close it.
    install(resolve(installer), ["/P", "/R", "/UPDATE"]);
  } else {
    // The updater quits the app as soon as msiexec starts.
    await stop("nebula-terminal.exe");
    msiexec("/i", resolve(installer), "/passive", "AUTOLAUNCHAPP=True");
  }
  await until("the installer started Shelduck", 90, () => running("shelduck.exe"));
  check(!running("nebula-terminal.exe"), "Nebula Terminal is closed");

  const apps = installedApps();
  check(!apps.includes("Nebula Terminal"), "Windows no longer lists Nebula Terminal");
  check(apps.filter((name) => name === "Shelduck").length === 1, "Windows lists Shelduck once");
  check(existsSync(app), `${app} is installed`);
  check(!existsSync(formerFolder), `${formerFolder} is gone`);
  check(shortcuts("Nebula Terminal").length === 0, "no shortcut to Nebula Terminal is left");
  check(inStartMenu(shortcuts("Shelduck")), "Shelduck is in the Start menu");
  if (onDesktop(formerShortcuts)) check(onDesktop(shortcuts("Shelduck")), "Shelduck took the desktop shortcut");

  step("Settings and launchers in Shelduck");
  // Started again, so what is read is what Shelduck kept on disk.
  await sleep(10000);
  await stop("shelduck.exe");
  start(app);
  await until("Shelduck has the font size", 60, async () => (await fontSize("shelduck.preferences.v4")) === FONT_SIZE);
  check((await stored(formerKey)) === null, "the settings moved to their new name");
  check(existsSync(join(formerData, "EBWebView")), "Nebula Terminal's settings folder was left alone");
  await until("Open in Shelduck is in the Explorer menu", 60, () => registered(menuKey("Shelduck")));
  await until("Open in Nebula Terminal is gone", 30, () => !registered(menuKey("NebulaTerminal")));
  await until("PATH has the shelduck command only", 30, () => {
    const path = userPath();
    return path.includes("dev.awizz.shelduck\\bin") && !path.includes("dev.awizz.nebula-terminal\\bin");
  });
  for (const command of ["shelduck.cmd", "nebula-terminal.cmd"]) {
    check(readFileSync(join(data, "bin", command), "utf8").toLowerCase().includes(app.toLowerCase()), `${command} starts Shelduck`);
  }
  check(!existsSync(join(formerData, "bin")), "the old command folder is gone");
  await until("Windows Terminal has the Shelduck profile only", 30, () => existsSync(fragment) && !existsSync(formerFragment));

  step("Uninstall");
  await stop("shelduck.exe");
  if (kind === "nsis") {
    install(join(folder, "uninstall.exe"), ["/S", `_?=${folder}`]);
    rmSync(folder, { recursive: true, force: true });
  } else {
    msiexec("/x", resolve(installer), "/quiet");
  }
  check(!installedApps().some((name) => /nebula terminal|shelduck/i.test(name)), "Windows lists neither app");
  check(!existsSync(app), "Shelduck is removed");
  check(!registered(menuKey("Shelduck")), "the Explorer menu is removed");
  check(!userPath().includes("dev.awizz.shelduck\\bin"), "PATH is back as it was");
  check(!existsSync(fragment), "the Windows Terminal profile is removed");
  check(shortcuts("Shelduck").length === 0, "no shortcut is left");
}

try {
  await test();
  console.log("\nThe update works.");
} catch (error) {
  console.error(`\nFAILED  ${error.message}`);
  describe();
  process.exitCode = 1;
} finally {
  for (const image of images) {
    run("taskkill", ["/IM", image, "/F", "/T"]);
    run("reg", ["delete", debugPolicy, "/v", image, "/f"]);
  }
  await sleep(3000);
  // The next run starts from a machine that never had either app.
  for (const root of [local, roaming]) {
    for (const name of ["dev.awizz.nebula-terminal", "dev.awizz.shelduck"]) rmSync(join(root, name), { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
  }
  rmSync(join(fragments, "Shelduck"), { recursive: true, force: true });
  rmSync(join(fragments, "Nebula Terminal"), { recursive: true, force: true });
}
