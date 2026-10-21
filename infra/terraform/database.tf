# Managed PostgreSQL. Private subnets only, encrypted, daily automated backups (7 days),
# deletion protection and a final snapshot if it is ever destroyed.

resource "random_password" "db" {
  length  = 32
  special = false # keeps the password safe to embed in DATABASE_URL without escaping
}

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${local.name}-pg16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # log queries slower than 1 second
  }
}

resource "aws_db_instance" "main" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage_gb
  max_allocated_storage = var.db_allocated_storage_gb * 5 # storage autoscaling ceiling
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "farm2home"
  username = "farm2home_admin"
  password = random_password.db.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period   = 7
  backup_window             = "20:00-21:00" # 01:30-02:30 IST
  maintenance_window        = "sun:21:30-sun:22:30"
  copy_tags_to_snapshot     = true
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-final"

  auto_minor_version_upgrade      = true
  allow_major_version_upgrade     = false
  performance_insights_enabled    = true
  enabled_cloudwatch_logs_exports = ["postgresql"]
  apply_immediately               = false

  lifecycle {
    ignore_changes = [engine_version] # minor versions upgrade automatically
  }
}
