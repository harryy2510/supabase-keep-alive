#!/bin/bash

# Supabase Keep-Alive Script
# Pings all projects in projects.json in parallel and generates status

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECTS_FILE="$SCRIPT_DIR/projects.json"
STATUS_FILE="$SCRIPT_DIR/STATUS.md"
RESULTS_DIR="$SCRIPT_DIR/.results"

# Check dependencies
if ! command -v jq &> /dev/null; then
  echo "Error: jq is required but not installed"
  exit 1
fi

# Check if projects.json exists
if [ ! -f "$PROJECTS_FILE" ]; then
  echo "Error: projects.json not found"
  exit 1
fi

# Create results directory
rm -rf "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR"

# Get number of projects
project_count=$(jq length "$PROJECTS_FILE")
echo "Found $project_count projects to ping"

if [ "$project_count" -eq 0 ]; then
  echo "No projects to ping"
  exit 0
fi

# Function to ping a single project
ping_project() {
  local index=$1
  local name=$(jq -r ".[$index].name" "$PROJECTS_FILE")
  local owner=$(jq -r ".[$index].owner" "$PROJECTS_FILE")
  local url=$(jq -r ".[$index].url" "$PROJECTS_FILE")
  local anon_key=$(jq -r ".[$index].anon_key" "$PROJECTS_FILE")
  local result_file="$RESULTS_DIR/$index.json"

  echo "Pinging: $name ($owner)"

  # Validate anon_key exists
  if [ -z "$anon_key" ] || [ "$anon_key" = "null" ]; then
    echo "  ✗ $name missing anon_key"
    jq -n \
      --arg name "$name" \
      --arg owner "$owner" \
      --arg url "$url" \
      --arg status "error" \
      --arg http_code "N/A" \
      --arg duration "0ms" \
      --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
      '{name: $name, owner: $owner, url: $url, status: $status, http_code: $http_code, response_time: $duration, last_ping: $timestamp}' \
      > "$result_file"
    return
  fi

  local start_time=$(date +%s%3N)

  # Call the keep_alive RPC function
  local response=$(curl -s -w "\n%{http_code}" \
    --max-time 30 \
    -X POST \
    "${url}/rest/v1/rpc/keep_alive" \
    -H "apikey: ${anon_key}" \
    -H "Authorization: Bearer ${anon_key}" \
    -H "Content-Type: application/json" 2>/dev/null || echo -e "\n000")

  local end_time=$(date +%s%3N)
  local duration=$((end_time - start_time))

  # Extract status code
  local http_code=$(echo "$response" | tail -n1)

  # Determine status
  local status="down"
  if [ "$http_code" -eq 200 ]; then
    status="up"
  fi

  # Write result
  jq -n \
    --arg name "$name" \
    --arg owner "$owner" \
    --arg url "$url" \
    --arg status "$status" \
    --arg http_code "$http_code" \
    --arg duration "${duration}ms" \
    --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    '{name: $name, owner: $owner, url: $url, status: $status, http_code: $http_code, response_time: $duration, last_ping: $timestamp}' \
    > "$result_file"

  if [ "$status" = "up" ]; then
    echo "  ✓ $name is alive (${duration}ms)"
  else
    echo "  ✗ $name failed (HTTP $http_code)"
  fi
}

export -f ping_project
export PROJECTS_FILE RESULTS_DIR

# Run pings in parallel (max 100 concurrent)
echo ""
echo "Starting parallel pings..."
echo ""

seq 0 $((project_count - 1)) | xargs -P 100 -I {} bash -c 'ping_project {}'

echo ""
echo "All pings complete!"
echo ""

# Generate STATUS.md
echo "Generating status report..."

# Collect all results
total=0
up_count=0
down_count=0
results="[]"

for i in $(seq 0 $((project_count - 1))); do
  if [ -f "$RESULTS_DIR/$i.json" ]; then
    result=$(cat "$RESULTS_DIR/$i.json")
    results=$(echo "$results" | jq ". + [$result]")
    total=$((total + 1))

    status=$(echo "$result" | jq -r '.status')
    if [ "$status" = "up" ]; then
      up_count=$((up_count + 1))
    else
      down_count=$((down_count + 1))
    fi
  fi
done

# Generate STATUS.md
cat > "$STATUS_FILE" << 'HEADER'
# Status

Last updated: TIMESTAMP

## Summary

| Total | Up | Down |
|-------|-----|------|
| TOTAL | UP ✅ | DOWN ❌ |

## Projects

| Status | Project | Owner | Response Time | Last Ping |
|--------|---------|-------|---------------|-----------|
HEADER

# Replace placeholders
sed -i.bak "s/TIMESTAMP/$(date -u +"%Y-%m-%d %H:%M:%S UTC")/" "$STATUS_FILE"
sed -i.bak "s/TOTAL/$total/" "$STATUS_FILE"
sed -i.bak "s/UP/$up_count/" "$STATUS_FILE"
sed -i.bak "s/DOWN/$down_count/" "$STATUS_FILE"
rm -f "$STATUS_FILE.bak"

# Add each project row
echo "$results" | jq -r '.[] | "| \(if .status == "up" then "✅" elif .status == "error" then "⚠️" else "❌" end) | \(.name) | [@\(.owner)](https://github.com/\(.owner)) | \(.response_time) | \(.last_ping) |"' >> "$STATUS_FILE"

# Add footer
cat >> "$STATUS_FILE" << 'FOOTER'

---

*Status is updated automatically every 2 days via GitHub Actions*
FOOTER

echo "Status report generated: STATUS.md"
echo ""
echo "Summary: $up_count/$total projects alive"

# Cleanup
rm -rf "$RESULTS_DIR"

# Exit with error if any projects are down (for CI visibility)
if [ "$down_count" -gt 0 ]; then
  echo "Warning: $down_count project(s) failed to respond"
fi

exit 0
