# Verification — 16 October 2026

## Verified

- Node.js v22.20.0 available on Apple Silicon macOS.
- Full automated suite: 20 passing, zero failures (`npm test`).
- Official cached @modelcontextprotocol/sdk client connected over stdio, initialized the bridge, discovered 12 tools, and received a tool error for invalid UDID input.
- CLI help and configuration output work. Both macOS command launchers pass zsh syntax checks.
- Project-local Claude Code registration created at the workspace root `.mcp.json`.
- Source payload contains an installer, viewer launcher, README, design, implementation plan, tests and license.
- Independent review identified installer rerun payload omissions, unsafe existing-directory handling and project-source/installed-viewer path mismatch. All three were fixed with regression tests. The source bridge now also locates the viewer in the full installation directory after restart.

## Blocked / not verified

- `npm install ... serve-sim@0.1.48` failed with ENOTFOUND for registry.npmjs.org in this execution sandbox. The viewer is NOT installed.
- The selected Xcode location is /Applications/Xcode.app/Contents/Developer, but `xcrun simctl` cannot connect to CoreSimulator from this restricted session. Runtime/device availability, actual app builds and live input/streaming remain unverified.
- Global Claude Code and Codex registration require writes outside this session's writable workspace. They were NOT performed. Install.command runs those steps from the user's normal Terminal.
- No iOS project was supplied for an end-to-end app build.
- Conductor/Cloudroom browser embedding, upstream serve-sim gestures and port-startup behavior have not been exercised end-to-end.
- Automated screenshot tests use a subprocess fixture and verify cleanup/image packaging, not Apple's real framebuffer. Viewer startup occupied-port/early-exit paths still need real viewer integration testing.

## Decisions during implementation

1. Direct constrained simctl/xcodebuild tools replace the planned external MCP build backend so the bridge core works without downloading packages. Cost if unsuitable: migrate those commands to a tested backend later. MobileBuildMCP is not installed.
2. There was no git repository, so implementation lives in a standalone project directory; final source is supplied as an archive.
3. The user's explicit request to build and install was treated as authorization for inline implementation without another plan approval round.
4. Global installation and live acceptance remain incomplete because of environment limits. Use the included installer to finish on the Mac and then run doctor.
