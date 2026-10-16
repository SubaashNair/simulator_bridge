# Portable iOS Simulator Bridge

Date: 16 October 2026
Status: Design for review; implementation has not started.

## Goal and agreed scope

Provide a live, interactive iOS simulator preview beside an AI coding conversation in Conductor and Cloudroom Local. Reuse the same Mac-side service with Codex. The user approved starting with local support and extending to remote Mac access later. Success means an agent can build and launch an iOS app, capture its screen, interact with it, and supply a preview URL the user can open alongside the conversation.

Assumptions: macOS with Xcode and an installed iOS simulator runtime; one active simulator initially; no modification of Conductor or Cloudroom binaries. Native automatic pane attachment is outside the initial scope. ChatGPT integration is a separate connection adapter, not presumed to be included merely because Codex works.

## Approaches

1. Recommended: wrap serve-sim for streaming and use an existing build/automation MCP server. This minimizes custom simulator code and keeps clients independent.
2. Fork serve-sim immediately: useful when upstream cannot expose the required device or lifecycle controls, but creates ongoing maintenance work. Defer until the prototype identifies a concrete gap.
3. Write a native streaming helper and viewer: maximum control, but duplicates existing functionality and introduces macOS/Xcode compatibility work. Excluded from the first version.

## Proposed components

- A small Node.js launcher CLI performs prerequisite checks, selects a simulator by explicit UDID, starts the preview process and prints its URL. Use subprocess argument arrays, not shell interpolation.
- serve-sim supplies the interactive browser viewer. Pin a tested release during implementation; confirm flags and device-selection behavior against that release before writing the adapter. Preserve applicable Apache-2.0 notices if redistributing its code.
- An existing MCP backend, initially evaluating MobileBuildMCP (formerly XcodeBuildMCP), supplies build, install, launch, screenshot and UI automation tools. Verify available tools and Xcode compatibility before generating client configuration; do not promise an upstream tool that is absent.
- Client adapters generate examples for Claude Code in Conductor, Claude Code in Cloudroom Local, and Codex. Configuration output is reviewable; existing personal configuration is not overwritten.

## User and agent flow

1. Run the prerequisite check. Report the selected Xcode path, runtime availability, simulator service access and required executables.
2. Select an existing simulator explicitly. Never download a runtime or erase a device automatically.
3. Start the viewer on an available loopback port. Print the actual URL; allow Conductor's allocated port to be supplied explicitly.
4. Open the URL in the host's browser panel, or a normal browser if that panel cannot handle the stream.
5. The agent builds, installs and launches the app on the same simulator UDID used by the viewer.
6. Ask the agent to verify a named flow. Capture screenshots and tool results; distinguish attempted interactions from confirmed outcomes.
7. Stop only the preview processes owned by this launcher. Leave user-owned simulator state intact.

## Host compatibility

| Host | First-version behavior | Validation needed |
| --- | --- | --- |
| Conductor local | Preview URL plus Claude Code MCP configuration | Embedded streaming, gestures and loaded tools |
| Cloudroom Local | Preview URL plus the selected harness's tools | Browser access, streaming and tool configuration |
| Codex local | MCP tools plus browser preview URL | Tools discovered, screenshots visible and app flow verified |
| Cloudroom Cloud | Deferred remote Mac adapter | Linux sandbox must reach a Mac service; artifacts must also be built on the Mac |
| ChatGPT | Future custom MCP/plugin adapter | Supported connection transport, account availability, tool calls and optional UI rendering |

The browser viewer and agent tools must target the same UDID. Host-specific automatic pane opening is optional convenience and not a compatibility requirement.

## Errors and lifecycle

Return actionable errors for missing Xcode, missing runtime, unavailable CoreSimulator, unknown UDID, occupied ports, failed builds and unexpected preview-process exit. Bound subprocess waits and include the failing stage and exit code. On interruption, terminate only owned children. Do not fall back silently to another simulator or claim a successful UI action without evidence.

The first version supports one active session. It must detect conflicting use of its own session state. Workspace-per-device allocation and robust parallel ownership are follow-up work after the single-session path passes end-to-end testing.

## Remote extension

Keep build and simulator execution on a reachable Mac. A future authenticated tunnel or private network connects cloud agents to a constrained tool endpoint; localhost in a cloud sandbox does not refer to the user's Mac. Remote builds require an explicit checkout/commit transfer strategy. The Mac must stay awake and reachable. Do not expose unauthenticated simulator control publicly.

## Validation and acceptance

- Unit-test prerequisite parsing, argument validation, explicit UDID propagation, port conflicts and cleanup ownership using subprocess fixtures.
- Exercise MCP discovery with each selected client; use the pinned backend's real schema.
- On an unrestricted Mac, build and launch a small iOS sample, view its live screen, manually tap it, perform an agent-driven interaction and capture a screenshot that confirms the expected result.
- Repeat the browser portion in Conductor and Cloudroom Local; record versions and any viewer limitations.
- Verify teardown leaves unrelated processes and simulators running.
- Report mocked checks separately from real-device-service integration checks.

Current environment finding: Xcode is selected at /Applications/Xcode.app/Contents/Developer. The current execution session cannot connect to CoreSimulator and reports operation-not-permitted/service-connection errors. Device and runtime availability therefore remain unverified. This blocks live acceptance testing here and does not establish that the user's Xcode installation is broken.

## Sources

- Claude Desktop iOS pane: https://code.claude.com/docs/en/desktop-ios-simulator
- Viewer implementation: https://github.com/EvanBacon/serve-sim
- Conductor MCP: https://www.conductor.build/docs/reference/mcp
- Conductor preview configuration: https://www.conductor.build/docs/reference/settings/reference
- Cloudroom Local: https://www.cloudroom.dev/docs/local-threads
- Cloudroom Linux sandboxes: https://www.cloudroom.dev/docs/cloud-threads
- Codex MCP: https://developers.openai.com/codex/mcp
- OpenAI plugin development: https://developers.openai.com/plugins/quickstart

## Next implementation boundary

After design review, write the implementation plan for the launcher, pinned integrations, configuration examples and verification steps. ChatGPT remote connectivity and cloud-to-Mac execution remain later phases.
