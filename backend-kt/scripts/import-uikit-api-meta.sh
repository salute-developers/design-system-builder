#!/usr/bin/env bash
set -euo pipefail

DEFAULT_INPUT="${PLASMA_ANDROID_ROOT:-../plasma-android}/sdds-core/uikit-compose/build/generated/ksp/release/resources/sdds/api/uikit-api-meta.json"
input="$DEFAULT_INPUT"
api_base="http://localhost:3008/api/ds"
platform="compose"
apply=false
strict=false
link_design_systems=false
include_types=""
type_map='{}'
api_key="${DSBUILDER_API_KEY:-}"
bearer_token="${DSBUILDER_BEARER_TOKEN:-}"
authorization_header="${DSBUILDER_AUTHORIZATION:-}"
request_delay_ms="${DSBUILDER_REQUEST_DELAY_MS:-0}"
request_timeout_seconds="${DSBUILDER_REQUEST_TIMEOUT_SECONDS:-30}"

usage() {
    cat <<'USAGE'
Usage: scripts/import-uikit-api-meta.sh [options]

Options:
  --input <path>             Path to uikit-api-meta.json
  --api-base <url>           DB Service DS API base URL or Gateway project DS API base URL
  --platform <name>          xml|compose|ios|web (default: compose)
  --include-types <list>     Comma-separated source/resolved type allow-list
  --map-type <from:to>       Map a source type; may be repeated
  --api-key <token>          Project access key for Gateway auth
  --bearer-token <token>     User access token for Gateway auth
  --authorization-header <v> Raw Authorization header value
  --request-delay-ms <ms>    Delay after each API request; useful for Gateway rate limits
  --request-timeout <sec>    Max time for each API request (default: 30)
  --link-design-systems      Link imported components to every design system
  --apply                    Write changes (default is dry-run)
  --strict                   Fail when unsupported property types are present
  --help

Environment:
  PLASMA_ANDROID_ROOT        Root of plasma-android used by the default input path
  DSBUILDER_API_KEY          Project access key, sent as "Authorization: ProjectKey <token>"
  DSBUILDER_BEARER_TOKEN     User access token, sent as "Authorization: Bearer <token>"
  DSBUILDER_AUTHORIZATION    Raw Authorization header value; overrides other auth env/args
  DSBUILDER_REQUEST_DELAY_MS Delay after each API request in milliseconds
  DSBUILDER_REQUEST_TIMEOUT_SECONDS
                            Max time for each API request
USAGE
}

require_value() {
    if [[ $# -lt 2 || -z "$2" || "$2" == --* ]]; then
        echo "Missing value for $1" >&2
        exit 2
    fi
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --input) require_value "$@"; input="$2"; shift 2 ;;
        --api-base) require_value "$@"; api_base="${2%/}"; shift 2 ;;
        --platform) require_value "$@"; platform="$2"; shift 2 ;;
        --include-types) require_value "$@"; include_types="$2"; shift 2 ;;
        --api-key) require_value "$@"; api_key="$2"; shift 2 ;;
        --bearer-token) require_value "$@"; bearer_token="$2"; shift 2 ;;
        --authorization-header) require_value "$@"; authorization_header="$2"; shift 2 ;;
        --request-delay-ms) require_value "$@"; request_delay_ms="$2"; shift 2 ;;
        --request-timeout) require_value "$@"; request_timeout_seconds="$2"; shift 2 ;;
        --map-type)
            require_value "$@"
            from="${2%%:*}"
            to="${2#*:}"
            if [[ -z "$from" || -z "$to" || "$from" == "$to" && "$2" != *:* ]]; then
                echo "--map-type expects from:to" >&2
                exit 2
            fi
            type_map="$(jq -cn --argjson map "$type_map" --arg from "$from" --arg to "$to" '$map + {($from): $to}')"
            shift 2
            ;;
        --link-design-systems) link_design_systems=true; shift ;;
        --apply) apply=true; shift ;;
        --strict) strict=true; shift ;;
        --help) usage; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
    esac
done

for command in jq curl; do
    command -v "$command" >/dev/null || {
        echo "Required command is not installed: $command" >&2
        exit 1
    }
done

case "$platform" in xml|compose|ios|web) ;; *)
    echo "Unsupported platform: $platform" >&2
    exit 2
esac

[[ -f "$input" ]] || {
    echo "Input file does not exist: $input" >&2
    exit 1
}

if ! [[ "$request_delay_ms" =~ ^[0-9]+$ ]]; then
    echo "--request-delay-ms expects a non-negative integer" >&2
    exit 2
fi
if ! [[ "$request_timeout_seconds" =~ ^[0-9]+$ ]] || [[ "$request_timeout_seconds" -eq 0 ]]; then
    echo "--request-timeout expects a positive integer" >&2
    exit 2
fi

# Значения property_type в схеме db-service. Расширены миграцией 0004: конфигурации
# theme-converter используют одиннадцать типов, шесть исходных покрывали 81% свойств.
# Список должен совпадать с propertyTypeEnum в js/services/db-service/src/db/schema.ts —
# при расхождении параметры молча пропускаются, что видно по skippedParams в отчёте.
supported_types='["color","typography","shape","shadow","dimension","float","component_style","value","icon","boolean","gradient","blur","integer"]'
invalid_targets="$(jq -cn --argjson map "$type_map" --argjson supported "$supported_types" \
    '$map | to_entries | map(select(.value as $value | $supported | index($value) | not))')"
if [[ "$(jq 'length' <<<"$invalid_targets")" -ne 0 ]]; then
    echo "Unsupported --map-type target: $(jq -r 'map(.value) | join(", ")' <<<"$invalid_targets")" >&2
    exit 2
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
manifest="$work_dir/manifest.json"

jq \
    --argjson type_map "$type_map" \
    --argjson supported "$supported_types" \
    --arg include "$include_types" '
    if type != "array" then error("Expected root JSON value to be an array") else . end
    | [
        .[]
        | select(.componentName? and (.componentName | length > 0))
        | .componentName as $component
        | (.params // [])[]
        | select(.id? and .type?)
        | .type as $sourceType
        | ($type_map[$sourceType] // $sourceType) as $resolvedType
        | {
            component: $component,
            name: .id,
            sourceType: .type,
            type: $resolvedType,
            included: (
                if $include == "" then $supported | index($resolvedType) != null
                else ($include | split(",") | map(gsub("^\\s+|\\s+$"; ""))) as $allowed
                    | ($allowed | index($sourceType) != null) or ($allowed | index($resolvedType) != null)
                end
            ),
            description: [
                (if .group? then "group: \(.group)" else empty end),
                (if .methodName? then "method: \(.methodName)" else empty end),
                (if .paramSimpleType? then "param: \(.paramSimpleType)" else empty end)
            ] | join("; ")
        }
    ]' "$input" >"$manifest"

# Семантические состояния компонента: их объявляет поле stateEnum.
#
# Имя приводится к форме, в какой состояние встречается в конфигурациях оформления: kebab-case
# в нижнем регистре. Готовое имя даёт configName, но задано оно не везде — у остальных значений
# имя записано PascalCase, и его нужно преобразовать. Без этого в таблице оказались бы вперемешку
# `Checked` и `dragging-over`, а набор состояний нельзя было бы восстановить из связей текстуально.
#
# Имя берётся из configName,
# если оно задано, иначе из name — в конфигурациях оформления состояния записаны в той же форме.
states_manifest="$(mktemp)"
jq '[
    .[]
    | select(.componentName? and (.stateEnum?.values? | length > 0))
    | .componentName as $component
    | .stateEnum.values[]
    | {
        component: $component,
        name: (
          .configName
          // (.name | gsub("(?<a>[a-z0-9])(?<b>[A-Z])"; "\(.a)-\(.b)") | ascii_downcase)
        )
      }
] | unique' "$input" >"$states_manifest"

skipped="$(jq '[.[] | select(.included | not)] | length' "$manifest")"
if $strict && [[ "$skipped" -gt 0 ]]; then
    echo "Unsupported property types found:" >&2
    jq -r '[.[] | select(.included | not) | .sourceType] | group_by(.)[] | "\(.[0])=\(length)"' "$manifest" >&2
    exit 1
fi

components="$(jq '[.[] | select(.included) | .component] | unique | length' "$manifest")"
properties="$(jq '[.[] | select(.included) | [.component, .name]] | unique | length' "$manifest")"
jq -n \
    --arg mode "$($apply && echo apply || echo dry-run)" \
    --argjson sourceComponents "$(jq '[.[].componentName] | unique | length' "$input")" \
    --argjson importComponents "$components" \
    --argjson importProperties "$properties" \
    --argjson skippedParams "$skipped" \
    --argjson importStates "$(jq 'length' "$states_manifest")" \
    '{mode:$mode, sourceComponents:$sourceComponents, importComponents:$importComponents, importProperties:$importProperties, importStates:$importStates, skippedParams:$skippedParams}'

$apply || {
    echo "Dry-run only. Re-run with --apply to write to DB Service."
    exit 0
}

api() {
    method="$1"
    route="$2"
    body="${3:-}"
    url="$api_base$route"
    curl_error="$work_dir/curl-error.txt"
    curl_headers="$work_dir/curl-headers.txt"

    if [[ -z "$authorization_header" ]]; then
        if [[ -n "$api_key" ]]; then
            authorization_header="ProjectKey $api_key"
        elif [[ -n "$bearer_token" ]]; then
            authorization_header="Bearer $bearer_token"
        fi
    fi

    set +e
    if [[ -n "$body" ]]; then
        if [[ -n "$authorization_header" ]]; then
            response="$(curl --fail-with-body --silent --show-error --dump-header "$curl_headers" \
                --connect-timeout 10 --max-time "$request_timeout_seconds" \
                --write-out $'\n%{http_code}' --output - \
                -X "$method" -H 'Content-Type: application/json' -H "Authorization: $authorization_header" \
                -d "$body" "$url" 2>"$curl_error")"
        else
            response="$(curl --fail-with-body --silent --show-error --dump-header "$curl_headers" \
                --connect-timeout 10 --max-time "$request_timeout_seconds" \
                --write-out $'\n%{http_code}' --output - \
                -X "$method" -H 'Content-Type: application/json' -d "$body" "$url" 2>"$curl_error")"
        fi
    else
        if [[ -n "$authorization_header" ]]; then
            response="$(curl --fail-with-body --silent --show-error --dump-header "$curl_headers" \
                --connect-timeout 10 --max-time "$request_timeout_seconds" \
                --write-out $'\n%{http_code}' --output - \
                -X "$method" -H "Authorization: $authorization_header" "$url" 2>"$curl_error")"
        else
            response="$(curl --fail-with-body --silent --show-error --dump-header "$curl_headers" \
                --connect-timeout 10 --max-time "$request_timeout_seconds" \
                --write-out $'\n%{http_code}' --output - -X "$method" "$url" 2>"$curl_error")"
        fi
    fi
    curl_status=$?
    http_status="${response##*$'\n'}"
    response="${response%$'\n'$http_status}"
    set -e

    if [[ "$curl_status" -ne 0 ]]; then
        echo "Request failed: $method $url (HTTP $http_status)" >&2
        if [[ -s "$curl_error" ]]; then
            cat "$curl_error" >&2
        fi
        if [[ -n "$response" ]]; then
            printf '%.1000s\n' "$response" >&2
        fi
        exit 1
    fi

    if [[ "$http_status" =~ ^3[0-9][0-9]$ ]]; then
        location="$(awk 'tolower(substr($0, 1, 9)) == "location:" { sub(/\r$/, ""); sub(/^[^:]*: */, ""); print; exit }' "$curl_headers")"
        echo "Request was redirected: $method $url (HTTP $http_status)" >&2
        if [[ -n "$location" ]]; then
            echo "Location: $location" >&2
            echo "Use the redirected URL in --api-base, for example switch http:// to https://." >&2
        fi
        exit 1
    fi

    if ! jq -e . >/dev/null 2>&1 <<<"$response"; then
        echo "Request returned non-JSON response: $method $url (HTTP $http_status)" >&2
        printf '%.1000s\n' "$response" >&2
        exit 1
    fi

    if [[ "$request_delay_ms" -gt 0 ]]; then
        sleep "$(awk -v ms="$request_delay_ms" 'BEGIN { printf "%.3f", ms / 1000 }')"
    fi

    printf '%s\n' "$response"
}

components_json="$(api GET /components)"
# Словарь состояний переехал: `refactor-component-state-sets` заменил `component_states`
# на общую таблицу `states`, где состояние взаимодействия отличается от объявленного
# компонентом пустым `componentId`. Наборы состояний живут отдельно, в `state_sets`,
# и этому скрипту не нужны: он заводит словарь, а не значения.
states_json="$(api GET /states)"
aliases_json="$(api GET /property-platform-params)"
design_systems_json='[]'
links_json='[]'
if $link_design_systems; then
    design_systems_json="$(api GET /design-systems)"
    links_json="$(api GET /design-system-components)"
fi

created_components=0
created_states=0
created_properties=0
updated_properties=0
created_aliases=0
created_links=0
processed_properties=0

components_list="$work_dir/import-components.txt"
jq -r '[.[] | select(.included) | .component] | unique[]' "$manifest" >"$components_list"
component_total="$(wc -l <"$components_list" | tr -d ' ')"
component_index=0

while IFS= read -r component_name; do
    ((component_index += 1))
    echo "Importing component $component_index/$component_total: $component_name" >&2

    component="$(jq -c --arg name "$component_name" '.[] | select(.name == $name)' <<<"$components_json" | head -n1)"
    if [[ -z "$component" ]]; then
        component="$(api POST /components "$(jq -cn --arg name "$component_name" \
            '{name:$name, description:"Imported from uikit-api-meta.json"}')")"
        components_json="$(jq -c --argjson item "$component" '. + [$item]' <<<"$components_json")"
        ((created_components += 1))
    fi
    component_id="$(jq -r '.id' <<<"$component")"

    if $link_design_systems; then
        design_system_ids="$work_dir/design-system-ids.txt"
        jq -r '.[].id' <<<"$design_systems_json" >"$design_system_ids"
        while IFS= read -r design_system_id; do
            if ! jq -e --arg ds "$design_system_id" --arg component "$component_id" \
                '.[] | select(.designSystemId == $ds and .componentId == $component)' <<<"$links_json" >/dev/null; then
                link="$(api POST /design-system-components \
                    "$(jq -cn --arg designSystemId "$design_system_id" --arg componentId "$component_id" \
                        '{designSystemId:$designSystemId, componentId:$componentId}')")"
                links_json="$(jq -c --argjson item "$link" '. + [$item]' <<<"$links_json")"
                ((created_links += 1))
            fi
        done <"$design_system_ids"
    fi

    component_states="$work_dir/component-states.txt"
    jq -r --arg component "$component_name" '[.[] | select(.component == $component) | .name] | .[]' \
        "$states_manifest" >"$component_states"
    while IFS= read -r state_name; do
        [[ -z "$state_name" ]] && continue
        if ! jq -e --arg component "$component_id" --arg name "$state_name" \
            '.[] | select(.componentId == $component and .name == $name)' \
            <<<"$states_json" >/dev/null; then
            state="$(api POST /states "$(jq -cn --arg componentId "$component_id" --arg name "$state_name" \
                '{componentId:$componentId, name:$name}')")"
            states_json="$(jq -c --argjson item "$state" '. + [$item]' <<<"$states_json")"
            ((created_states += 1))
        fi
    done <"$component_states"

    existing_properties="$(api GET "/components/$component_id/properties")"
    component_properties="$work_dir/component-properties.tsv"
    jq -r --arg component "$component_name" '
        [.[] | select(.included and .component == $component)]
        | unique_by(.name)
        | .[]
        | [.name, .type, .description] | @tsv' "$manifest" >"$component_properties"
    while IFS=$'\t' read -r property_name property_type description; do
        property="$(jq -c --arg name "$property_name" '.[] | select(.name == $name)' <<<"$existing_properties" | head -n1)"
        body="$(jq -cn --arg componentId "$component_id" --arg name "$property_name" \
            --arg type "$property_type" --arg description "$description" \
            '{componentId:$componentId, name:$name, type:$type} + if $description == "" then {} else {description:$description} end')"
        if [[ -z "$property" ]]; then
            property="$(api POST /properties "$body")"
            existing_properties="$(jq -c --argjson item "$property" '. + [$item]' <<<"$existing_properties")"
            ((created_properties += 1))
        elif [[ "$(jq -r '.type' <<<"$property")" != "$property_type" ]]; then
            property_id="$(jq -r '.id' <<<"$property")"
            property="$(api PATCH "/properties/$property_id" "$body")"
            ((updated_properties += 1))
        fi
        property_id="$(jq -r '.id' <<<"$property")"
        if ! jq -e --arg property "$property_id" --arg platform "$platform" --arg name "$property_name" \
            '.[] | select(.propertyId == $property and .platform == $platform and .name == $name)' \
            <<<"$aliases_json" >/dev/null; then
            alias="$(api POST /property-platform-params \
                "$(jq -cn --arg propertyId "$property_id" --arg platform "$platform" --arg name "$property_name" \
                    '{propertyId:$propertyId, platform:$platform, name:$name}')")"
            aliases_json="$(jq -c --argjson item "$alias" '. + [$item]' <<<"$aliases_json")"
            ((created_aliases += 1))
        fi
        ((processed_properties += 1))
        if [[ $((processed_properties % 100)) -eq 0 ]]; then
            echo "Processed properties: $processed_properties/$properties" >&2
        fi
    done <"$component_properties"
done <"$work_dir/import-components.txt"

jq -n \
    --argjson createdComponents "$created_components" \
    --argjson createdStates "$created_states" \
    --argjson createdProperties "$created_properties" \
    --argjson updatedProperties "$updated_properties" \
    --argjson createdAliases "$created_aliases" \
    --argjson createdDesignSystemLinks "$created_links" \
    '{createdComponents:$createdComponents, createdStates:$createdStates, createdProperties:$createdProperties, updatedProperties:$updatedProperties, createdAliases:$createdAliases, createdDesignSystemLinks:$createdDesignSystemLinks}'
