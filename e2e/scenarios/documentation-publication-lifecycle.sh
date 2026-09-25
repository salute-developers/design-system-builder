#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=../lib/common.sh
source "$E2E_ROOT/lib/common.sh"
e2e_load_context

e2e_require docker
e2e_require tar

e2e_log "Scenario documentation-publication-lifecycle: checking replacement and exact cleanup"

backend_compose=(
  docker compose
  --project-directory "$E2E_ROOT/../backend-kt"
  --file "$E2E_ROOT/../backend-kt/docker-compose.local.yml"
)
owner_token="$(e2e_access_token "$E2E_OWNER_USERNAME")"
scenario_dir="$E2E_ARTIFACTS_DIR/documentation-publication-lifecycle"
mkdir -p "$scenario_dir"

psql_query() {
  "${backend_compose[@]}" exec -T documentation-db \
    psql --username documentation --dbname documentation_service \
      --no-align --tuples-only --set ON_ERROR_STOP=1 --command "$1"
}

worker_diagnostics() {
  "${backend_compose[@]}" exec -T documentation-service \
    wget -qO- http://localhost:8084/health/worker
}

start_cleanup_worker() {
  DOCUMENTATION_CLEANUP_ENABLED=true \
    DOCUMENTATION_CLEANUP_GRACE_SECONDS="${DOCUMENTATION_CLEANUP_GRACE_SECONDS:?}" \
    DOCUMENTATION_CLEANUP_POLLING_MS="${DOCUMENTATION_CLEANUP_POLLING_MS:?}" \
    "${backend_compose[@]}" up --detach --no-deps --force-recreate documentation-service gateway \
    > "$scenario_dir/cleanup-worker-start.txt"

  for _ in {1..120}; do
    if worker_diagnostics > "$scenario_dir/cleanup-enabled.json" 2>/dev/null && \
      jq --exit-status '.cleanupEnabled == true' "$scenario_dir/cleanup-enabled.json" >/dev/null; then
      break
    fi
    sleep 0.25
  done
  jq --exit-status '.cleanupEnabled == true' "$scenario_dir/cleanup-enabled.json" >/dev/null 2>&1 || \
    e2e_fail "Cleanup worker did not start"

  for _ in {1..120}; do
    curl --fail-with-body --silent --show-error "$E2E_GATEWAY_URL/health" >/dev/null 2>&1 && return 0
    sleep 0.25
  done
  e2e_fail "Gateway did not recover after enabling cleanup worker"
}

minio_object_exists() {
  local key="$1"

  "${backend_compose[@]}" run --rm --no-deps \
    --env "E2E_OBJECT_KEY=$key" \
    --entrypoint /bin/sh minio-init \
    -c 'mc alias set local http://minio:9000 minio minio123 >/dev/null && mc stat "local/documentation-bundles/$E2E_OBJECT_KEY" >/dev/null' \
    >/dev/null 2>&1
}

assert_objects_present() {
  local keys_file="$1"
  local key

  while IFS= read -r key; do
    [[ -n "$key" ]] || continue
    minio_object_exists "$key" || e2e_fail "Expected MinIO object is missing: $key"
  done < "$keys_file"
}

assert_objects_absent() {
  local keys_file="$1"
  local key

  while IFS= read -r key; do
    [[ -n "$key" ]] || continue
    if minio_object_exists "$key"; then
      e2e_fail "Cleanup left an exact MinIO object behind: $key"
    fi
  done < "$keys_file"
}

create_bundle() {
  local name="$1"
  local version="$2"
  local marker="$3"
  local fixture="$scenario_dir/$name"
  local archive="$scenario_dir/$name.tar.gz"

  mkdir -p "$fixture/content" "$fixture/assets" "$fixture/meta"
  jq --null-input \
    --arg design_system_id "$design_system_id" \
    --arg version "$version" \
    '{
      schemaVersion: "1.0",
      designSystem: {id: $design_system_id, version: $version},
      platform: "compose",
      artifacts: [
        {type: "RESOLVED_DOCS", path: "docs.json", format: "dsb-resolved-docs-v1"},
        {type: "CONTENT_ROOT", path: "content/", format: null},
        {type: "SCREENSHOTS", path: "assets/", format: null},
        {type: "COMPONENTS_INFO", path: "meta/components-info.json", format: "sdds-compose-components-info-v1"}
      ]
    }' > "$fixture/manifest.json"
  jq --null-input --arg marker "$marker" \
    '{navigation: [{
      title: $marker,
      subjects: ["components.lifecycle"],
      path: "components/lifecycle",
      contentRefs: [{source: "Core", path: "content/lifecycle.md"}]
    }]}' > "$fixture/docs.json"
  printf '# %s\n\n![Lifecycle](../assets/lifecycle.svg)\n' "$marker" > "$fixture/content/lifecycle.md"
  printf '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><title>%s</title></svg>\n' \
    "$marker" > "$fixture/assets/lifecycle.svg"
  jq --null-input --arg marker "$marker" \
    '{
      name: $marker,
      packageName: "com.example.lifecycle",
      components: [{
        key: "lifecycle",
        coreName: $marker,
        styleName: $marker,
        props: [{name: "size", values: ["m"], defaultValue: "m"}],
        styleApi: {
          packageName: "com.example.lifecycle",
          stylesClassName: "LifecycleStyles",
          params: [{name: "size", type: "enum", values: [{value: "m", codeName: "M"}]}]
        },
        variations: [{name: "m", composeReference: "Lifecycle.M", props: [{name: "size", value: "m"}]}]
      }]
    }' > "$fixture/meta/components-info.json"
  tar -czf "$archive" -C "$fixture" manifest.json docs.json content assets meta
  printf '%s' "$archive"
}

publish_bundle() {
  local archive="$1"
  local name="$2"
  local response_file="$scenario_dir/$name-accepted.json"
  local status

  status="$(
    e2e_http_status "$response_file" \
      --request POST "$E2E_GATEWAY_URL/api/projects/$E2E_PROJECT_ID/documentation/bundles" \
      --header "Authorization: Bearer $owner_token" \
      --form "bundle=@$archive;type=application/gzip"
  )"
  e2e_assert_equals "202" "$status" "Documentation bundle was not accepted"
  jq --exit-status --raw-output '.jobId' "$response_file"
}

wait_for_published_job() {
  local job_id="$1"
  local name="$2"
  local response_file="$scenario_dir/$name-job.json"
  local status
  local job_status

  for _ in {1..120}; do
    status="$(
      e2e_http_status "$response_file" \
        "$E2E_GATEWAY_URL/api/projects/$E2E_PROJECT_ID/documentation/ingestion-jobs/$job_id" \
        --header "Authorization: Bearer $owner_token"
    )"
    if [[ "$status" == "200" ]]; then
      job_status="$(jq --exit-status --raw-output '.status' "$response_file")"
      [[ "$job_status" == "published" ]] && return 0
      [[ "$job_status" == "failed" ]] && e2e_fail "Documentation job failed: $(jq -c '.diagnostics' "$response_file")"
    fi
    sleep 0.25
  done
  e2e_fail "Documentation job did not reach published state: $job_id"
}

active_publication() {
  local version="$1"
  local output_file="$2"
  local status

  status="$(
    e2e_http_status "$output_file" \
      --get "$E2E_GATEWAY_URL/api/projects/$E2E_PROJECT_ID/documentation/publications/active" \
      --header "Authorization: Bearer $owner_token" \
      --data-urlencode "designSystemId=$design_system_id" \
      --data-urlencode "version=$version" \
      --data-urlencode 'platform=compose'
  )"
  e2e_assert_equals "200" "$status" "Active publication is not readable for version $version"
  jq --exit-status --raw-output '.publicationId' "$output_file"
}

wait_for_cleanup() {
  local old_publication_id="$1"

  for _ in {1..120}; do
    if [[ "$(psql_query "SELECT count(*) FROM documentation_publications WHERE id = '$old_publication_id'")" == "0" ]]; then
      return 0
    fi
    sleep 0.25
  done
  e2e_fail "Superseded publication was not cleaned: $old_publication_id"
}

design_system_response="$scenario_dir/design-system.json"
design_system_payload="$(
  jq --null-input \
    --arg name "E2E lifecycle $E2E_RUN_ID" \
    --arg project_name "e2e-lifecycle-$E2E_RUN_ID" \
    --arg project_id "$E2E_PROJECT_ID" \
    '{name: $name, projectName: $project_name, projectId: $project_id}'
)"
status="$(
  e2e_http_status "$design_system_response" \
    --request POST "$E2E_GATEWAY_URL/api/projects/$E2E_PROJECT_ID/ds/design-systems" \
    --header "Authorization: Bearer $owner_token" \
    --header 'Content-Type: application/json' \
    --data "$design_system_payload"
)"
e2e_assert_equals "201" "$status" "Lifecycle design system creation failed"
design_system_id="$(jq --exit-status --raw-output '.id' "$design_system_response")"

worker_diagnostics > "$scenario_dir/cleanup-before.json"
jq --exit-status '.cleanupEnabled == false' "$scenario_dir/cleanup-before.json" >/dev/null || \
  e2e_fail "Cleanup worker must be disabled while the pending state is prepared"
created_before="$(jq --exit-status --raw-output '.cleanup.createdJobs' "$scenario_dir/cleanup-before.json")"

control_archive="$(create_bundle control-v1 1.0.0 control-v1)"
control_job="$(publish_bundle "$control_archive" control-v1)"
wait_for_published_job "$control_job" control-v1
control_publication="$(active_publication 1.0.0 "$scenario_dir/control-active-before.json")"

old_archive="$(create_bundle lifecycle-old 2.0.0 lifecycle-old)"
old_job="$(publish_bundle "$old_archive" lifecycle-old)"
wait_for_published_job "$old_job" lifecycle-old
old_publication="$(active_publication 2.0.0 "$scenario_dir/lifecycle-old-active.json")"
old_bundle="$(psql_query "SELECT bundle_id FROM documentation_publications WHERE id = '$old_publication'")"
old_raw_key="$(psql_query "SELECT storage_key FROM documentation_bundles WHERE id = '$old_bundle'")"
old_payload_state="$(psql_query "
  SELECT concat_ws(',',
    (SELECT count(*) > 0 FROM documentation_navigation_nodes WHERE publication_id = '$old_publication'),
    (SELECT count(*) > 0 FROM documentation_pages WHERE publication_id = '$old_publication'),
    (SELECT count(*) > 0 FROM documentation_content WHERE publication_id = '$old_publication'),
    (SELECT count(*) > 0 FROM documentation_assets WHERE publication_id = '$old_publication'),
    (SELECT count(*) > 0 FROM structured_artifacts WHERE publication_id = '$old_publication'),
    (SELECT count(*) > 0 FROM code_bindings WHERE publication_id = '$old_publication'),
    (SELECT count(*) > 0 FROM structured_lookup_terms WHERE publication_id = '$old_publication'),
    (SELECT count(*) > 0 FROM knowledge_chunks WHERE publication_id = '$old_publication')
  )
")"
e2e_assert_equals "t,t,t,t,t,t,t,t" "$old_payload_state" \
  "Old publication fixture did not exercise every persisted payload type"
psql_query "
  SELECT link.content_id || '|' || link.asset_id
  FROM documentation_content_assets link
  JOIN documentation_content content ON content.id = link.content_id
  WHERE content.publication_id = '$old_publication'
  ORDER BY 1
" > "$scenario_dir/old-content-asset-links.txt"
[[ -s "$scenario_dir/old-content-asset-links.txt" ]] || e2e_fail "Old publication has no content-to-asset link"
psql_query "
  SELECT storage_key FROM documentation_content WHERE publication_id = '$old_publication'
  UNION SELECT storage_key FROM documentation_assets WHERE publication_id = '$old_publication'
  UNION SELECT storage_key FROM structured_artifacts WHERE publication_id = '$old_publication'
  ORDER BY 1
" > "$scenario_dir/old-publication-object-keys.txt"
printf '%s\n' "$old_raw_key" >> "$scenario_dir/old-publication-object-keys.txt"
assert_objects_present "$scenario_dir/old-publication-object-keys.txt"

new_archive="$(create_bundle lifecycle-new 2.0.0 lifecycle-new)"
new_job="$(publish_bundle "$new_archive" lifecycle-new)"
wait_for_published_job "$new_job" lifecycle-new
new_publication="$(active_publication 2.0.0 "$scenario_dir/lifecycle-new-active.json")"
[[ "$new_publication" != "$old_publication" ]] || e2e_fail "Repeated publication did not switch the active snapshot"

old_state="$(psql_query "
  SELECT publication.status || ':' || cleanup.state
  FROM documentation_publications publication
  JOIN publication_cleanup_jobs cleanup ON cleanup.publication_id = publication.id
  WHERE publication.id = '$old_publication'
")"
e2e_assert_equals "superseded:pending" "$old_state" "Replacement did not create an observable pending cleanup job"
worker_diagnostics > "$scenario_dir/cleanup-pending.json"
created_pending="$(jq --exit-status --raw-output '.cleanup.createdJobs' "$scenario_dir/cleanup-pending.json")"
(( created_pending > created_before )) || e2e_fail "Cleanup diagnostics did not observe the created job"

new_bundle="$(psql_query "SELECT bundle_id FROM documentation_publications WHERE id = '$new_publication'")"
new_raw_key="$(psql_query "SELECT storage_key FROM documentation_bundles WHERE id = '$new_bundle'")"
psql_query "
  SELECT storage_key FROM documentation_content WHERE publication_id = '$new_publication'
  UNION SELECT storage_key FROM documentation_assets WHERE publication_id = '$new_publication'
  UNION SELECT storage_key FROM structured_artifacts WHERE publication_id = '$new_publication'
  ORDER BY 1
" > "$scenario_dir/new-publication-object-keys.txt"
printf '%s\n' "$new_raw_key" >> "$scenario_dir/new-publication-object-keys.txt"

control_bundle="$(psql_query "SELECT bundle_id FROM documentation_publications WHERE id = '$control_publication'")"
control_raw_key="$(psql_query "SELECT storage_key FROM documentation_bundles WHERE id = '$control_bundle'")"
psql_query "
  SELECT storage_key FROM documentation_content WHERE publication_id = '$control_publication'
  UNION SELECT storage_key FROM documentation_assets WHERE publication_id = '$control_publication'
  UNION SELECT storage_key FROM structured_artifacts WHERE publication_id = '$control_publication'
  ORDER BY 1
" > "$scenario_dir/control-publication-object-keys.txt"
printf '%s\n' "$control_raw_key" >> "$scenario_dir/control-publication-object-keys.txt"

start_cleanup_worker
wait_for_cleanup "$old_publication"
worker_diagnostics > "$scenario_dir/cleanup-complete.json"
succeeded_after="$(jq --exit-status --raw-output '.cleanup.attemptsByOutcomeAndFailure["SUCCEEDED:none"] // 0' "$scenario_dir/cleanup-complete.json")"
deleted_bytes_after="$(jq --exit-status --raw-output '.cleanup.deletedBytes' "$scenario_dir/cleanup-complete.json")"
(( succeeded_after > 0 )) || e2e_fail "Cleanup diagnostics did not observe a successful cleanup"
(( deleted_bytes_after > 0 )) || e2e_fail "Cleanup diagnostics did not observe deleted bytes"

old_postgres_state="$(psql_query "
  SELECT concat_ws(',',
    (SELECT count(*) FROM documentation_publications WHERE id = '$old_publication'),
    (SELECT count(*) FROM publication_cleanup_jobs WHERE publication_id = '$old_publication'),
    (SELECT count(*) FROM documentation_navigation_nodes WHERE publication_id = '$old_publication'),
    (SELECT count(*) FROM documentation_pages WHERE publication_id = '$old_publication'),
    (SELECT count(*) FROM documentation_content WHERE publication_id = '$old_publication'),
    (SELECT count(*) FROM documentation_assets WHERE publication_id = '$old_publication'),
    (SELECT count(*) FROM structured_artifacts WHERE publication_id = '$old_publication'),
    (SELECT count(*) FROM code_bindings WHERE publication_id = '$old_publication'),
    (SELECT count(*) FROM structured_lookup_terms WHERE publication_id = '$old_publication'),
    (SELECT count(*) FROM knowledge_chunks WHERE publication_id = '$old_publication'),
    (SELECT count(*) FROM active_documentation_publications WHERE publication_id = '$old_publication')
  )
")"
printf '%s\n' "$old_postgres_state" > "$scenario_dir/old-postgres-state-after.txt"
e2e_assert_equals "0,0,0,0,0,0,0,0,0,0,0" "$old_postgres_state" \
  "Cleanup left rows belonging to the superseded publication"

storage_deleted="$(psql_query "SELECT storage_deleted_at IS NOT NULL FROM documentation_bundles WHERE id = '$old_bundle'")"
e2e_assert_equals "t" "$storage_deleted" "Old bundle metadata does not record storage deletion"
while IFS='|' read -r content_id asset_id; do
  link_count="$(psql_query "SELECT count(*) FROM documentation_content_assets WHERE content_id = '$content_id' AND asset_id = '$asset_id'")"
  e2e_assert_equals "0" "$link_count" "Cleanup left an exact content-to-asset link"
done < "$scenario_dir/old-content-asset-links.txt"
assert_objects_absent "$scenario_dir/old-publication-object-keys.txt"

new_state="$(psql_query "SELECT status || ':' || (bundle.storage_deleted_at IS NULL)::text FROM documentation_publications publication JOIN documentation_bundles bundle ON bundle.id = publication.bundle_id WHERE publication.id = '$new_publication'")"
control_state="$(psql_query "SELECT status || ':' || (bundle.storage_deleted_at IS NULL)::text FROM documentation_publications publication JOIN documentation_bundles bundle ON bundle.id = publication.bundle_id WHERE publication.id = '$control_publication'")"
e2e_assert_equals "published:true" "$new_state" "New active publication was changed by cleanup"
e2e_assert_equals "published:true" "$control_state" "Control version was changed by cleanup"
new_payload_preserved="$(psql_query "SELECT count(*) > 0 FROM structured_lookup_terms WHERE publication_id = '$new_publication'")"
control_payload_preserved="$(psql_query "SELECT count(*) > 0 FROM structured_lookup_terms WHERE publication_id = '$control_publication'")"
e2e_assert_equals "t" "$new_payload_preserved" "New publication payload rows were removed by cleanup"
e2e_assert_equals "t" "$control_payload_preserved" "Control version payload rows were removed by cleanup"
assert_objects_present "$scenario_dir/new-publication-object-keys.txt"
assert_objects_present "$scenario_dir/control-publication-object-keys.txt"

active_new_after="$(active_publication 2.0.0 "$scenario_dir/lifecycle-new-active-after.json")"
active_control_after="$(active_publication 1.0.0 "$scenario_dir/control-active-after.json")"
e2e_assert_equals "$new_publication" "$active_new_after" "New publication is no longer active after cleanup"
e2e_assert_equals "$control_publication" "$active_control_after" "Control version is no longer active after cleanup"

"${backend_compose[@]}" exec -T documentation-service \
  wget -qO- http://localhost:8084/health/ready > "$scenario_dir/readiness-after.txt" || \
  e2e_fail "Documentation readiness depends on cleanup state"
grep --fixed-strings 'ok' "$scenario_dir/readiness-after.txt" >/dev/null || \
  e2e_fail "Documentation service is not ready after cleanup"

e2e_log "PASS: documentation-publication-lifecycle"
