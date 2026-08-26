#!/bin/bash
# Run this after downloading an updated entries.json from index.html.
# Usage: ./push.sh /path/to/downloaded/entries.json
set -e
if [ -z "$1" ]; then
  echo "Usage: ./push.sh /path/to/downloaded/entries.json"
  exit 1
fi
cp "$1" ./data/entries.json
git add data/entries.json
git commit -m "Update entries $(date +%Y-%m-%d)"
git push
echo "Pushed. GitHub Pages will update in a minute or two."
