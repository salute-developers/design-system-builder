#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
fixture="$(mktemp -d "${TMPDIR:-/tmp}/dsbuilder-verify-order.XXXXXX")"
trap 'rm -rf "$fixture"' EXIT
mkdir -p "$fixture/bin" "$fixture/.verification" "$fixture/a" "$fixture/b"
cp "$ROOT/tools/verify" "$fixture/verify"
cat > "$fixture/bin/git" <<'SH'
#!/usr/bin/env bash
[[ "${1:-}" != "-C" ]] || shift 2
case "$1 ${2:-}" in
  'rev-parse --show-toplevel') printf '%s\n' "$FIXTURE_ROOT" ;;
  'rev-parse --verify') exit 0 ;;
  'symbolic-ref --quiet') printf 'fixture-branch\n' ;;
  'config --get') exit 1 ;;
  'merge-base '*) printf 'fixture-base\n' ;;
  'diff --name-only') printf '%s\n' "$CHANGED_PATHS" ;;
  'ls-files --others'|'ls-files --cached'|'ls-tree -r') exit 0 ;;
  'hash-object --stdin') cat > /dev/null; printf 'empty-fingerprint\n' ;;
  *) printf 'Unexpected fixture git invocation: %s\n' "$*" >&2; exit 99 ;;
esac
SH
cat > "$fixture/bin/record" <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$1" >> "$TRACE"
[[ "$1" != "${FAIL_COMMAND:-}" ]] || exit 17
SH
chmod +x "$fixture/bin/git" "$fixture/bin/record"
cat > "$fixture/.verification/config" <<'CFG'
verification_version 2
base_ref dev
openspec_changes_path openspec/changes
protected_path fixture fixture unused unused
forbidden_path_segment node_modules
forbidden_file_name .env
forbidden_file_prefix .env.
process_path tools
process_command . true
contour a a a 'record fast-a' 'record full-a' 'record audit-a' 'record compare-a'
contour b b b 'record fast-b' 'record full-b' 'record audit-b' 'record compare-b'
CFG
export FIXTURE_ROOT="$fixture" TRACE="$fixture/trace" PATH="$fixture/bin:$PATH"
export CHANGED_PATHS=$'a/file.kt\nb/file.ts'

run_case() {
    local mode="$1" failure="$2" expected_code="$3" expected_trace="$4" code=0
    shift 4
    : > "$TRACE"
    FAIL_COMMAND="$failure" bash "$fixture/verify" "$mode" "$@" > "$fixture/output" 2>&1 || code=$?
    [[ "$code" == "$expected_code" ]] || {
        cat "$fixture/output" >&2
        printf 'Unexpected exit code: %s, wanted %s\n' "$code" "$expected_code" >&2
        exit 1
    }
    [[ "$(cat "$TRACE")" == "$expected_trace" ]] || {
        printf 'Unexpected execution order for %s:\n' "$mode" >&2
        cat "$TRACE" >&2
        exit 1
    }
}

run_case fast '' 0 $'compare-a\ncompare-b\nfast-a\nfast-b'
run_case fast compare-b 17 $'compare-a\ncompare-b'
run_case full '' 0 $'compare-a\ncompare-b\nfull-a\nfull-b'
run_case full compare-b 17 $'compare-a\ncompare-b'
run_case audit '' 0 $'audit-a\naudit-b'
run_case policy '' 0 ''
run_case fast '' 0 '' --dry-run
# Сравнения dry-run тоже должны предшествовать командам проектных проверок.
first_compare="$(awk '/DRY RUN .*compare-a/ { print NR; exit }' "$fixture/output")"
first_fast="$(awk '/DRY RUN .*fast-a/ { print NR; exit }' "$fixture/output")"
[[ -n "$first_compare" && -n "$first_fast" && "$first_compare" -lt "$first_fast" ]]
export CHANGED_PATHS='a/file.kt'
run_case fast '' 0 $'compare-a\nfast-a'
run_case fast '' 0 $'compare-a\ncompare-b\nfast-a\nfast-b' --all
printf 'PASS: verification order, early failure, full, audit, policy, dry-run and contour selection\n'
