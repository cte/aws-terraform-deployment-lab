#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TERRAFORM_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)

TFVARS_FILE=""
BACKEND_CONFIG=""
REQUIRE_DOCKER=0

usage() {
  cat <<'EOF'
Usage: preflight-external-iam.sh --tfvars <path> [--backend-config <path>] [--require-docker]

Checks that an externally managed IAM validation run has the prerequisites this Terraform stack expects:
- create_iam_roles = false
- AWS credentials are valid
- backend state bucket is reachable
- pre-created IAM roles exist with the expected trust principals
- docker buildx is available when a deploy run will build and push an image
EOF
}

require_bin() {
  local bin="$1"
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "Missing required binary: ${bin}" >&2
    exit 1
  fi
}

read_assignment() {
  local file="$1"
  local key="$2"

  awk -F= -v key="${key}" '
    $0 !~ /^[[:space:]]*#/ && $1 ~ "^[[:space:]]*" key "[[:space:]]*$" {
      value = $2
      sub(/^[[:space:]]*/, "", value)
      sub(/[[:space:]]*$/, "", value)
      gsub(/^"/, "", value)
      gsub(/"$/, "", value)
      print value
      exit
    }
  ' "${file}"
}

normalize_nullable_assignment() {
  local value="$1"
  if [[ "${value}" == "null" ]]; then
    echo ""
  else
    echo "${value}"
  fi
}

assert_non_empty() {
  local value="$1"
  local label="$2"
  if [[ -z "${value}" ]]; then
    echo "Missing ${label}" >&2
    exit 1
  fi
}

aws_with_auth() {
  local profile="$1"
  local region="$2"
  shift 2

  local args=()
  if [[ -n "${profile}" ]]; then
    args+=(--profile "${profile}")
  fi
  if [[ -n "${region}" ]]; then
    args+=(--region "${region}")
  fi

  aws "${args[@]}" "$@"
}

check_role() {
  local profile="$1"
  local region="$2"
  local role_name="$3"
  local principal="$4"

  local actual_principals
  actual_principals=$(aws_with_auth "${profile}" "${region}" iam get-role \
    --role-name "${role_name}" \
    --query 'Role.AssumeRolePolicyDocument.Statement[].Principal.Service' \
    --output text)

  if [[ "${actual_principals}" != *"${principal}"* ]]; then
    echo "Role ${role_name} does not trust ${principal}. Found: ${actual_principals}" >&2
    exit 1
  fi

  echo "Verified role ${role_name} trusts ${principal}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tfvars)
      TFVARS_FILE="$2"
      shift 2
      ;;
    --backend-config)
      BACKEND_CONFIG="$2"
      shift 2
      ;;
    --require-docker)
      REQUIRE_DOCKER=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

assert_non_empty "${TFVARS_FILE}" "--tfvars"

require_bin aws
require_bin terraform

if [[ "${REQUIRE_DOCKER}" -eq 1 ]]; then
  require_bin docker
fi

if [[ ! -f "${TFVARS_FILE}" ]]; then
  echo "tfvars file not found: ${TFVARS_FILE}" >&2
  exit 1
fi

if [[ -n "${BACKEND_CONFIG}" && ! -f "${BACKEND_CONFIG}" ]]; then
  echo "backend config not found: ${BACKEND_CONFIG}" >&2
  exit 1
fi

aws_profile=$(read_assignment "${TFVARS_FILE}" "aws_profile")
aws_region=$(read_assignment "${TFVARS_FILE}" "aws_region")
project=$(read_assignment "${TFVARS_FILE}" "project")
create_iam_roles=$(read_assignment "${TFVARS_FILE}" "create_iam_roles")
ecs_execution_role_name=$(read_assignment "${TFVARS_FILE}" "ecs_execution_role_name")
ecs_task_role_name=$(read_assignment "${TFVARS_FILE}" "ecs_task_role_name")
rds_monitoring_role_name=$(read_assignment "${TFVARS_FILE}" "rds_monitoring_role_name")

aws_profile=$(normalize_nullable_assignment "${aws_profile}")
ecs_execution_role_name=$(normalize_nullable_assignment "${ecs_execution_role_name}")
ecs_task_role_name=$(normalize_nullable_assignment "${ecs_task_role_name}")
rds_monitoring_role_name=$(normalize_nullable_assignment "${rds_monitoring_role_name}")

assert_non_empty "${aws_region}" "aws_region in ${TFVARS_FILE}"
assert_non_empty "${project}" "project in ${TFVARS_FILE}"
assert_non_empty "${create_iam_roles}" "create_iam_roles in ${TFVARS_FILE}"

if [[ "${create_iam_roles}" != "false" ]]; then
  echo "External-IAM validation requires create_iam_roles = false" >&2
  exit 1
fi

if [[ -z "${ecs_execution_role_name}" ]]; then
  ecs_execution_role_name="${project}-ecs-execution-role"
fi

if [[ -z "${ecs_task_role_name}" ]]; then
  ecs_task_role_name="${project}-ecs-task-role"
fi

if [[ -z "${rds_monitoring_role_name}" ]]; then
  rds_monitoring_role_name="${project}-rds-monitoring-role"
fi

aws_with_auth "${aws_profile}" "${aws_region}" sts get-caller-identity >/dev/null
if [[ -n "${aws_profile}" ]]; then
  echo "Verified AWS credentials for profile ${aws_profile}"
else
  echo "Verified AWS credentials from the default AWS credential chain"
fi

if [[ -n "${BACKEND_CONFIG}" ]]; then
  backend_bucket=$(read_assignment "${BACKEND_CONFIG}" "bucket")
  backend_region=$(read_assignment "${BACKEND_CONFIG}" "region")
  backend_profile=$(read_assignment "${BACKEND_CONFIG}" "profile")
  backend_profile=$(normalize_nullable_assignment "${backend_profile}")

  assert_non_empty "${backend_bucket}" "bucket in ${BACKEND_CONFIG}"

  if [[ -z "${backend_region}" ]]; then
    backend_region="${aws_region}"
  fi

  if [[ -z "${backend_profile}" ]]; then
    backend_profile="${aws_profile}"
  fi

  aws_with_auth "${backend_profile}" "${backend_region}" s3api head-bucket \
    --bucket "${backend_bucket}" >/dev/null

  echo "Verified backend bucket ${backend_bucket}"
fi

check_role "${aws_profile}" "${aws_region}" "${ecs_execution_role_name}" "ecs-tasks.amazonaws.com"
check_role "${aws_profile}" "${aws_region}" "${ecs_task_role_name}" "ecs-tasks.amazonaws.com"

rds_role_exists=0
if aws_with_auth "${aws_profile}" "${aws_region}" iam get-role \
  --role-name "${rds_monitoring_role_name}" \
  >/dev/null 2>&1; then
  rds_role_exists=1
fi

if [[ "${rds_role_exists}" -eq 1 ]]; then
  check_role "${aws_profile}" "${aws_region}" "${rds_monitoring_role_name}" "monitoring.rds.amazonaws.com"
else
  echo "RDS monitoring role ${rds_monitoring_role_name} not present; continuing because enhanced monitoring is disabled"
fi

if [[ "${REQUIRE_DOCKER}" -eq 1 ]]; then
  docker buildx version >/dev/null
  echo "Verified docker buildx is available"
fi

echo "External-IAM preflight checks passed for ${TFVARS_FILE}"
