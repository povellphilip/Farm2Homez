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
  echo "Recent app server launches (Auto Scaling activity):"
  aws autoscaling describe-scaling-activities --auto-scaling-group-name "farm2homez-app-$STACK" --max-items 3 \
    --query 'Activities[].[StatusCode, StatusMessage || Description]' --output table 2>/dev/null || true
  if aws s3 cp "s3://$ARTIFACTS/logs/bootstrap-latest.log" /tmp/farm2homez-bootstrap.log --only-show-errors 2>/dev/null; then
    echo
    echo "Last lines of the app server setup log (full log: s3://$ARTIFACTS/logs/bootstrap-latest.log):"
    tail -40 /tmp/farm2homez-bootstrap.log
  else
    echo "No app server setup log was uploaded - the server may never have started."
  fi
  echo
  echo "The failed resources are kept so you can inspect them. Re-running this script cleans them up first."
}
delete_stack() {
  # CloudFormation cannot delete non-empty buckets, so empty them first
  for bucket in SiteBucket MediaBucket; do
    name=$(aws cloudformation describe-stack-resource --stack-name "$STACK" --logical-resource-id "$bucket" \
      --query StackResourceDetail.PhysicalResourceId --output text 2>/dev/null || true)
    [[ -n "$name" && "$name" != None ]] && aws s3 rm "s3://$name" --recursive --only-show-errors 2>/dev/null || true
  done
  aws cloudformation delete-stack --stack-name "$STACK"
  aws cloudformation wait stack-delete-complete --stack-name "$STACK"
}

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ARTIFACTS="farm2homez-artifacts-$ACCOUNT"

# ------------------------------------------------------------------ previous runs
case "$(stack_status)" in
  *_IN_PROGRESS)
    step "A deployment is already running - waiting for it to finish"
    while [[ "$(stack_status)" == *_IN_PROGRESS ]]; do sleep 20; done ;;
esac
RETRY_IN_PLACE=false
case "$(stack_status)" in
  CREATE_FAILED|UPDATE_FAILED)
    # Resources that already work (database, CloudFront...) are kept; only the failed part is retried
    RETRY_IN_PLACE=true ;;
  ROLLBACK_COMPLETE|ROLLBACK_FAILED|DELETE_FAILED)
    step "Removing the failed stack from a previous attempt (a few minutes)"
    delete_stack ;;
esac

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
aws s3 rm "s3://$ARTIFACTS/logs/bootstrap-latest.log" --only-show-errors 2>/dev/null || true

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

run_deploy() {
  aws cloudformation deploy \
    --template-file "$ROOT/infra/farm2homez.yaml" \
    --stack-name "$STACK" \
    --parameter-overrides "${PARAMS[@]}" \
    --no-fail-on-empty-changeset "$@"
}
if [[ "$(stack_status)" == NONE ]]; then
  step "Creating the AWS infrastructure - this takes about 20 minutes (database + CloudFront are the slow parts)"
elif $RETRY_IN_PLACE; then
  step "Retrying the previous deployment from where it failed (about 10 minutes)"
else
  step "Updating the AWS infrastructure and rolling out the new backend (5-15 minutes)"
fi
echo "Watch progress: CloudFormation console -> Stacks -> $STACK -> Events"
# --disable-rollback keeps resources on failure so the cause can be inspected and the next run can retry
if ! run_deploy --disable-rollback; then
  if $RETRY_IN_PLACE && [[ "$(stack_status)" == CREATE_FAILED ]]; then
    step "The failed stack could not be retried in place - recreating it (about 25 minutes)"
    delete_stack
    run_deploy --disable-rollback || { show_failures; exit 1; }
  else
    show_failures
    exit 1
  fi
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
