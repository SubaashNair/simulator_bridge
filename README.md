# iOS Simulator Bridge

A local MCP server and command-line launcher that gives coding agents access to Apple's iOS Simulator, with an interactive browser preview powered by [serve-sim](https://github.com/EvanBacon/serve-sim).

Use it with **Claude Code in Conductor**, **Claude Code in Cloudroom Local**, or **Codex on your Mac**. Build an app, launch it on a chosen simulator, inspect screenshots and interact with its interface from your coding conversation.

**Version:** 0.1.0 · **License:** MIT · **Platform:** Apple Silicon macOS · **Runtime:** Node.js 20+

> **Early integration:** the automated test suite and MCP protocol connection have been verified. Real app builds, simulator streaming, gestures and embedded browser behavior still need end-to-end verification on an unrestricted Mac. The development environment could not access CoreSimulator or download the viewer package. See [verification details](docs/verification.md).

## Contents

- [What it does](#what-it-does)
- [Compatibility](#compatibility)
- [Requirements](#requirements)
- [Install](#install)
- [Use with Conductor](#use-with-conductor)
- [Use with Cloudroom](#use-with-cloudroom)
- [Use with Codex](#use-with-codex)
- [Open a preview without an agent](#open-a-preview-without-an-agent)
- [CLI examples](#cli-examples)
- [MCP tools](#mcp-tools)
- [Configuration](#configuration)
- [How it works](#how-it-works)
- [Troubleshooting](#troubleshooting)
- [Development and tests](#development-and-tests)
- [Limitations](#limitations)
- [Update and uninstall](#update-and-uninstall)
- [Licensing and attribution](#licensing-and-attribution)

## What it does

The bridge exposes 12 tools for checking the local setup, choosing a simulator, building and running an iOS app, capturing its screen and sending input. It starts a browser viewer on localhost so you can watch the same simulator your agent is controlling.

This is an independent integration. It does not copy Anthropic's desktop app, implement an iOS emulator, or automatically create a native simulator pane inside another application. Apple's simulator runs the app; the bridge connects your agent to it.

## Compatibility

| Environment | Intended workflow | Current validation |
| --- | --- | --- |
| Conductor + Claude Code, local | MCP tools and localhost viewer in its browser panel | MCP transport verified; host preview not tested |
| Cloudroom + Claude Code, Local | Same Mac-side tools and browser viewer | MCP transport verified; host preview not tested |
| Codex, local | MCP tools plus a browser preview URL | Official MCP SDK client handshake verified; actual Codex session not tested |
| Cloudroom Cloud / other Linux sandboxes | Would require a separate reachable Mac | Not implemented |
| Ordinary ChatGPT chat | Would require a custom tool/plugin connection | Not implemented |
| Intel Mac, Windows or Linux | Viewer requires Apple Silicon macOS | Unsupported in v0.1 |

The agent's location matters: a local thread on a Mac can reach that Mac's simulator. A cloud thread's `localhost` refers to its cloud machine.

## Requirements

- An Apple Silicon Mac.
- Node.js **20 or newer**, including npm.
- Full Xcode, with an iOS platform/runtime and at least one available simulator device.
- Claude Code and/or Codex CLI installed and signed in for the clients you want to register.
- Internet access during installation to download **serve-sim 0.1.48** and its dependencies.
- Normal Mac-side access to CoreSimulator. A restricted agent sandbox may be unable to connect.

Check the basic tools in Terminal:

```sh
node --version
npm --version
xcode-select -p
xcrun simctl list devices available
```

If the last command fails in Terminal itself, resolve Xcode/simulator setup first. The installer does not download Xcode or runtimes, change your selected Xcode, or erase devices.

## Install

### Option A: download the repository ZIP

1. On GitHub, select **Code → Download ZIP**.
2. Extract the ZIP and open the extracted project folder.
3. Double-click **Install.command**.
4. Wait for the installation results in Terminal.
5. Start a new local agent session in your chosen host.

If macOS opens the command in an editor or cannot launch it, open Terminal in the extracted folder and run:

```sh
zsh Install.command
```

### Option B: clone with Git

```sh
git clone https://github.com/SubaashNair/simuulator_bridge.git
cd simuulator_bridge
node install.mjs
```

Run the installer as your normal user; it does not require `sudo`.

### What the installer changes

The installer:

1. Copies bridge files to `~/.local/share/portable-ios-simulator-bridge`.
2. Downloads the pinned viewer into that directory's `vendor` folder.
3. Registers `ios-simulator-bridge` in Claude Code's user-level MCP configuration, if its CLI is available.
4. Registers the same server with Codex, if its CLI is available.
5. Prints a result for each registration and dependency installation step.

It preserves an existing conflicting bridge registration and reports the conflict. It also refuses an existing installation folder that does not contain this bridge's expected package manifest. An update replaces this project's own source files inside its owned installation directory.

**Check every result:** a successful file copy does not mean that the viewer download or both client registrations succeeded. A missing client is reported separately; you can still use the client that registered successfully. Installer exit code 1 indicates an incomplete step.

## Use with Conductor

1. Open your actual iOS application repository in Conductor.
2. Select **Claude Code** in a local workspace.
3. Start a new session after installation so it can discover the MCP tools.
4. Accept the server trust prompt if Claude Code presents one.
5. Send:

> Use ios-simulator-bridge to run doctor and list available simulator devices. Let me choose a device. Use its exact UDID for all operations, boot it and start the live preview. Return the preview URL.

6. Open the returned URL, usually `http://localhost:3200`, in Conductor's browser panel.

For an application workflow:

> Build the MyApp scheme in my MyApp.xcodeproj for the selected simulator, using an explicit DerivedData folder. Locate the built simulator .app, install it, launch its bundle identifier and capture a screenshot of the onboarding screen.

The build tool does not automatically locate, install or launch the resulting `.app`; the agent performs those steps separately.

For Conductor's allocated port, ask the agent to read `CONDUCTOR_PORT` and pass that numeric value to `preview`. The bridge does not expand environment variables inside JSON arguments. If the embedded browser cannot render the stream, open the same URL in a normal browser.

## Use with Cloudroom

1. Start a **Local** thread on your Mac, using Claude Code.
2. Start a new agent session after the installer registers the tools.
3. Use the same setup prompt as Conductor.
4. Open the returned URL in Cloudroom's browser panel.

Choose **Local**, not Cloud, for v0.1. Cloudroom's Linux cloud threads cannot run Xcode or Apple's simulator directly. A future remote adapter would need a reachable Mac that builds the code and hosts the simulator.

## Use with Codex

After installation, check the registration:

```sh
codex mcp list
```

Look for `ios-simulator-bridge`, then start a new local Codex session and ask it to run `doctor` and `devices`.

The installer uses the Codex CLI to register the server. If an older Codex version cannot handle the commands, update the CLI or use the manual configuration below. A successful registration does not guarantee that a restricted Codex session can reach CoreSimulator; check `doctor` from that session.

This project does not register a plugin in ordinary ChatGPT chat. ChatGPT custom MCP connectivity and a dedicated embedded viewer are outside this release.

## Open a preview without an agent

Double-click **Open Preview.command**, or from the project folder run:

```sh
zsh 'Open Preview.command'
```

The launcher lists available devices, asks for a device number, boots it and prints the preview URL. Open that URL in a browser. Keep the Terminal window open while using the viewer; press **Ctrl+C** to stop it.

If this launcher already owns a viewer on port 3200, the agent should use its URL rather than start a second viewer on the same port.

## CLI examples

From the repository directory:

```sh
# Check Xcode, simulator access and viewer availability.
node bin/simulator-bridge.mjs doctor

# Get exact simulator UUIDs.
node bin/simulator-bridge.mjs devices

# Print help and configuration examples.
node bin/simulator-bridge.mjs --help
node bin/simulator-bridge.mjs config
```

The following UUID is an example. Replace it with an available UDID returned by `devices`:

```sh
node bin/simulator-bridge.mjs boot \
  '{"udid":"11111111-2222-3333-4444-555555555555"}'

node bin/simulator-bridge.mjs preview \
  '{"udid":"11111111-2222-3333-4444-555555555555","port":3200}'

node bin/simulator-bridge.mjs build \
  '{"udid":"11111111-2222-3333-4444-555555555555","project":"/absolute/path/MyApp.xcodeproj","scheme":"MyApp","derivedData":"/absolute/path/DerivedData"}'

node bin/simulator-bridge.mjs install \
  '{"udid":"11111111-2222-3333-4444-555555555555","app":"/absolute/path/DerivedData/Build/Products/Debug-iphonesimulator/MyApp.app"}'

node bin/simulator-bridge.mjs launch \
  '{"udid":"11111111-2222-3333-4444-555555555555","bundleId":"com.example.MyApp"}'
```

JSON path values must be absolute. `~` is not expanded inside JSON strings. `build` requires an `.xcodeproj`; the resulting app name/path can vary by project.

The CLI screenshot command prints JSON with base64 image data. In an MCP conversation, the same tool returns an image directly to the agent. Keep a CLI `preview` process running; use Ctrl+C to stop it.

## MCP tools

| Tool | Required arguments | Optional arguments | Result |
| --- | --- | --- | --- |
| `doctor` | None | None | Platform, Xcode, simulator-service and viewer checks |
| `devices` | None | None | Available devices grouped by runtime |
| `boot` | `udid` | None | Boots an existing device and waits for readiness |
| `build` | `udid`, `project`, `scheme`, `derivedData` | None | Build output; does not install or launch |
| `install` | `udid`, `app` | None | Installs a simulator `.app` bundle |
| `launch` | `udid`, `bundleId` | None | Launch output |
| `screenshot` | `udid` | None | PNG image, at most 8 MiB |
| `preview` | `udid` | `port` (default 3200) | Local preview URL |
| `stop_preview` | None | None | Stops this MCP session's owned viewer process |
| `tap` | `udid`, `x`, `y` | None | Input command result; application outcome unverified |
| `type` | `udid`, `text` | None | Types text into the focused field |
| `button` | `udid`, `name` | None | Button command; `name` is `home` or `lock` |

- `udid` must be an exact UUID; aliases such as `booted` are rejected.
- `x` and `y` are normalized coordinates between **0 and 1**.
- `port` must be an integer between **1024 and 65535**.
- `text` is limited to 10,000 characters and is sent over stdin to avoid option interpretation.
- A device must be booted for app installation, launch, screenshots, preview and input.
- Input completion is not proof that a form was submitted or a screen changed. Ask for a screenshot to confirm the outcome.

## Configuration

### Project-only Claude Code registration

From your application repository, run the bridge installer by its absolute path:

```sh
node /absolute/path/ios-simulator-bridge/install.mjs --project-only
```

This merges the named server into that repository's `.mcp.json`, preserving unrelated entries and backing up a changed existing file. It does **not** download the viewer or add global registrations. Install the full bridge first.

Configuration entries use absolute paths. Regenerate them if you move the bridge. A source checkout can also locate the viewer from the default full installation directory after restarting its server.

### Manual Claude Code registration

Replace `/absolute/path/to/node` with the output of `command -v node`:

```sh
claude mcp add --scope user ios-simulator-bridge -- \
  /absolute/path/to/node \
  "$HOME/.local/share/portable-ios-simulator-bridge/bin/simulator-bridge.mjs" mcp
```

### Manual Codex registration

```sh
codex mcp add ios-simulator-bridge -- \
  /absolute/path/to/node \
  "$HOME/.local/share/portable-ios-simulator-bridge/bin/simulator-bridge.mjs" mcp
```

Alternatively, generate the configuration for your checkout with:

```sh
node bin/simulator-bridge.mjs config
```

The output contains a Claude JSON entry and Codex TOML text. Replace paths appropriately before adding it to another machine's configuration. Do not commit personal machine paths or login credentials to a shared application repository.

## How it works

The agent connects to this bridge over **stdio MCP**. The bridge invokes `xcrun simctl` for simulator lifecycle/app operations and `xcodebuild` for builds. It invokes the pinned `serve-sim` CLI for the localhost viewer and input.

The browser preview and agent tools target the same explicit simulator UDID. The preview stays alive while its owning bridge session or Terminal stays open. Stopping the viewer leaves the simulator running.

The bridge uses subprocess argument arrays rather than shell interpolation. It has no arbitrary shell MCP tool and does not expose its own network listener. The viewer binds to loopback; remote access is not part of v0.1. Builds execute your project's build system, so only build projects you trust.

Screenshots use a private temporary directory, are returned as image data and are removed after capture, including failure cleanup. The bridge does not send screenshots to an external service itself; your selected agent/client handles any image passed to its model provider.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `node: command not found` | Install Node.js 20+ and reopen Terminal. |
| Installer reports `ENOTFOUND` or download timeout | Check network access to registry.npmjs.org; rerun from normal Terminal. The viewer is not installed until that step succeeds. |
| Xcode path is missing or points to CommandLineTools | Open full Xcode and complete its setup; choose the intended Xcode installation using Apple's tooling. |
| No available devices | Install the iOS runtime and create a device through Xcode's simulator/device UI. |
| CoreSimulator connection invalid/refused or operation not permitted | Run `xcrun simctl list devices available` in normal Terminal. If Terminal works, check restrictions on the agent session. If Terminal also fails, address the Xcode service/runtime issue. |
| Viewer not installed | Run Install.command; inspect the viewer step's result. |
| Port 3200 is in use | Reuse the existing intended viewer or supply another port, such as 3201. Do not stop an unrelated process. |
| Tools missing in the agent | Check registration, start a new session and approve the server if prompted. |
| Preview stops when the chat closes | Expected: the viewer belongs to that MCP session. Use Open Preview.command for an independently owned viewer. |
| Stream fails inside the host browser | Open the returned URL in a normal browser and record your host/version for further testing. |
| Xcode 27 typing fails | Upstream serve-sim documents Device Hub visibility/focus and possible Accessibility permission requirements. |
| Existing registration differs | The installer preserves it. Review that entry before replacing/removing the named bridge registration, then rerun installation. |
| One client registers and the other fails | Read the individual installer results. Install/update the missing client if needed; the successful client can be checked independently. |
| Build fails | Confirm project path, scheme, simulator runtime and dependencies. Review returned xcodebuild output. `.xcworkspace` projects are not supported in v0.1. |

For a useful issue report, include Node/Xcode versions, host app and version, whether the session is local, the failing step, and redacted error output. Do not include credentials or screenshots containing private data.

## Development and tests

The bridge core has no external npm dependencies. Run:

```sh
npm test
node --check src/core.mjs
node --check src/server.mjs
zsh -n Install.command
zsh -n 'Open Preview.command'
```

The current suite contains **20 tests** covering validation, device selection, subprocess arguments, screenshot packaging/cleanup, owned-process stopping, configuration preservation, installer payload safety and a spawned MCP server. An official MCP SDK client was also used to verify initialization, tool discovery and invalid-input rejection.

Fixture-based screenshot tests do not establish that Apple's framebuffer capture works. Viewer port conflicts, early exits, gestures and embedded streaming need integration testing with the installed dependency. See [verification.md](docs/verification.md) for the complete boundary.

Source layout:

| Path | Responsibility |
| --- | --- |
| `bin/simulator-bridge.mjs` | Executable entry point |
| `src/core.mjs` | Validation, tools, simulator commands and viewer lifecycle |
| `src/server.mjs` | Newline-delimited JSON-RPC MCP transport |
| `src/cli.mjs` | CLI help, commands and foreground preview |
| `src/install.mjs` | Installation payload and client registration |
| `src/open-preview.mjs` | Interactive device picker |
| `install.mjs` | Installer entry point |
| `test/` | Node built-in test runner suite |
| `docs/` | Design, implementation and verification notes |

## Limitations

- One active viewer per bridge session; cross-process simulator ownership locking is not implemented. Do not have multiple agents mutate the same simulator concurrently.
- `.xcodeproj` build support only; no `.xcworkspace`, physical-device deployment or signing workflow.
- No swipe MCP tool in v0.1; manual swipes are available through the upstream viewer UI.
- No automatic native pane attachment, cloud-to-Mac bridge or ordinary ChatGPT plugin registration.
- No automatic simulator shutdown, erase, runtime downloads or provisioning.
- The bridge stops only its own viewer child process. Shared helpers managed by serve-sim may remain running.
- Input and viewer compatibility depend on the installed Xcode/macOS versions and upstream serve-sim behavior.

## Update and uninstall

To update, download a newer source version or pull the repository, then rerun `Install.command`. Restart agent sessions afterward. The viewer version remains pinned until the project explicitly changes it.

To remove registrations:

```sh
claude mcp remove --scope user ios-simulator-bridge
codex mcp remove ios-simulator-bridge
```

Then remove `~/.local/share/portable-ios-simulator-bridge` through Finder. If you added project-only configuration, remove only the `ios-simulator-bridge` entry from that project's `.mcp.json`; keep unrelated entries.

## Licensing and attribution

Bridge code is supplied under the [MIT license](LICENSE).

The viewer is [EvanBacon/serve-sim](https://github.com/EvanBacon/serve-sim), installed separately at version 0.1.48 under Apache-2.0. Its own license and third-party notices remain with the downloaded package. Apple Simulator/Xcode are separate Apple products. This repository is not affiliated with Anthropic, OpenAI, Conductor, Cloudroom or Apple.
