variable "project" {
  description = "Short name used in resource names."
  type        = string
  default     = "farm2home"
}

variable "environment" {
  description = "Deployment environment name, e.g. prod or staging."
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "Main region. ap-south-1 (Mumbai) is closest to Indian customers."
  type        = string
  default     = "ap-south-1"
}

variable "domain_name" {
  description = "Custom domain for the site, e.g. farm2home.in. Leave empty to use the CloudFront domain."
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for domain_name. Required when domain_name is set."
  type        = string
  default     = ""
}

variable "alarm_email" {
  description = "Email address for alarms and budget alerts. AWS sends a confirmation email you must accept."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Monthly AWS cost budget. Alerts at 80% forecast and 100% actual spend."
  type        = number
  default     = 60
}

variable "db_instance_class" {
  description = "RDS instance size. db.t4g.micro is the smallest Graviton class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "db_multi_az" {
  description = "Standby replica in a second availability zone. Roughly doubles database cost."
  type        = bool
  default     = false
}

variable "enable_nat_gateway" {
  description = "Outbound internet for the API, needed to send email through SES SMTP. Roughly USD 35-45 per month."
  type        = bool
  default     = true
}

variable "app_cpu" {
  description = "App Runner vCPU, for example \"0.25 vCPU\", \"0.5 vCPU\" or \"1 vCPU\"."
  type        = string
  default     = "0.25 vCPU"
}

variable "app_memory" {
  description = "App Runner memory, for example \"0.5 GB\", \"1 GB\" or \"2 GB\"."
  type        = string
  default     = "1 GB"
}

variable "app_min_instances" {
  type    = number
  default = 1
}

variable "app_max_instances" {
  type    = number
  default = 2
}

variable "image_tag" {
  description = "API image tag that App Runner runs and watches for new pushes."
  type        = string
  default     = "latest"
}

variable "from_email" {
  description = "Sender address for transactional email. The address or its domain must be verified in SES."
  type        = string
}

variable "admin_notification_email" {
  description = "Receives contact-form messages addressed to the Farm2Home team."
  type        = string
}

variable "github_repository" {
  description = "owner/repo allowed to deploy through GitHub Actions OIDC. Leave empty to skip."
  type        = string
  default     = ""
}

variable "create_github_oidc_provider" {
  description = "Create the account-wide GitHub OIDC provider. Set false if it already exists in the account."
  type        = bool
  default     = true
}

variable "bootstrap_admin_email" {
  description = "Set for one deployment to create the first administrator (password from the ADMIN_PASSWORD parameter), then set back to empty."
  type        = string
  default     = ""
}
