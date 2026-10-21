output "site_url" {
  description = "Public address of the site."
  value       = local.site_url
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_distribution_id" {
  description = "GitHub secret CLOUDFRONT_DISTRIBUTION_ID."
  value       = aws_cloudfront_distribution.site.id
}

output "frontend_bucket" {
  description = "GitHub secret FRONTEND_BUCKET."
  value       = aws_s3_bucket.frontend.bucket
}

output "media_bucket" {
  value = aws_s3_bucket.media.bucket
}

output "ecr_repository_url" {
  description = "GitHub secret ECR_REPOSITORY (the part after the registry host is the repository name)."
  value       = aws_ecr_repository.api.repository_url
}

output "apprunner_service_arn" {
  description = "GitHub secret APPRUNNER_SERVICE_ARN."
  value       = aws_apprunner_service.api.arn
}

output "apprunner_service_url" {
  description = "Direct App Runner address. Requests here are refused unless they come through CloudFront."
  value       = aws_apprunner_service.api.service_url
}

output "database_endpoint" {
  value = aws_db_instance.main.address
}

output "ssm_parameters" {
  description = "Secrets the API reads. Set the two EMAIL_* values to your SES SMTP credentials."
  value = {
    secret_key     = aws_ssm_parameter.secret_key.name
    database_url   = aws_ssm_parameter.database_url.name
    origin_verify  = aws_ssm_parameter.origin_verify.name
    email_user     = aws_ssm_parameter.email_user.name
    email_password = aws_ssm_parameter.email_password.name
    admin_password = aws_ssm_parameter.admin_password.name
  }
}

output "github_deploy_role_arn" {
  description = "GitHub secret AWS_DEPLOY_ROLE_ARN."
  value       = local.github_enabled ? aws_iam_role.github_deploy[0].arn : null
}
