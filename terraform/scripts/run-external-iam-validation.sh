#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TERRAFORM_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
APP_DIR=$(cd "${TERRAFORM_DIR}/../app" && pwd)
PREFLIGHT_SCRIPT="${SCRIPT_DIR}/preflight-external-iam.sh"

TFVARS_FILE=""
BACKEND_CONFIG=""
APPLY_CHANGES=0
DESTROY_AFTER=0

usage() {
  cat <<'EOF'
Usage: run-external-iam-validation.sh --tfvars <path> --backend-config <path> [--apply] [--destroy-after]

Default mode:
- runs preflight checks
- runs terraform init, validate, and plan

Apply mode:
- bootstraps the ECR repository for the disposable validation environment
- builds and pushes a linux/amd64 app image
- runs terraform apply
- waits for ECS to stabilize and checks the ALB health endpoint

Use --destroy-after with --apply to tear the disposable environment down at the end.
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
    --apply)
      APPLY_CHANGES=1
      shift
      ;;
    --destroy-after)
      DESTROY_AFTER=1
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

if [[ -z "${TFVARS_FILE}" || -z "${BACKEND_CONFIG}" ]]; then
  usage >&2
  exit 1
fi

if [[ "${DESTROY_AFTER}" -eq 1 && "${APPLY_CHANGES}" -ne 1 ]]; then
  echo "--destroy-after requires --apply" >&2
  exit 1
fi

require_bin aws
require_bin terraform
require_bin curl

if [[ "${APPLY_CHANGES}" -eq 1 ]]; then
  require_bin docker
fi

if [[ ! -x "${PREFLIGHT_SCRIPT}" ]]; then
  echo "Preflight script is not executable: ${PREFLIGHT_SCRIPT}" >&2
  exit 1
fi

preflight_args=(--tfvars "${TFVARS_FILE}" --backend-config "${BACKEND_CONFIG}")
if [[ "${APPLY_CHANGES}" -eq 1 ]]; then
  preflight_args+=(--require-docker)
fi

"${PREFLIGHT_SCRIPT}" "${preflight_args[@]}"

aws_profile=$(read_assignment "${TFVARS_FILE}" "aws_profile")
aws_region=$(read_assignment "${TFVARS_FILE}" "aws_region")
project=$(read_assignment "${TFVARS_FILE}" "project")
environment=$(read_assignment "${TFVARS_FILE}" "environment")
app_image_tag=$(read_assignment "${TFVARS_FILE}" "app_image_tag")

account_id=$(aws sts get-caller-identity \
  --profile "${aws_profile}" \
  --region "${aws_region}" \
  --query 'Account' \
  --output text)

resource_prefix=$(printf '%s-%s' "${project}" "${environment}" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
repository_name="${resource_prefix}/app"
repository_url="${account_id}.dkr.ecr.${aws_region}.amazonaws.com/${repository_name}"
plan_file=$(mktemp "${TMPDIR:-/tmp}/external-iam-validation-plan.XXXXXX")

terraform -chdir="${TERRAFORM_DIR}" init -reconfigure -backend-config="${BACKEND_CONFIG}"
terraform -chdir="${TERRAFORM_DIR}" validate
terraform -chdir="${TERRAFORM_DIR}" plan -var-file="${TFVARS_FILE}" -out="${plan_file}"

echo "Saved plan to ${plan_file}"

if [[ "${APPLY_CHANGES}" -ne 1 ]]; then
  exit 0
fi

terraform -chdir="${TERRAFORM_DIR}" apply \
  -var-file="${TFVARS_FILE}" \
  -target=module.compute.aws_ecr_repository.this \
  -target=module.compute.aws_ecr_lifecycle_policy.this \
  -auto-approve

docker buildx build \
  --platform linux/amd64 \
  --push \
  -t "${repository_url}:${app_image_tag}" \
  "${APP_DIR}"

terraform -chdir="${TERRAFORM_DIR}" apply \
  -var-file="${TFVARS_FILE}" \
  -auto-approve

cluster_name=$(terraform -chdir="${TERRAFORM_DIR}" output -raw ecs_cluster_name)
web_service_name=$(terraform -chdir="${TERRAFORM_DIR}" output -raw ecs_service_name)
worker_service_name=$(terraform -chdir="${TERRAFORM_DIR}" output -raw ecs_worker_service_name)
alb_dns_name=$(terraform -chdir="${TERRAFORM_DIR}" output -raw alb_dns_name)

aws ecs wait services-stable \
  --profile "${aws_profile}" \
  --region "${aws_region}" \
  --cluster "${cluster_name}" \
  --services "${web_service_name}" "${worker_service_name}"

curl -fsS "http://${alb_dns_name}/health" >/dev/null
echo "Verified ALB health endpoint at http://${alb_dns_name}/health"

if [[ "${DESTROY_AFTER}" -eq 1 ]]; then
  terraform -chdir="${TERRAFORM_DIR}" destroy \
    -var-file="${TFVARS_FILE}" \
    -auto-approve
fi
