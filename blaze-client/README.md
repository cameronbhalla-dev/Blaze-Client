# Blaze Client — development preview

Blaze Client is an Electron-based launcher foundation. This repository is an early development build, not a finished Minecraft client.

## Run locally

- Install Node.js 22 or newer.
- Run `npm install`.
- Run `npm start`.

## Current functionality

- Clean dark launcher shell.
- Local profile creation with separate `mods`, `resourcepacks`, and `config` directories.
- Profile-specific Modrinth search for mods and resource packs.
- Modrinth installs filtered by Minecraft version and loader, with downloaded files placed in the selected profile.
- Loader rule in the current UI: Minecraft 1.8/1.8.9 use Forge; listed newer versions use Fabric.
- SHA-256 file inventory for a profile.
- Launcher diagnostic folder and renderer crash reports.
- GitHub Actions workflow for a universal macOS DMG build.

## Important limitations

- Minecraft runtime download, Microsoft account authentication, actual game launch, Java runtime management, and complete Forge/Fabric installation are not implemented yet.
- The Donut SMP auction HUD, base raid timer, and container price checker are not implemented yet.
- The current security scan is a file inventory and hash calculation, **not antivirus**. It cannot declare a file safe or malicious.
- Modrinth content is third-party code. Review projects before installing; no malware-free guarantee is made.
- The 600+ FPS target requires testing on representative hardware and cannot be guaranteed by the launcher.
- The macOS DMG has to be built by the GitHub Actions macOS runner. It is not generated on non-macOS development machines.

## Build the macOS DMG

In GitHub, open **Actions → Build macOS DMG → Run workflow**. When it succeeds, download the `Blaze-Client-macOS-Universal` artifact from that workflow run.

## Requested Minecraft support matrix

| Minecraft | Loader |
|---|---|
| 1.8 | Forge |
| 1.8.9 | Forge |
| 1.20 | Fabric |
| 1.21 | Fabric |
| 1.21.4 | Fabric |
| 1.21.8 | Fabric |
| 1.21.11 | Fabric |
| 26.1 | Fabric |
| 26.1.2 | Fabric |
| 26.2 | Fabric |
| 26.3 | Fabric |

The table is the requested target matrix; it does not mean every runtime/loader combination is already installed or tested.
