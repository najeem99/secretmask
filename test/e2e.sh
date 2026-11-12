#!/usr/bin/env bash
# End-to-end: mask a real git repo, check git sees nothing, simulate Claude edits, unmask.
set -euo pipefail
CLI="$(cd "$(dirname "$0")/.." && pwd)/packages/cli/dist/secretmask.js"
export SECRETMASK_HOME="$(mktemp -d)"
P="$(mktemp -d)"; cd "$P"
fail() { echo "FAIL: $*"; exit 1; }

git init -q && git config user.email t@t && git config user.name t
cp -r "$(dirname "$CLI")/../../../examples/spring-boot/." .
git add -A && git commit -qm init
git config filter.secretmask.clean "node \"$CLI\" clean"
git config filter.secretmask.smudge cat
printf '*.yml filter=secretmask\n*.java filter=secretmask\n*.properties filter=secretmask\n' > .git/info/attributes

node "$CLI" mask .
YML=src/main/resources/application.yml
grep -q 'Claude123' "$YML" && fail "secret still visible"
grep -q '${KAFKA_PWD}' "$YML" || fail "placeholder was masked"
[ "$(node "$CLI" status .)" = masked ] || fail "status"
[ -z "$(git status --porcelain)" ] || { git status --porcelain; fail "git shows masking as a change"; }

# Claude copies a token into a new file and makes a real edit
TOK=$(grep ' password:' "$YML" | awk '{print $2}')
echo "class Copy { String pw = \"$TOK\"; }" > src/main/java/Copy.java
sed -i.bak 's/class App {/class App { int edited;/' src/main/java/App.java && rm src/main/java/App.java.bak
[ "$(git diff --name-only)" = "src/main/java/App.java" ] || fail "real edit not visible / extra diffs"

node "$CLI" unmask .
grep -q 'Claude123' src/main/java/Copy.java || fail "copied token not restored"
grep -q 'password: Claude123' "$YML" || fail "yml not restored"
echo "e2e: PASS"
