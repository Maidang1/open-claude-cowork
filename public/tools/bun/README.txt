Bundled bun binaries for packaging.

This directory is populated by:
  pnpm run prepare:bun

Environment variables:
  BUN_VERSION=latest        # or a specific version like 1.1.38
  BUN_TARGETS=all           # or current, or comma list (darwin-arm64,win32-x64,...)
  SKIP_BUN_DOWNLOAD=1       # skip download during build
  FORCE_BUN_DOWNLOAD=1      # re-download even if binaries exist

Expected layout:
  public/tools/bun/darwin-arm64/bun
  public/tools/bun/darwin-x64/bun
  public/tools/bun/linux-arm64/bun
  public/tools/bun/linux-x64/bun
  public/tools/bun/win32-arm64/bun.exe
  public/tools/bun/win32-x64/bun.exe
  public/tools/bun/win32-ia32/bun.exe

These files are copied to app resources under:
  resources/tools/bun/<platform-arch>/

Make sure the bun binaries are executable on macOS/Linux.
