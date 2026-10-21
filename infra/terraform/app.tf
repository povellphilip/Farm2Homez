# The Django API: container image in ECR, run by App Runner (managed HTTPS, autoscaling,
# health checks and CloudWatch logging). Outbound traffic goes through the VPC so it can reach RDS.

resource "aws_ecr_repository" "api" {
  name                 = "${local.name}-api"
  image_tag_mutability = "MUTABLE" # "latest" is re-pointed on each deploy; every image is also tagged with its commit SHA
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 15 most recent images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 15 }
      action       = { type = "expire" }
    }]
  })
}

# Role App Runner uses to pull images from ECR.
resource "aws_iam_role" "apprunner_access" {
  name = "${local.name}-apprunner-ecr-access"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "build.apprunner.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_access" {
  role       = aws_iam_role.apprunner_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# Role the running API assumes: least privilege for its own bucket prefixes and secrets.
resource "aws_iam_role" "apprunner_instance" {
  name = "${local.name}-apprunner-instance"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "tasks.apprunner.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

data "aws_iam_policy_document" "apprunner_instance" {
  statement {
    sid       = "MediaObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.media.arn}/media/*", "${aws_s3_bucket.media.arn}/uploads/*"]
  }

  statement {
    sid       = "MediaListing"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.media.arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["media/*", "uploads/*"]
    }
  }

  statement {
    sid     = "ReadOwnSecrets"
    actions = ["ssm:GetParameters"]
    resources = [
      aws_ssm_parameter.secret_key.arn,
      aws_ssm_parameter.database_url.arn,
      aws_ssm_parameter.origin_verify.arn,
      aws_ssm_parameter.email_user.arn,
      aws_ssm_parameter.email_password.arn,
      aws_ssm_parameter.admin_password.arn,
    ]
  }
}

resource "aws_iam_role_policy" "apprunner_instance" {
  name   = "farm2home-api"
  role   = aws_iam_role.apprunner_instance.id
  policy = data.aws_iam_policy_document.apprunner_instance.json
}

resource "aws_apprunner_vpc_connector" "main" {
  vpc_connector_name = local.name
  subnets            = aws_subnet.private[*].id
  security_groups    = [aws_security_group.app.id]
}

resource "aws_apprunner_auto_scaling_configuration_version" "api" {
  auto_scaling_configuration_name = local.name
  min_size                        = var.app_min_instances
  max_size                        = var.app_max_instances
  max_concurrency                 = 60
}

resource "aws_apprunner_service" "api" {
  service_name                   = "${local.name}-api"
  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.api.arn

  source_configuration {
    # Pushing a new image with var.image_tag to ECR triggers a deployment automatically.
    auto_deployments_enabled = true
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }
    image_repository {
      image_identifier      = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"
      image_repository_type = "ECR"
      image_configuration {
        port = "8000"
        runtime_environment_variables = {
          DJANGO_ENV = "production"
          # CloudFront forwards the viewer host (X-Forwarded-Host, trusted only with the origin secret).
          ALLOWED_HOSTS            = local.has_domain ? "${var.domain_name},.cloudfront.net" : ".cloudfront.net"
          FRONTEND_URL             = local.has_domain ? "https://${var.domain_name}" : ""
          STORAGE_BACKEND          = "s3"
          AWS_STORAGE_BUCKET_NAME  = aws_s3_bucket.media.bucket
          AWS_S3_REGION_NAME       = var.aws_region
          MEDIA_PUBLIC_BASE        = "/media/"
          NUM_PROXIES              = "2"
          SECURE_SSL_REDIRECT      = "True"
          EMAIL_BACKEND            = "django.core.mail.backends.smtp.EmailBackend"
          EMAIL_HOST               = "email-smtp.${var.aws_region}.amazonaws.com"
          EMAIL_PORT               = "587"
          EMAIL_USE_TLS            = "True"
          DEFAULT_FROM_EMAIL       = "Farm2Home <${var.from_email}>"
          ADMIN_NOTIFICATION_EMAIL = var.admin_notification_email
          PAYMENTS_MOCK_ENABLED    = "False"
          LOG_LEVEL                = "INFO"
          WEB_CONCURRENCY          = "2"
          F2H_ADMIN_EMAIL          = var.bootstrap_admin_email
        }
        runtime_environment_secrets = {
          SECRET_KEY           = aws_ssm_parameter.secret_key.arn
          DATABASE_URL         = aws_ssm_parameter.database_url.arn
          ORIGIN_VERIFY_SECRET = aws_ssm_parameter.origin_verify.arn
          EMAIL_HOST_USER      = aws_ssm_parameter.email_user.arn
          EMAIL_HOST_PASSWORD  = aws_ssm_parameter.email_password.arn
          F2H_ADMIN_PASSWORD   = aws_ssm_parameter.admin_password.arn
        }
      }
    }
  }

  instance_configuration {
    cpu               = var.app_cpu
    memory            = var.app_memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  # TCP check: requests from App Runner's health checker carry neither the CloudFront secret nor an allowed host.
  health_check_configuration {
    protocol            = "TCP"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
    }
    ingress_configuration {
      is_publicly_accessible = true # CloudFront needs to reach it; the origin secret blocks direct use
    }
  }

  depends_on = [aws_iam_role_policy_attachment.apprunner_access, aws_iam_role_policy.apprunner_instance]
}
