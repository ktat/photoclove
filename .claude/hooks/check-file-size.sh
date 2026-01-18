#!/bin/bash
# Claude Code hook: Check file size before Edit
# Blocks editing if file exceeds 700 lines and warns about splitting

# Read JSON input from stdin
INPUT=$(cat)

# Extract file_path from tool_input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Skip if no file path
if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
    exit 0
fi

# Skip non-code files
case "$FILE_PATH" in
    *.md|*.json|*.yaml|*.yml|*.toml|*.lock|*.svg|*.css)
        exit 0
        ;;
esac

# Count lines
LINE_COUNT=$(wc -l < "$FILE_PATH" 2>/dev/null || echo 0)

# Threshold
MAX_LINES=700
WARN_LINES=500

if [ "$LINE_COUNT" -gt "$MAX_LINES" ]; then
    echo "BLOCKED: $FILE_PATH has $LINE_COUNT lines (limit: $MAX_LINES)" >&2
    echo "" >&2
    echo "This file is too large. Before editing, consider:" >&2
    echo "  1. Split into smaller modules" >&2
    echo "  2. Extract reusable functions/components" >&2
    echo "  3. Move related code to separate files" >&2
    echo "" >&2
    echo "Ask user for permission to proceed or propose a split plan." >&2
    exit 2
elif [ "$LINE_COUNT" -gt "$WARN_LINES" ]; then
    # Warning but allow (exit 0 with message)
    echo "{\"decision\": \"warn\", \"message\": \"WARNING: $FILE_PATH has $LINE_COUNT lines. Consider splitting after this edit.\"}"
    exit 0
fi

exit 0
