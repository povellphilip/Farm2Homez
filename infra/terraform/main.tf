data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name       = "${var.project}-${var.environment}"
  account_id = data.aws_caller_identity.current.account_id
  azs        = slice(data.aws_availability_zones.available.names, 0, 2)
  has_domain = var.domain_name != ""
  # Public origin of the site. Without a custom domain, CloudFront's own domain is used.
  site_host = local.has_domain ? var.domain_name : aws_cloudfront_distribution.site.domain_name
  site_url  = "https://${local.site_host}"
  ssm_path  = "/${var.project}/${var.environment}"

  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
