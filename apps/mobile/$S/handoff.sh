#!/bin/zsh
S="$(dirname "$0")"
while pgrep -f "authority-sweep.ts" >/dev/null; do sleep 30; done
echo TARAMA_BITTI; tail -3 "$S/chain2.log"
pkill -f "chain2.sh" || true
zsh "$S/chain3.sh"
