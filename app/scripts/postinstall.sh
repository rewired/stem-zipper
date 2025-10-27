#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_ROOT="$ROOT_DIR/resources/bin"

if [ -d "$BIN_ROOT" ]; then
  find "$BIN_ROOT" -type f -name '7zz' -exec chmod +x {} +
fi
