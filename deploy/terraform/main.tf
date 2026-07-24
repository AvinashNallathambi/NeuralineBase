# ═══════════════════════════════════════════════════════════════════════════
# Neuraline EMR — AWS Infrastructure (Phase 1: Free Tier, HIPAA-ready)
#
# Creates: VPC, Security Groups, RDS PostgreSQL, ElastiCache Redis,
#          EC2 instance, Elastic IP, SSH key pair
#
# Usage:
#   1. Install Terraform: https://developer.hashicorp.com/terraform/install
#   2. Install AWS CLI:   https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
#   3. Run: aws configure  (enter your AWS access key + secret)
#   4. Create terraform.tfvars (see terraform.tfvars.example)
#   5. terraform init
#   6. terraform plan      (review what will be created)
#   7. terraform apply     (type "yes" to confirm)
# ═══════════════════════════════════════════════════════════════════════════

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ─── Data: Available Availability Zones ────────────────────────────────────
data "aws_availability_zones" "available" {
  state = "available"
}

# ─── Data: Latest Ubuntu 24.04 AMI ─────────────────────────────────────────
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# ═══════════════════════════════════════════════════════════════════════════
# 1. VPC + Subnets
# ═══════════════════════════════════════════════════════════════════════════

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name    = "${var.project_name}-vpc"
    Project = var.project_name
  }
}

# Internet Gateway (lets public subnets reach the internet)
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name    = "${var.project_name}-igw"
    Project = var.project_name
  }
}

# Public subnets (for EC2)
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name    = "${var.project_name}-public-${count.index + 1}"
    Project = var.project_name
  }
}

# Private subnets (for RDS + Redis)
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 3}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name    = "${var.project_name}-private-${count.index + 1}"
    Project = var.project_name
  }
}

# Route table for public subnets (routes to internet via IGW)
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name    = "${var.project_name}-public-rt"
    Project = var.project_name
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ═══════════════════════════════════════════════════════════════════════════
# 2. Security Groups
# ═══════════════════════════════════════════════════════════════════════════

# EC2 security group (faces the internet)
resource "aws_security_group" "ec2" {
  name        = "${var.project_name}-ec2-sg"
  description = "Rules for Neuraline EC2 app server"
  vpc_id      = aws_vpc.main.id

  # SSH from your IP only
  ingress {
    description = "SSH from home/office"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["${var.your_public_ip}/32"]
  }

  # HTTP from anywhere (Let's Encrypt + redirect)
  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS from anywhere (your website)
  ingress {
    description = "HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.project_name}-ec2-sg"
    Project = var.project_name
  }
}

# RDS security group (only EC2 can reach it)
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Rules for Neuraline RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from EC2 only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  # No outbound rules (database doesn't initiate connections)

  tags = {
    Name    = "${var.project_name}-rds-sg"
    Project = var.project_name
  }
}

# Redis security group (only EC2 can reach it)
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Rules for Neuraline ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from EC2 only"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  # No outbound rules (Redis doesn't initiate connections)

  tags = {
    Name    = "${var.project_name}-redis-sg"
    Project = var.project_name
  }
}

# ═══════════════════════════════════════════════════════════════════════════
# 3. RDS PostgreSQL (Free Tier, encrypted, private)
# ═══════════════════════════════════════════════════════════════════════════

# DB subnet group (uses private subnets)
resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-db-subnet-group"
  description = "Private subnets for Neuraline RDS"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name    = "${var.project_name}-db-subnet-group"
    Project = var.project_name
  }
}

# KMS key for RDS encryption (HIPAA requirement)
resource "aws_kms_key" "rds" {
  description             = "KMS key for Neuraline RDS encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  tags = {
    Name    = "${var.project_name}-rds-kms"
    Project = var.project_name
  }
}

resource "aws_db_instance" "main" {
  engine                = "postgres"
  engine_version        = "15"
  identifier            = "${var.project_name}-db"
  instance_class        = "db.t3.micro"
  allocated_storage     = 20
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_name  = "neuraline"
  username = "neuraline"
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  publicly_accessible = false # HIPAA: never expose to internet

  backup_retention_period = 7 # 7 days (free tier)
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.project_name}-final-snapshot"

  tags = {
    Name    = "${var.project_name}-db"
    Project = var.project_name
  }
}

# ═══════════════════════════════════════════════════════════════════════════
# 4. ElastiCache Redis (Free Tier, encrypted, private)
# ═══════════════════════════════════════════════════════════════════════════

# ElastiCache subnet group (uses private subnets)
resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.project_name}-redis-subnet-group"
  description = "Private subnets for Neuraline Redis"
  subnet_ids  = aws_subnet.private[*].id
}

# KMS key for Redis encryption at rest
resource "aws_kms_key" "redis" {
  description             = "KMS key for Neuraline Redis encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  tags = {
    Name    = "${var.project_name}-redis-kms"
    Project = var.project_name
  }
}

# Redis replication group (single node, encryption enabled for HIPAA)
resource "aws_elasticache_replication_group" "main" {
  replication_group_id          = "${var.project_name}-redis"
  description                   = "Neuraline Redis cache"
  node_type                     = "cache.t3.micro"
  num_cache_clusters            = 1
  engine                        = "redis"
  engine_version                = "7.0"
  port                          = 6379

  at_rest_encryption_enabled    = true # HIPAA
  transit_encryption_enabled    = true # HIPAA
  auth_token                    = var.redis_auth_token

  subnet_group_name             = aws_elasticache_subnet_group.main.name
  security_group_ids            = [aws_security_group.redis.id]

  tags = {
    Name    = "${var.project_name}-redis"
    Project = var.project_name
  }
}

# ═══════════════════════════════════════════════════════════════════════════
# 5. SSH Key Pair (Terraform generates + saves to local file)
# ═══════════════════════════════════════════════════════════════════════════

# Generate a new private key
resource "tls_private_key" "main" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

# Register the public key with AWS
resource "aws_key_pair" "main" {
  key_name   = "${var.project_name}-key"
  public_key = tls_private_key.main.public_key_openssh

  tags = {
    Name    = "${var.project_name}-key"
    Project = var.project_name
  }
}

# Save the private key to a local file (KEEP THIS SAFE)
resource "local_file" "private_key" {
  content         = tls_private_key.main.private_key_pem
  filename        = "${path.module}/${var.project_name}-key.pem"
  file_permission = "0600"
}

# ═══════════════════════════════════════════════════════════════════════════
# 6. EC2 Instance (Free Tier, encrypted EBS)
# ═══════════════════════════════════════════════════════════════════════════

# KMS key for EBS encryption
resource "aws_kms_key" "ebs" {
  description             = "KMS key for Neuraline EC2 EBS encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  tags = {
    Name    = "${var.project_name}-ebs-kms"
    Project = var.project_name
  }
}

resource "aws_instance" "main" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"

  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  associate_public_ip_address = true
  key_name                    = aws_key_pair.main.key_name

  # Encrypted root volume (HIPAA)
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    encrypted             = true
    kms_key_id            = aws_kms_key.ebs.arn
    delete_on_termination = true
  }

  tags = {
    Name    = "${var.project_name}-app"
    Project = var.project_name
  }
}

# Elastic IP (static public IP for your EC2)
resource "aws_eip" "main" {
  instance = aws_instance.main.id
  domain   = "vpc"

  tags = {
    Name    = "${var.project_name}-eip"
    Project = var.project_name
  }

  # Wait for EC2 to be ready before allocating
  depends_on = [aws_internet_gateway.main]
}
