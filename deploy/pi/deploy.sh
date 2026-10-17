#!/bin/sh
# Brings the Pi up to date with main: new compose files from git, new images
# from GHCR. Containers whose image did not change keep running.
# Run by listion-deploy@.timer, see docs/raspberry-pi.md.

# Wrapped in a function: `git pull` may rewrite this very file, and sh has to
# have read all of it before that happens.
main() {
  set -eu
  cd "$(dirname "$0")/../.."

  git pull --ff-only --quiet
  docker compose pull --quiet
  docker compose up -d --remove-orphans
  # The SD card is small and every deploy leaves the previous images behind.
  docker image prune -f > /dev/null
}

main "$@"
