#!/bin/bash
# Commit each file individually
set -e

cd /c/Users/david/tradeships.io

# Process modified files
git status --porcelain | while IFS= read -r line; do
  status="${line:0:2}"
  file="${line:3}"

  if [ "$status" = "??" ]; then
    # Untracked file - derive commit message
    path="$file"
    filename=$(basename "$file")
    
    if [[ "$path" == src/core/execution/* ]]; then
      msg="feat(core): add $filename"
    elif [[ "$path" == src/core/game/* ]]; then
      msg="feat(core): add $filename"
    elif [[ "$path" == src/core/* ]]; then
      msg="feat(core): add $filename"
    elif [[ "$path" == src/client/* ]]; then
      msg="feat(client): add $filename"
    elif [[ "$path" == tests/* ]]; then
      msg="test: add $filename"
    elif [[ "$path" == resources/* ]]; then
      msg="feat(assets): add $filename"
    elif [[ "$path" == docs/* ]]; then
      msg="docs: add $filename"
    else
      msg="feat: add $filename"
    fi

    git add "$file" && git commit -m "$msg"
    echo "COMMITTED: $file -> $msg"
  else
    # Modified file
    path="$file"
    filename=$(basename "$file")
    
    if [[ "$path" == tests/* ]]; then
      subarea=$(echo "$path" | cut -d'/' -f2)
      msg="test($subarea): update $filename"
    elif [[ "$path" == src/core/execution/* ]]; then
      msg="feat(core): update $filename"
    elif [[ "$path" == src/core/game/* ]]; then
      msg="feat(core): update $filename"
    elif [[ "$path" == src/core/* ]]; then
      msg="feat(core): update $filename"
    elif [[ "$path" == src/client/view/* ]]; then
      msg="feat(client): update $filename"
    elif [[ "$path" == src/client/hud/* ]]; then
      msg="feat(hud): update $filename"
    elif [[ "$path" == src/client/render/* ]]; then
      msg="feat(render): update $filename"
    elif [[ "$path" == src/client/* ]]; then
      msg="feat(client): update $filename"
    elif [[ "$path" == src/server/* ]]; then
      msg="feat(server): update $filename"
    elif [[ "$path" == resources/* ]]; then
      msg="feat(assets): update $filename"
    elif [[ "$path" == scripts/* ]]; then
      msg="chore(scripts): update $filename"
    else
      msg="chore: update $filename"
    fi

    git add "$file" && git commit -m "$msg"
    echo "COMMITTED: $file -> $msg"
  fi
done

echo ""
echo "=== ALL DONE ==="
