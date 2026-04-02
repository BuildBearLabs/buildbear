#!/usr/bin/env bash
# BuildBear CLI Install Script
# Usage: curl -fsSL https://install.buildbear.io/cli | bash

set -e

echo "Installing BuildBear CLI..."

# Check for Node.js 20+
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required but not installed."
  echo "Install it from https://nodejs.org (version 20 or later)"
  exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js 20+ is required (found v${NODE_VERSION}.x)"
  exit 1
fi

# Install via npm
npm install -g buildbear

# Verify
if command -v buildbear &>/dev/null; then
  echo ""
  buildbear --version
  echo ""
  echo "✅ BuildBear CLI installed successfully!"
  echo "Run 'buildbear auth setup' to get started."
else
  echo ""
  echo "⚠ Installation succeeded but 'buildbear' was not found in PATH."
  echo "You may need to add npm's global bin directory to your PATH."
  echo "Run: npm config get prefix"
  echo "Then add <prefix>/bin to your PATH."
fi
