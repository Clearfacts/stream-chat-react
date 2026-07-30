#!/usr/bin/env bash

set -euo pipefail

required_variables=(
  JIRA_BASE_URL
  JIRA_USER_EMAIL
  JIRA_API_TOKEN
  JIRA_PROJECT_KEY
  JIRA_BOARD_ID
  JIRA_TEAM_NAME
  JIRA_PARENT_KEY
  JIRA_ISSUE_TYPE
  BLACKDUCK_PROJECT_NAME
  BLACKDUCK_SCAN_URL
  GITHUB_RUN_URL
)

for variable in "${required_variables[@]}"; do
  if [[ -z "${!variable:-}" ]]; then
    echo "::error::Missing required input: ${variable}"
    exit 1
  fi
done

temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

jira_request() {
  local method=$1
  local endpoint=$2
  local output_file=$3
  local data_file=${4:-}
  local arguments=(
    --silent
    --show-error
    --fail-with-body
    --request "$method"
    --user "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}"
    --header 'Accept: application/json'
    --header 'Content-Type: application/json'
    --output "$output_file"
  )

  if [[ -n "$data_file" ]]; then
    arguments+=(--data "@${data_file}")
  fi

  curl "${arguments[@]}" "${JIRA_BASE_URL%/}${endpoint}"
}

summary="BlackDuck vulnerabilities (${BLACKDUCK_PROJECT_NAME})"
search_request="$temporary_directory/search-request.json"
search_response="$temporary_directory/search-response.json"
jql="project = ${JIRA_PROJECT_KEY} AND summary ~ \"BlackDuck vulnerabilities\" AND statusCategory != Done"

jq -n --arg jql "$jql" '{jql: $jql, fields: ["summary"], maxResults: 100}' > "$search_request"
jira_request POST '/rest/api/3/search/jql' "$search_response" "$search_request"

sprints_response="$temporary_directory/sprints-response.json"
jira_request GET "/rest/agile/1.0/board/${JIRA_BOARD_ID}/sprint?state=active&maxResults=50" "$sprints_response"

mapfile -t active_sprints < <(
  jq -r \
    --arg team_name "$JIRA_TEAM_NAME" \
    '($team_name | ascii_downcase) as $team | .values[] | select(.name | ascii_downcase | contains($team)) | .id' \
    "$sprints_response"
)
if (( ${#active_sprints[@]} != 1 )); then
  echo "::error::Expected one active sprint for team ${JIRA_TEAM_NAME} on JIRA board ${JIRA_BOARD_ID}, found ${#active_sprints[@]}"
  exit 1
fi

move_to_active_sprint() {
  local sprint_request="$temporary_directory/sprint-request.json"
  local sprint_response="$temporary_directory/sprint-response.json"

  jq -n --args '$ARGS.positional | {issues: .}' -- "$@" > "$sprint_request"
  jira_request POST "/rest/agile/1.0/sprint/${active_sprints[0]}/issue" "$sprint_response" "$sprint_request"
}

mapfile -t matching_issues < <(jq -r --arg summary "$summary" '.issues[] | select(.fields.summary == $summary) | .key' "$search_response")
if (( ${#matching_issues[@]} > 0 )); then
  if (( ${#matching_issues[@]} > 1 )); then
    echo "::warning::Multiple open Black Duck issues exist: ${matching_issues[*]}"
  fi
  move_to_active_sprint "${matching_issues[@]}"
  echo "Reused open Black Duck issue: ${matching_issues[*]}"
  echo "issue_key=${matching_issues[0]}" >> "$GITHUB_OUTPUT"
  exit 0
fi

create_request="$temporary_directory/create-request.json"
create_response="$temporary_directory/create-response.json"
jq -n \
  --arg project "$JIRA_PROJECT_KEY" \
  --arg issue_type "$JIRA_ISSUE_TYPE" \
  --arg parent_key "$JIRA_PARENT_KEY" \
  --arg summary "$summary" \
  --arg scan_url "$BLACKDUCK_SCAN_URL" \
  --arg run_url "$GITHUB_RUN_URL" \
  '{
    fields: {
      project: {key: $project},
      issuetype: {name: $issue_type},
      parent: {key: $parent_key},
      summary: $summary,
      labels: ["blackduck"],
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {type: "text", text: "Black Duck scan", marks: [{type: "link", attrs: {href: $scan_url}}]}
            ]
          },
          {
            type: "paragraph",
            content: [
              {type: "text", text: "GitHub Actions run", marks: [{type: "link", attrs: {href: $run_url}}]}
            ]
          }
        ]
      }
    }
  }' > "$create_request"
jira_request POST '/rest/api/3/issue' "$create_response" "$create_request"

issue_key=$(jq -er '.key' "$create_response")
move_to_active_sprint "$issue_key"

echo "Created ${JIRA_BASE_URL%/}/browse/${issue_key} in sprint ${active_sprints[0]}"
echo "issue_key=${issue_key}" >> "$GITHUB_OUTPUT"
