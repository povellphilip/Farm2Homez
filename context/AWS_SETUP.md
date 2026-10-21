# Farm2Home on AWS — what to set up, how, and why

This guide covers the AWS products Farm2Home uses, what each one does for the project, and how to set them up from an empty AWS account to a live site. Almost everything is created by the Terraform code in `infra/terraform/`, so most steps are commands rather than console clicking.

> **Nothing has been created in AWS yet.** The Terraform code has been validated (`terraform validate`), but it has never been applied to a real account, so expect to fix small issues on the first run. Running `terraform apply` creates billable resources: read [section 7 (costs)](#7-costs) first.

**Contents**

1. [The architecture in one picture](#1-the-architecture-in-one-picture)
2. [AWS products and their purpose](#2-aws-products-and-their-purpose)
3. [Before you start](#3-before-you-start)
4. [Step-by-step setup](#4-step-by-step-setup)
5. [Deploying updates](#5-deploying-updates)
6. [Operating the site](#6-operating-the-site)
7. [Costs](#7-costs)
8. [Turning it all off](#8-turning-it-all-off)
9. [Security checklist and remaining risks](#9-security-checklist-and-remaining-risks)

---

## 1. The architecture in one picture

```
                       Customers, farmers, admins (browsers)
                                      │  https://your-domain
                                      ▼
   Route 53 (DNS, optional) ──► CloudFront  ── certificate from ACM (us-east-1)
                                │  security headers, caching, one domain for everything
         ┌──────────────────────┼──────────────────────────┐
         │ /  (website)         │ /media/*  (photos)        │ /api/*  /django-admin/*  /static/*
         ▼                      ▼                           ▼
   S3: frontend bucket    S3: media bucket           App Runner: Django API container
   (private)              (private)                  (image from ECR, secrets from SSM)
                               ▲                            │ VPC connector
                               │ presigned upload           ▼
                          producer's browser         Private subnets ──► RDS PostgreSQL
                                                            │
                                                            └─ NAT gateway ──► SES (email)

   Around it: CloudWatch (logs, alarms) · SNS (alert emails) · AWS Budgets (cost alerts)
              IAM (roles, GitHub deploy role) · Systems Manager Parameter Store (secrets)
```

Everything lives in **ap-south-1 (Mumbai)**, closest to Indian customers. Only the CloudFront certificate and CloudFront's metrics are in us-east-1, because CloudFront requires that.

---

## 2. AWS products and their purpose

| Product | What it does for Farm2Home | Created by |
| --- | --- | --- |
| **CloudFront** | The single front door. Serves the website, product photos and the API on one HTTPS domain, caches static files close to visitors, adds security headers, and adds a secret header so the API only accepts traffic that came through it. | Terraform (`cdn.tf`) |
| **S3 (frontend bucket)** | Stores the built React website (`index.html` and hashed JS/CSS). Private; only CloudFront can read it. | Terraform (`storage.tf`) |
| **S3 (media bucket)** | Stores product photos under `media/` (served at `/media/*`). Producers' browsers upload directly into `uploads/` with a 5-minute signed permission; the API checks, re-encodes and moves each photo, and a lifecycle rule deletes leftovers after a day. Versioning keeps deleted photos for 30 days. | Terraform (`storage.tf`) |
| **App Runner** | Runs the Django API container: HTTPS, load balancing, health checks, automatic restarts, autoscaling (1–2 instances by default) and log shipping, without managing servers. Redeploys automatically when a new image is pushed. | Terraform (`app.tf`) |
| **ECR** (Elastic Container Registry) | Private registry for the API's Docker images; scans images for known vulnerabilities and keeps the last 15. | Terraform (`app.tf`) |
| **RDS for PostgreSQL** | The database: orders, users, products and everything else. Private subnets only, encrypted, SSL enforced, daily backups kept 7 days with point-in-time restore, deletion protection. | Terraform (`database.tf`) |
| **VPC** (subnets, security groups, NAT gateway, S3 endpoint) | Private network so the database is never on the internet. The API reaches it through an App Runner VPC connector. The NAT gateway gives the API outbound internet access for sending email. A free S3 gateway endpoint keeps photo traffic inside AWS. | Terraform (`network.tf`) |
| **Systems Manager Parameter Store** | Encrypted storage for secrets: Django secret key, database URL, CloudFront secret, SES SMTP credentials, first-admin password. App Runner injects them as environment variables at start-up; they never appear in code or images. | Terraform (`secrets.tf`); you paste the SES credentials |
| **SES** (Simple Email Service) | Sends verification codes, password resets, order and status updates, and inquiry notifications, over SMTP. | Terraform verifies the sender; you request production access and create SMTP credentials |
| **ACM** (Certificate Manager) | Free HTTPS certificate for your custom domain. Must be in us-east-1 for CloudFront. | Terraform (`dns_email.tf`), only with a domain |
| **Route 53** | DNS for your domain: points it at CloudFront, validates the certificate, and publishes SES's DKIM records so email isn't marked as spam. | Terraform records; you create or buy the domain and hosted zone |
| **CloudWatch** | Logs from the API (and slow-query logs from PostgreSQL), metrics, and alarms: API errors, API latency, database CPU, memory and storage, CDN error rate. | App Runner and RDS send logs; Terraform creates alarms (`monitoring.tf`) |
| **SNS** | Emails you when an alarm fires. | Terraform |
| **AWS Budgets** | Emails you when the month's forecast passes 80% of your budget or actual spend passes 100%. | Terraform |
| **IAM** | Least-privilege roles: App Runner pulling images, the running API (only its own bucket folders and secrets), and the GitHub deploy role (keyless OIDC, main branch only). | Terraform (`app.tf`, `ci.tf`) |
| **S3 + DynamoDB for Terraform state** | Stores Terraform's record of what it created, with locking so two people can't apply at once. | You, once (step 2) |

Not used, on purpose: EC2 servers to patch, ElastiCache/Redis (rate limiting uses the database), Elastic Load Balancer (App Runner includes one), and WAF (optional upgrade, see section 9).

---

## 3. Before you start

You need:

1. **An AWS account.** New accounts created after July 2025 get a free plan with credits. Check the current terms at https://aws.amazon.com/free. Secure the root user with MFA, then create a separate admin identity for daily use (IAM Identity Center, or an IAM user with MFA). Don't use the root user for any of the steps below.
2. **Tools on your computer:**
   - AWS CLI v2: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
   - Terraform 1.6 or newer (tested with 1.9.8): https://developer.hashicorp.com/terraform/install
   - Docker Desktop: https://www.docker.com/products/docker-desktop/ (to build the API image)
   - Node.js 22 and Git (already needed for local development)
3. **Signed in on the CLI** with your admin identity. Check it with:
   ```
   aws configure sso            # or: aws configure  (access keys for an admin IAM user)
   aws sts get-caller-identity  # shows your account ID; note it down
   ```
4. **Optional: a domain name.** You can start on the free `https://dxxxx.cloudfront.net` address and add a domain later (step 9).

Set two shell variables used below. In PowerShell use `$env:ACCOUNT_ID = "..."`, and write `$env:ACCOUNT_ID` instead of `$ACCOUNT_ID`.

```
ACCOUNT_ID=123456789012        # from get-caller-identity
REGION=ap-south-1
```

---

## 4. Step-by-step setup

### Step 1 — protect yourself from surprise bills (2 minutes)

Terraform creates a budget alert, but create a quick one in the console first so you're covered from minute one: **Billing → Budgets → Create budget → "Monthly cost budget"**, set your limit and email. Also enable **Billing → Billing preferences → Receive free tier usage alerts**.

### Step 2 — create the Terraform state storage (once)

```
aws s3api create-bucket --bucket farm2home-terraform-state-$ACCOUNT_ID --region $REGION --create-bucket-configuration LocationConstraint=$REGION
aws s3api put-bucket-versioning --bucket farm2home-terraform-state-$ACCOUNT_ID --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket farm2home-terraform-state-$ACCOUNT_ID --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket farm2home-terraform-state-$ACCOUNT_ID --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws dynamodb create-table --table-name farm2home-terraform-locks --region $REGION --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST
```

> **The state file contains secrets** (the generated database password and Django key). Keep this bucket private, and give access only to people who run Terraform.

### Step 3 — configure Terraform

```
cd infra/terraform
cp backend.tf.example backend.tf                  # then put your account ID in the bucket name
cp terraform.tfvars.example terraform.tfvars      # then fill it in
```

In `terraform.tfvars`, set at least `alarm_email`, `from_email` and `admin_notification_email`. Leave `domain_name` empty for now. The cost levers (`db_instance_class`, `db_multi_az`, `enable_nat_gateway`) are explained in [section 7](#7-costs).

```
terraform init
```

### Step 4 — create the image registry and push the first API image

App Runner needs an image to exist before it can start, so this step creates just the registry first:

```
terraform apply -target=aws_ecr_repository.api
REPO=$(terraform output -raw ecr_repository_url)    # PowerShell: $env:REPO = terraform output -raw ecr_repository_url

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
docker build -t $REPO:latest ../../backend
docker push $REPO:latest
```

### Step 5 — create everything else

```
terraform plan      # review: several dozen resources to create, nothing to destroy
terraform apply
```

This takes about 15–25 minutes. CloudFront and RDS are the slow parts. When it finishes:

```
terraform output
```

Note `site_url`, `frontend_bucket`, `cloudfront_distribution_id`, `apprunner_service_arn` and `ssm_parameters`.

**Confirm the alert emails now.** AWS sends two "Subscription confirmation" emails, one per SNS topic. Alarms reach you only after you click both links.

### Step 6 — set up email (SES)

1. **Verify the sender.** Without a domain, Terraform registered `from_email` as an identity, and AWS emails that address a verification link: click it. With a domain, the DKIM records are created automatically.
2. **Leave the sandbox.** New SES accounts can only email verified addresses. In the console: **SES → Account dashboard → Request production access**. Describe the use (transactional email: verification codes, order updates; no marketing). Approval usually takes about a day.
3. **Create SMTP credentials.** In **SES → SMTP settings → Create SMTP credentials**, AWS creates an IAM user and shows an SMTP user name and password once. Store them in the parameters Terraform created:
   ```
   aws ssm put-parameter --name /farm2home/prod/EMAIL_HOST_USER --type SecureString --overwrite --value "<smtp user name>"
   aws ssm put-parameter --name /farm2home/prod/EMAIL_HOST_PASSWORD --type SecureString --overwrite --value "<smtp password>"
   ```
4. Restart the API so it reads the new values:
   ```
   aws apprunner start-deployment --service-arn $(terraform output -raw apprunner_service_arn)
   ```

### Step 7 — upload the website

```
cd ../../frontend
npm ci
VITE_SITE_URL=<site_url from terraform output> npm run build     # PowerShell: $env:VITE_SITE_URL="..."; npm run build

aws s3 sync dist/assets s3://<frontend_bucket>/assets --cache-control "public,max-age=31536000,immutable" --delete
aws s3 sync dist s3://<frontend_bucket> --exclude "assets/*" --exclude "*.map" --cache-control "public,max-age=0,must-revalidate" --delete
aws cloudfront create-invalidation --distribution-id <cloudfront_distribution_id> --paths "/index.html" "/"
```

Open the `site_url`. The site should load with an empty marketplace (the five categories exist, but there are no farms yet).

### Step 8 — create the first administrator

App Runner has no shell, so the container can create the first admin on start-up:

```
aws ssm put-parameter --name /farm2home/prod/ADMIN_PASSWORD --type SecureString --overwrite --value "<a strong password>"
```

Set `bootstrap_admin_email = "you@example.com"` in `terraform.tfvars`, then run `terraform apply`. App Runner redeploys and creates the admin, and does nothing if the account already exists. Sign in at `<site_url>/admin/login`. Then **set `bootstrap_admin_email` back to `""`, apply again, and overwrite the ADMIN_PASSWORD parameter with a random value**.

> Never run `seed_demo` in production; it refuses to. Real farms register themselves at `/producer/register` and you verify them in the admin portal.

### Step 9 — add your own domain (optional, recommended)

1. Buy a domain in **Route 53 → Registered domains** (this creates the hosted zone), or use one you own: create a public hosted zone and point your registrar's name servers at it.
2. In `terraform.tfvars`, set `domain_name = "farm2home.in"` (your domain) and `route53_zone_id = "Z0123..."`.
3. `terraform apply`. Terraform requests the certificate, validates it, adds the domain to CloudFront, creates the DNS records and switches SES to domain verification with DKIM. Allow up to 30 minutes for DNS and certificate validation.
4. Rebuild and upload the website with `VITE_SITE_URL=https://your-domain` (step 7), and update the GitHub `SITE_URL` secret if you use the deploy workflow.

### Step 10 — automatic deployments from GitHub (optional, recommended)

1. Set `github_repository = "your-org/your-repo"` in `terraform.tfvars` and `terraform apply`. This creates a deploy role that only the repository's `main` branch can use, with no stored AWS keys.
2. In GitHub, create an environment called **production** (**Settings → Environments**; optionally require a reviewer). Add these **repository secrets** from `terraform output`:

   | Secret | Value |
   | --- | --- |
   | `AWS_DEPLOY_ROLE_ARN` | `github_deploy_role_arn` |
   | `AWS_REGION` | `ap-south-1` |
   | `ECR_REPOSITORY_URL` | `ecr_repository_url` |
   | `APPRUNNER_SERVICE_ARN` | `apprunner_service_arn` |
   | `FRONTEND_BUCKET` | `frontend_bucket` |
   | `CLOUDFRONT_DISTRIBUTION_ID` | `cloudfront_distribution_id` |
   | `SITE_URL` | `site_url` |

3. From now on, every push to `main` runs **CI** (tests on PostgreSQL, type checks, end-to-end and accessibility tests, Terraform validation). If CI passes, **Deploy** builds and pushes the API image (App Runner deploys it), waits for it, uploads the website, refreshes CloudFront and checks the live health endpoint.

### Step 11 — check that everything works

- [ ] `<site_url>/api/health/` returns `{"status": "ok", "database": "ok"}`
- [ ] The App Runner URL itself returns `forbidden_origin` for `/api/products/` (the API refuses traffic that didn't come through CloudFront)
- [ ] Register a shopper with a real email address: the code arrives (needs SES production access, or a verified recipient while in the sandbox)
- [ ] Register a farm, verify it in the admin portal, create a listing and **upload a photo** (this tests the presigned upload and the bucket's CORS rule), then publish it
- [ ] Place an order as the shopper; the farm receives an email; move it to delivered
- [ ] Open the browser console on a few pages and look for `Content-Security-Policy-Report-Only` warnings (see section 9)
- [ ] Both SNS subscriptions are confirmed, and the budget appears under **Billing → Budgets**

---

## 5. Deploying updates

| What changed | How it goes live |
| --- | --- |
| Backend code | Push to `main`: CI passes, then the image is pushed and App Runner deploys it with zero downtime. Migrations run automatically on start-up; a database lock stops two instances migrating at once. |
| Website | Same workflow: build, sync to S3, invalidate `index.html`. JS and CSS files have content hashes, so they're cached for a year safely. |
| Infrastructure | Edit `infra/terraform`, run `terraform plan`, review it, then `terraform apply`. CI only validates Terraform; it never applies it. |
| A secret | `aws ssm put-parameter --overwrite ...`, then `aws apprunner start-deployment --service-arn ...` |

Without GitHub Actions, repeat step 4's `docker build`/`docker push` (App Runner picks up `:latest` automatically) and step 7 for the website.

**Rolling back the API:** each image is also tagged with its commit SHA. Re-tag a known-good one as `latest`:

```
aws ecr batch-get-image --repository-name farm2home-prod-api --image-ids imageTag=<good-sha> --query 'images[0].imageManifest' --output text > manifest.json
aws ecr put-image --repository-name farm2home-prod-api --image-tag latest --image-manifest file://manifest.json
```

App Runner then deploys it. Note that rolling back code doesn't undo database migrations. Write migrations so the previous version still works, and restore a backup only as a last resort.

**Rolling back the website:** re-run the Deploy workflow for an older commit (**Actions → Deploy → Run workflow** on that commit), or build that commit locally and repeat step 7.

---

## 6. Operating the site

### Logs

- **API logs:** CloudWatch → Log groups → `/aws/apprunner/farm2home-prod-api/<id>/application` (JSON in production). Request logs come from gunicorn; errors include stack traces.
- **Database:** `/aws/rds/instance/farm2home-prod/postgresql` (includes queries slower than 1 second).
- **Set log retention once** (App Runner creates its groups without a limit):
  ```
  aws logs describe-log-groups --log-group-name-prefix /aws/apprunner/farm2home --query 'logGroups[].logGroupName'
  aws logs put-retention-policy --log-group-name <each name above> --retention-in-days 30
  ```
- **Audit trail of admin actions:** the admin portal's **Audit log** page.

### Backups and restore

- RDS takes **daily automatic backups (kept 7 days)** and supports **point-in-time restore** to any second in that window. Deletion protection is on, and deleting the database creates a final snapshot.
- **Take a manual snapshot before risky changes:** `aws rds create-db-snapshot --db-instance-identifier farm2home-prod --db-snapshot-identifier before-<change>`
- **Restore:** a restore always creates a *new* database instance:
  1. `aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier farm2home-prod --target-db-instance-identifier farm2home-prod-restored --restore-time <UTC time> --db-subnet-group-name farm2home-prod --vpc-security-group-ids <database security group id>`
  2. When it's available, update the `/farm2home/prod/DATABASE_URL` parameter to the new endpoint and run `aws apprunner start-deployment`.
  3. Once you're happy, bring Terraform back in line: either rename the instances so the restored one takes the original name, or import it into the state. Ask someone experienced with Terraform before doing this on live data.
- **Product photos:** the media bucket keeps deleted or overwritten versions for 30 days.
- **Practise a restore once** before you depend on it.

### Scaling

| Need | Change |
| --- | --- |
| More traffic | Raise `app_max_instances`, or `app_cpu`/`app_memory` (for example `"0.5 vCPU"`, `"2 GB"`) |
| Database busy (CPU alarm) | `db_instance_class = "db.t4g.small"` (brief restart during the maintenance window, or immediately with `apply_immediately`) |
| No downtime if a data centre fails | `db_multi_az = true` (roughly doubles the database cost) |
| Database storage | Grows automatically up to 5× the starting size; an alarm fires below 2 GB free |

### Routine checks (monthly)

- Billing → Cost Explorer: costs as expected?
- ECR → image scan findings for the latest image
- RDS → pending maintenance and minor version upgrades
- `npm audit` / `pip-audit` and update dependencies; CI proves nothing broke

---

## 7. Costs

Estimates for **ap-south-1, light traffic** (a few thousand visits a month), at list prices as best known when this was written. **Prices change**, so check them in the AWS Pricing Calculator (https://calculator.aws) before deciding.

| Item | Default setting | Approx. USD/month |
| --- | --- | --- |
| App Runner | 1 instance, 0.25 vCPU / 1 GB, mostly idle | 7 – 15 |
| RDS PostgreSQL | db.t4g.micro, single-AZ, 20 GB gp3 | 15 – 18 |
| NAT gateway | 1 gateway + public IP, little data | 40 – 45 |
| CloudFront | first 1 TB and 10 M requests/month are always free | 0 – 2 |
| S3 (website + photos) | a few GB | < 1 |
| ECR | ~15 images | < 1 |
| CloudWatch | logs, 8 alarms | 2 – 5 |
| Parameter Store (standard), ACM certificate, Budgets (2 free), IAM | — | 0 |
| SES | $0.10 per 1,000 emails | < 1 |
| Route 53 | hosted zone + domain | 0.50 + domain (~$10–15/year) |
| **Total** | | **≈ 65 – 85** |

**The biggest lever is the NAT gateway (more than half the bill).** It exists only so the API can reach SES to send email. Options:

1. **Keep it** (default): simplest and fully managed.
2. **`enable_nat_gateway = false`**: saves ~$40 a month, but **the API can't send email**, so new users can't verify their accounts. Only suitable for a private demo.
3. **Cheaper alternatives**, not implemented here; check them in your region first:
   - **An SES SMTP VPC interface endpoint** (`com.amazonaws.ap-south-1.email-smtp`), which typically costs about half as much as a NAT gateway.
   - **A small NAT instance** (for example the community "fck-nat" image on a t4g.nano, about $3–5 a month), but you then own patching it.

**Free-plan credits** (up to $200 for new accounts) would cover roughly the first 2–3 months at the default settings.

**With real customers, expect to add:**
- multi-AZ database, about +$15–18
- a second always-on App Runner instance, about +$7–15
- AWS WAF, about $10 and up

---

## 8. Turning it all off

```
cd infra/terraform
```

1. Set `deletion_protection = false` on `aws_db_instance.main` in `database.tf`, then run `terraform apply`.
2. Empty the two app buckets, including old versions: in the S3 console use **Empty**.
3. `terraform destroy`

RDS takes a final snapshot (`farm2home-prod-final`), which keeps costing a little until you delete it. The Terraform state bucket and lock table remain until you delete them by hand. Check **Billing → Bills** the following month to confirm charges have stopped.

---

## 9. Security checklist and remaining risks

**Already in place:**
- private database with SSL and encryption
- private, encrypted buckets readable only by CloudFront
- secrets in Parameter Store, never in code or images
- least-privilege IAM roles
- keyless GitHub deployments limited to `main`
- HTTPS everywhere with HSTS
- the API refuses traffic that bypasses CloudFront
- container runs as a non-root user
- image vulnerability scanning
- rate limits, audit log and budget alerts

**Do these as part of going live:**
- [ ] MFA on the root user and every human admin. Don't use the root user day to day.
- [ ] Restrict who can read the Terraform state bucket.
- [ ] Confirm the SNS subscriptions and set log retention (section 6).
- [ ] Get the privacy policy and terms reviewed by a legal adviser (the site's pages are templates).
- [ ] **Promote the Content-Security-Policy to enforcing.** It ships as *report-only* because it couldn't be tested against a live CloudFront. Browse the live site with the developer console open, fix or allow anything it reports, then in `cdn.tf` move the value into `security_headers_config.content_security_policy` and remove the report-only header.
- [ ] Rotate SES SMTP credentials and the admin password if they're ever shared.

**Remaining risks and recommended upgrades:**
- **No WAF:** add AWS WAF on CloudFront (AWS managed rule groups plus rate-based rules) once there's real traffic. It defends against bots and common attacks before they reach Django.
- **Admin accounts have password-only sign-in:** add multi-factor authentication for the admin portal.
- **Single-AZ database by default:** an AZ outage means downtime until it recovers, or a restore. Switch on `db_multi_az` for production data you can't lose time on.
- **Payments:** only cash on delivery is real. Integrating an online gateway must include verifying its webhooks on the server and never trusting the browser's word that a payment succeeded.
- **No external uptime monitoring or error tracking:** consider an uptime checker hitting `/api/health/` and an error tracker such as Sentry.
- **Penetration test:** have an independent security review before handling significant volumes of real orders and personal data.
