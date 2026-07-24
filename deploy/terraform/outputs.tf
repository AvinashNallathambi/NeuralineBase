# ═══════════════════════════════════════════════════════════════════════════
# Outputs — these are displayed after `terraform apply` completes
# ═══════════════════════════════════════════════════════════════════════════

output "ec2_public_ip" {
  description = "Public IP of your EC2 instance (use this for DNS A record)"
  value       = aws_eip.main.public_ip
}

output "ec2_public_dns" {
  description = "Public DNS of your EC2 instance"
  value       = aws_instance.main.public_dns
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (put this in .env as DB_HOST)"
  value       = aws_db_instance.main.endpoint
}

output "rds_connection_string" {
  description = "Full RDS connection string (for reference)"
  value       = "postgresql://neuraline:${var.db_password}@${aws_db_instance.main.endpoint}/neuraline"
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint (put this in .env as REDIS_HOST)"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "ssh_command" {
  description = "Command to SSH into your EC2"
  value       = "ssh -i ${path.module}/${var.project_name}-key.pem ubuntu@${aws_eip.main.public_ip}"
}

output "ssh_key_file" {
  description = "Location of your SSH private key file (KEEP THIS SAFE)"
  value       = "${path.module}/${var.project_name}-key.pem"
}

output "security_group_ids" {
  description = "Security group IDs (for reference)"
  value = {
    ec2   = aws_security_group.ec2.id
    rds   = aws_security_group.rds.id
    redis = aws_security_group.redis.id
  }
}
