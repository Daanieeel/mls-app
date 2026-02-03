#!/bin/bash

# Change to the project root directory
cd "$(dirname "$0")/.."

# Run bun install
echo "Running bun install..."
bun install

# Only manage the centralized root .env from .env.example
ROOT_EXAMPLE=".env.example"
ROOT_ENV=".env"

if [ ! -f "$ROOT_EXAMPLE" ]; then
  echo "No $ROOT_EXAMPLE found in project root. Nothing to do."
  exit 0
fi

if [ -f "$ROOT_ENV" ]; then
  # Prompt repeatedly until user types 'regenerate' or presses Enter to keep existing
  while true; do
    read -p "$ROOT_ENV already exists. Type 'regenerate' to overwrite it with $ROOT_EXAMPLE (press Enter to keep): " input
    if [ -z "$input" ]; then
      echo "Kept existing $ROOT_ENV"
      break
    fi
    if [ "$input" = "regenerate" ]; then
      cp "$ROOT_EXAMPLE" "$ROOT_ENV"
      echo "Regenerated $ROOT_ENV"
      break
    fi
    echo "Unrecognized input. Please type 'regenerate' to overwrite, or press Enter to keep existing."
  done
else
  cp "$ROOT_EXAMPLE" "$ROOT_ENV"
  echo "Created $ROOT_ENV"
fi

echo "Setup complete."