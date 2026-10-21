#!/usr/bin/env bash
# Deploys Farm2Homez to AWS. Run it from AWS CloudShell (us-east-1):
#
#   git clone -b aws-deploy https://github.com/povellphilip/Farm2Homez.git && bash Farm2Homez/infra/deploy.sh
#
# Safe to re-run: it updates the existing stack, uploads new code and refreshes the website.
# Optional environment variables:
#   ALERT_EMAIL     email address for CloudWatch alarm notifications (confirm the SNS email)
#   SMTP_USER       Gmail address used to send OTP emails (otherwise OTPs appear in CloudWatch Logs)
#   SMTP_PASSWORD   Gmail app password for SMTP_USER
#   ADMIN_EMAIL     where contact-form notifications go
#   INSTANCE_TYPE   t3.micro | t3.small (default) | t3.medium
#   STACK_NAME      default: farm2homez
#   PLAIN_PARAMS=1  store secrets as plain String parameters (only if SecureString/KMS is blocked)
set -euo pipefail

REGION=us-east-1
STACK=${STACK_NAME:-farm2homez}
SSM_PREFIX=/farm2homez
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export AWS_DEFAULT_REGION=$REGION AWS_PAGER=""

step() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
stack_status() { aws cloudformation describe-stacks --stack-name "$STACK" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo NONE; }
output() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
show_failures() {
  echo
  echo "Deployment failed. First errors reported by CloudFormation:"
  aws cloudformation describe-stack-events --stack-name "$STACK" \
    --query "reverse(StackEvents[?contains(ResourceStatus, 'FAILED')])[:6].[LogicalResourceId, ResourceStatusReason]" \
    --output table || true
}

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ARTIFACTS="farm2homez-artifacts-$ACCOUNT"

# ------------------------------------------------------------------ previous runs
case "$(stack_status)" in
  *_IN_PROGRESS)
    step "A deployment is already running - waiting for it to finish"
    aws cloudformation wait stack-create-complete --stack-name "$STACK" 2>/dev/null \
      || aws cloudformation wait stack-update-complete --stack-name "$STACK" 2>/dev/null || true ;;
esac
if [[ "$(stack_status)" == ROLLBACK_COMPLETE || "$(stack_status)" == ROLLBACK_FAILED ]]; then
  step "Removing the failed stack from a previous attempt"
  aws cloudformation delete-stack --stack-name "$STACK"
  aws cloudformation wait stack-delete-complete --stack-name "$STACK"
fi

# ------------------------------------------------------------------ secrets
step "Storing app secrets in SSM Parameter Store ($SSM_PREFIX)"
PARAM_TYPE=$([[ -n "${PLAIN_PARAMS:-}" ]] && echo String || echo SecureString)
put_param() {
  aws ssm put-parameter --name "$SSM_PREFIX/$1" --type "$PARAM_TYPE" --value "$2" --overwrite >/dev/null 2>&1 && return
  # Some sandboxes block KMS; fall back to a plain (still IAM-protected) parameter
  PARAM_TYPE=String
  aws ssm put-parameter --name "$SSM_PREFIX/$1" --type String --value "$2" --overwrite >/dev/null
}
ensure_param() {
  aws ssm get-parameter --name "$SSM_PREFIX/$1" >/dev/null 2>&1 || put_param "$1" "$(openssl rand -hex "$2")"
}
ensure_param secret-key 32
ensure_param jwt-secret 32
ensure_param db-password 16
[[ -n "${SMTP_USER:-}" ]] && put_param email-user "$SMTP_USER"
[[ -n "${SMTP_PASSWORD:-}" ]] && put_param email-password "$SMTP_PASSWORD"
[[ -n "${ADMIN_EMAIL:-}" ]] && put_param admin-email "$ADMIN_EMAIL"
DB_PASSWORD=$(aws ssm get-parameter --name "$SSM_PREFIX/db-password" --with-decryption --query Parameter.Value --output text)

# ------------------------------------------------------------------ backend package
step "Packaging the Django backend"
aws s3api head-bucket --bucket "$ARTIFACTS" 2>/dev/null || aws s3api create-bucket --bucket "$ARTIFACTS" >/dev/null
VERSION=$(date -u +%Y%m%d%H%M%S)
PACKAGE_KEY="backend/backend-$VERSION.tar.gz"
tar -czf /tmp/farm2homez-backend.tar.gz -C "$ROOT/backend" \
  --exclude=.venv --exclude=__pycache__ --exclude=.env --exclude=db.sqlite3 \
  --exclude=staticfiles --exclude=media --exclude=logs .
aws s3 cp /tmp/farm2homez-backend.tar.gz "s3://$ARTIFACTS/$PACKAGE_KEY" --only-show-errors

# ------------------------------------------------------------------ infrastructure
CLOUDFRONT_PREFIX_LIST=$(aws ec2 describe-managed-prefix-lists \
  --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
  --query 'PrefixLists[0].PrefixListId' --output text)

PG_VERSION=$(aws rds describe-db-engine-versions --engine postgres --db-parameter-group-family postgres17   --default-only --query 'DBEngineVersions[0].EngineVersion' --output text 2>/dev/null || true)

PARAMS=(
  "ArtifactBucket=$ARTIFACTS"
  "BackendPackageKey=$PACKAGE_KEY"
  "BackendVersion=$VERSION"
  "CloudFrontPrefixListId=$CLOUDFRONT_PREFIX_LIST"
  "DBPassword=$DB_PASSWORD"
  "InstanceType=${INSTANCE_TYPE:-t3.small}"
)
[[ -n "${ALERT_EMAIL:-}" ]] && PARAMS+=("AlertEmail=$ALERT_EMAIL")
[[ "$PG_VERSION" == 17.* ]] && PARAMS+=("DBEngineVersion=$PG_VERSION")

if [[ "$(stack_status)" == NONE ]]; then
  step "Creating the AWS infrastructure - this takes about 20 minutes (database + CloudFront are the slow parts)"
else
  step "Updating the AWS infrastructure and rolling out the new backend (5-15 minutes)"
fi
echo "Watch progress: CloudFormation console -> Stacks -> $STACK -> Events"
if ! aws cloudformation deploy \
    --template-file "$ROOT/infra/farm2homez.yaml" \
    --stack-name "$STACK" \
    --parameter-overrides "${PARAMS[@]}" \
    --no-fail-on-empty-changeset; then
  show_failures
  exit 1
fi

# ------------------------------------------------------------------ frontend
step "Building the React frontend"
SITE_BUCKET=$(output SiteBucketName)
DISTRIBUTION_ID=$(output DistributionId)
cd "$ROOT/frontend"
npm ci --no-audit --no-fund --loglevel=error
VITE_API_BASE_URL=/api npm run build

step "Uploading the website to S3"
aws s3 sync dist "s3://$SITE_BUCKET" --delete --exclude index.html \
  --cache-control "public,max-age=31536000,immutable" --only-show-errors
aws s3 cp dist/index.html "s3://$SITE_BUCKET/index.html" --cache-control "no-cache" --only-show-errors
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" \
  --query Invalidation.Id --output text >/dev/null

# ------------------------------------------------------------------ done
URL=$(output WebsiteURL)
cat <<EOF

$(printf '\033[1;32m')Farm2Homez is live!$(printf '\033[0m')

  Website     $URL
  API docs    $(output ApiDocsURL)
  Admin       $(output AdminURL)
  Dashboard   $(output DashboardURL)

  Demo logins:  admin@farm2homez.com / Admin@12345
                seller@farm2homez.com / Seller@12345
                customer@farm2homez.com / Customer@12345

  Smoke test:   curl $URL/api/health/
EOF
if [[ -z "${SMTP_USER:-}" ]] && ! aws ssm get-parameter --name "$SSM_PREFIX/email-user" >/dev/null 2>&1; then
  echo "  OTP codes:    no SMTP configured, so sign-up codes are in CloudWatch Logs -> $(output AppLogGroupName) -> */app"
fi
