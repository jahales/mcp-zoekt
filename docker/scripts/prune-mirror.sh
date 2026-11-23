#!/bin/sh
# prune-mirror.sh API_BASE HOST ORG TOKEN_FILE
#
# Deletes clones under /data/repos/HOST/<ORG> only on positive evidence from the API: the
# repo is archived, or it moved (renamed or transferred). A repo that is merely missing
# from the listing is kept and reported, because GitHub answers 404 alike for a deleted
# repo and for one the token can no longer see, and a narrower token must not cost clones.
# With DRY_RUN=1 it only reports.
set -u
API=$1 HOST=$2 ORG=$3
TOKEN=$(cat "$4") || exit 1

get() {
  wget -q -T 60 -O - --header "Authorization: token $TOKEN" \
    --header "Accept: application/vnd.github+json" "$API/$1" 2>/dev/null
}

# "<full_name> <archived>" for each repo in a JSON response, in document order. A repo
# object's own full_name and archived precede any nested repo object's.
pairs() {
  grep -o '"full_name": *"[^"]*"\|"archived": *[a-z]*' |
    sed 's/^"full_name": *"\(.*\)"$/N \1/; s/^"archived": */A /' |
    awk '$1 == "N" { n = $2 } $1 == "A" && n != "" { print n, $2; n = "" }'
}

dir=$(ls "/data/repos/$HOST" 2>/dev/null | grep -ixF "$ORG" | head -n 1)
[ -n "$dir" ] || exit 0

listing=$(mktemp)
trap 'rm -f "$listing"' EXIT
page=1
while [ "$page" -le 100 ]; do
  body=$(get "orgs/$ORG/repos?type=all&per_page=100&page=$page") || {
    echo "prune: listing $HOST/$ORG failed; pruning nothing" >&2
    exit 1
  }
  n=$(printf '%s' "$body" | pairs | tee -a "$listing" | wc -l)
  [ "$n" -lt 100 ] && break
  page=$((page + 1))
done

prune() {
  echo "prune: $2: $1"
  [ "${DRY_RUN:-}" = 1 ] || rm -rf "$1"
}

unseen=0
for clone in "/data/repos/$HOST/$dir"/*.git; do
  [ -d "$clone" ] || continue
  repo="$dir/$(basename "$clone" .git)"
  if grep -qFx "$repo true" "$listing"; then
    prune "$clone" archived
    continue
  fi
  grep -qFx "$repo false" "$listing" && continue
  # Not listed: ask for the repo itself. A rename or transfer redirects to its new name.
  seen=$(get "repos/$repo" | pairs | head -n 1)
  case "$seen" in
    "") echo "prune: kept $clone: not visible to the token (deleted, or access lost); delete it by hand if it is gone" >&2
        unseen=$((unseen + 1)) ;;
    "$repo true") prune "$clone" archived ;;
    "$repo false") ;;
    *) prune "$clone" "moved to ${seen% *}" ;;
  esac
done
[ "$unseen" -eq 0 ] || echo "prune: $unseen clone(s) in $HOST/$dir not visible to the token; kept" >&2
exit 0
