#!/bin/bash

# Verify sidecar binaries exist and are executable

BINARIES_DIR="src-tauri/binaries"
REQUIRED_FILES=(
  "node-sidecar.js"
)

echo "🔍 Checking sidecar binaries..."
echo ""

# Check if binaries directory exists
if [ ! -d "$BINARIES_DIR" ]; then
  echo "❌ Error: $BINARIES_DIR directory not found"
  exit 1
fi

# Check required JS bundle
for file in "${REQUIRED_FILES[@]}"; do
  filepath="$BINARIES_DIR/$file"
  if [ ! -f "$filepath" ]; then
    echo "❌ Missing: $filepath"
    echo "   Run: pnpm run build:sidecar"
    exit 1
  else
    echo "✅ Found: $filepath"
  fi
done

echo ""
echo "📦 Platform-specific binaries:"
echo ""

# Check platform-specific binaries
PLATFORM_BINARIES=(
  "node-sidecar-aarch64-apple-darwin"
  "node-sidecar-x86_64-apple-darwin"
  "node-sidecar-x86_64-pc-windows-msvc.exe"
  "node-sidecar-x86_64-unknown-linux-gnu"
)

found_count=0
for file in "${PLATFORM_BINARIES[@]}"; do
  filepath="$BINARIES_DIR/$file"
  if [ -f "$filepath" ]; then
    size=$(ls -lh "$filepath" | awk '{print $5}')
    echo "✅ $file ($size)"
    found_count=$((found_count + 1))
  else
    echo "⚠️  Missing: $file"
  fi
done

echo ""
if [ $found_count -eq 0 ]; then
  echo "⚠️  No platform-specific binaries found"
  echo "   Run: pnpm run package:sidecar:all"
  echo "   Or for specific platform:"
  echo "   - pnpm run package:sidecar:darwin-arm64"
  echo "   - pnpm run package:sidecar:darwin-x64"
  echo "   - pnpm run package:sidecar:win32"
  echo "   - pnpm run package:sidecar:linux"
else
  echo "✅ Found $found_count platform-specific binary(ies)"
fi

echo ""
echo "Done!"
