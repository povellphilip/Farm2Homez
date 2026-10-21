# Optional custom domain (Route 53 + ACM) and SES sending identity.

# --- HTTPS certificate for CloudFront (must be in us-east-1) --------------------
resource "aws_acm_certificate" "site" {
  count             = local.has_domain ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate_validation" {
  for_each = local.has_domain ? {
    for option in aws_acm_certificate.site[0].domain_validation_options : option.domain_name => option
  } : {}
  zone_id         = var.route53_zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "site" {
  count                   = local.has_domain ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.site[0].arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

# --- Site address records ---------------------------------------------------------
resource "aws_route53_record" "site" {
  for_each = local.has_domain ? toset(["A", "AAAA"]) : toset([])
  zone_id  = var.route53_zone_id
  name     = var.domain_name
  type     = each.value
  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}

# --- SES sending identity -----------------------------------------------------------
# With a domain: verify the whole domain with DKIM records. Without one: verify the single
# sender address (AWS emails a confirmation link). New SES accounts start in the sandbox and can
# only email verified addresses until you request production access (see context/AWS_SETUP.md).
resource "aws_sesv2_email_identity" "sender" {
  email_identity = local.has_domain ? var.domain_name : var.from_email
}

resource "aws_route53_record" "dkim" {
  count   = local.has_domain ? 3 : 0
  zone_id = var.route53_zone_id
  name    = "${aws_sesv2_email_identity.sender.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_sesv2_email_identity.sender.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}
