# Application secrets as encrypted SSM Parameter Store values (standard tier, free).
# App Runner injects them as environment variables at start-up; they never appear in code or images.
# Note: generated values are also held in Terraform state, so the state bucket must be private and encrypted.

resource "random_password" "django_secret" {
  length  = 64
  special = false
}

resource "random_password" "origin_verify" {
  length  = 48
  special = false
}

resource "aws_ssm_parameter" "secret_key" {
  name  = "${local.ssm_path}/SECRET_KEY"
  type  = "SecureString"
  value = random_password.django_secret.result
}

resource "aws_ssm_parameter" "database_url" {
  name  = "${local.ssm_path}/DATABASE_URL"
  type  = "SecureString"
  value = "postgresql://${aws_db_instance.main.username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${aws_db_instance.main.db_name}"
}

resource "aws_ssm_parameter" "origin_verify" {
  name  = "${local.ssm_path}/ORIGIN_VERIFY_SECRET"
  type  = "SecureString"
  value = random_password.origin_verify.result
}

# SES SMTP credentials are created in the SES console (see context/AWS_SETUP.md) and pasted
# into these parameters. Terraform creates placeholders and never overwrites your values.
resource "aws_ssm_parameter" "email_user" {
  name  = "${local.ssm_path}/EMAIL_HOST_USER"
  type  = "SecureString"
  value = "set-me"
  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "admin_password" {
  name  = "${local.ssm_path}/ADMIN_PASSWORD"
  type  = "SecureString"
  value = "set-me"
  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "email_password" {
  name  = "${local.ssm_path}/EMAIL_HOST_PASSWORD"
  type  = "SecureString"
  value = "set-me"
  lifecycle {
    ignore_changes = [value]
  }
}
