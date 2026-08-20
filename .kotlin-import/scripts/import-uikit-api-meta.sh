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

usage() {
    cat <<'USAGE'
Usage: scripts/import-uikit-api-meta.sh [options]

Options:
  --input <path>             Path to uikit-api-meta.json
  --api-base <url>           DB Service DS API base URL
  --platform <name>          xml|compose|ios|web (default: compose)
  --include-types <list>     Comma-separated source/resolved type allow-list
  --map-type <from:to>       Map a source type; may be repeated
  --link-design-systems      Link imported components to every design system
  --apply                    Write changes (default is dry-run)
  --strict                   Fail when unsupported property types are present
  --help

Environment:
  PLASMA_ANDROID_ROOT        Root of plasma-android used by the default input path
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

# Значения property_type в схеме db-service. Расширены миграцией 0004: конфигурации
# theme-converter используют одиннадцать типов, шесть исходных покрывали 81% свойств.
# Список должен совпадать с propertyTypeEnum в services/db-service/src/db/schema.ts —
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
    if [[ -n "$body" ]]; then
        curl --fail-with-body --silent --show-error \
            -X "$method" -H 'Content-Type: application/json' -d "$body" "$api_base$route"
    else
        curl --fail-with-body --silent --show-error -X "$method" "$api_base$route"
    fi
}

components_json="$(api GET /components)"
component_states_json="$(api GET /component-states)"
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

while IFS= read -r component_name; do
    component="$(jq -c --arg name "$component_name" '.[] | select(.name == $name)' <<<"$components_json" | head -n1)"
    if [[ -z "$component" ]]; then
        component="$(api POST /components "$(jq -cn --arg name "$component_name" \
            '{name:$name, description:"Imported from uikit-api-meta.json"}')")"
        components_json="$(jq -c --argjson item "$component" '. + [$item]' <<<"$components_json")"
        ((created_components += 1))
    fi
    component_id="$(jq -r '.id' <<<"$component")"

    if $link_design_systems; then
        while IFS= read -r design_system_id; do
            if ! jq -e --arg ds "$design_system_id" --arg component "$component_id" \
                '.[] | select(.designSystemId == $ds and .componentId == $component)' <<<"$links_json" >/dev/null; then
                link="$(api POST /design-system-components \
                    "$(jq -cn --arg designSystemId "$design_system_id" --arg componentId "$component_id" \
                        '{designSystemId:$designSystemId, componentId:$componentId}')")"
                links_json="$(jq -c --argjson item "$link" '. + [$item]' <<<"$links_json")"
                ((created_links += 1))
            fi
        done < <(jq -r '.[].id' <<<"$design_systems_json")
    fi

    while IFS= read -r state_name; do
        [[ -z "$state_name" ]] && continue
        if ! jq -e --arg component "$component_id" --arg name "$state_name" \
            '.[] | select(.componentId == $component and .name == $name)' \
            <<<"$component_states_json" >/dev/null; then
            state="$(api POST /component-states "$(jq -cn --arg componentId "$component_id" --arg name "$state_name" \
                '{componentId:$componentId, name:$name}')")"
            component_states_json="$(jq -c --argjson item "$state" '. + [$item]' <<<"$component_states_json")"
            ((created_states += 1))
        fi
    done < <(jq -r --arg component "$component_name" '[.[] | select(.component == $component) | .name] | .[]' "$states_manifest")

    existing_properties="$(api GET "/components/$component_id/properties")"
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
    done < <(
        jq -r --arg component "$component_name" '
            [.[] | select(.included and .component == $component)]
            | unique_by(.name)
            | .[]
            | [.name, .type, .description] | @tsv' "$manifest"
    )
done < <(jq -r '[.[] | select(.included) | .component] | unique[]' "$manifest")

jq -n \
    --argjson createdComponents "$created_components" \
    --argjson createdStates "$created_states" \
    --argjson createdProperties "$created_properties" \
    --argjson updatedProperties "$updated_properties" \
    --argjson createdAliases "$created_aliases" \
    --argjson createdDesignSystemLinks "$created_links" \
    '{createdComponents:$createdComponents, createdStates:$createdStates, createdProperties:$createdProperties, updatedProperties:$updatedProperties, createdAliases:$createdAliases, createdDesignSystemLinks:$createdDesignSystemLinks}'
