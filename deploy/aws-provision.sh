#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Neuraline EMR — AWS Resource Provisioning Script
# Creates ALL AWS resources for Phase 1 deployment in one command.
#
# Prerequisites:
#   1. AWS CLI installed: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
#   2. AWS credentials configured: aws configure
#   3. jq installed: https://stedolan.github.io/jq/download/
#
# What this script creates:
#   - VPC with public + private subnets (2 AZs)
#   - Security groups (ec2-sg, rds-sg, redis-sg)
#   - RDS PostgreSQL (free tier, encrypted, private subnet)
#   - ElastiCache Redis (free tier, encrypted, private subnet)
#   - EC2 t3.micro (free tier, encrypted EBS, Elastic IP)
#   - IAM role for EC2 (S3 + KMS access)
#   - KMS encryption key (HIPAA)
#   - S3 bucket for file uploads (encrypted, private)
#   - Route 53 hosted zone (optional — if you have a domain)
#
# What this script does NOT create (do manually):
#   - Route 53 DNS records (need your domain name + EC2 IP first)
#   - SSL certificate (use Let's Encrypt on EC2 after setup)
#
# Usage:
#   chmod +x deploy/aws-provision.sh
#   ./deploy/aws-provision.sh
#
# To tear down everything (for testing):
#   ./deploy/aws-provision.sh --destroy
# ═══════════════════════════════════════════════════════════════════════════

set -e

# ─── Configuration ─────────────────────────────────────────────────────────
# Change these values before running!

REGION="us-east-1"                    # AWS region (us-east-1 has all free tier services)
PROJECT_NAME="neuraline"              # Prefix for all resource names
DB_MASTER_USER="neuraline"            # RDS master username
DB_NAME="neuraline"                   # RDS database name
EC2_INSTANCE_TYPE="t3.micro"          # Free tier
RDS_INSTANCE_TYPE="db.t3.micro"       # Free tier
REDIS_NODE_TYPE="cache.t3.micro"      # Free tier
DB_STORAGE=20                         # GB (free tier: 20GB)
EC2_STORAGE=30                        # GB (free tier: 30GB)
AWS_AMI="ami-0c7217cdde317cfec"       # Ubuntu 24.04 LTS in us-east-1 (update for your region!)
DOMAIN_NAME=""                        # Set to your domain (e.g., neuraline.com) for Route 53, leave blank to skip

# Derived names (don't change these)
VPC_NAME="${PROJECT_NAME}-vpc"
VPC_CIDR="10.0.0.0/16"
PUBLIC_SUBNET_1_CIDR="10.0.1.0/24"
PUBLIC_SUBNET_2_CIDR="10.0.2.0/24"
PRIVATE_SUBNET_1_CIDR="10.0.3.0/24"
PRIVATE_SUBNET_2_CIDR="10.0.4.0/24"
EC2_SG_NAME="${PROJECT_NAME}-ec2-sg"
RDS_SG_NAME="${PROJECT_NAME}-rds-sg"
REDIS_SG_NAME="${PROJECT_NAME}-redis-sg"
RDS_IDENTIFIER="${PROJECT_NAME}-db"
REDIS_NAME="${PROJECT_NAME}-redis"
EC2_NAME="${PROJECT_NAME}-app"
KMS_ALIAS="${PROJECT_NAME}-phi-key"
S3_BUCKET="${PROJECT_NAME}-uploads-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo 'account')"
IAM_ROLE="${PROJECT_NAME}-ec2-role"
IAM_PROFILE="${PROJECT_NAME}-ec2-profile"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}▶ $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $1${NC}"; }
info()  { echo -e "${BLUE}ℹ $1${NC}"; }
error() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# ─── Pre-flight Checks ─────────────────────────────────────────────────────
check_prerequisites() {
  log "Checking prerequisites..."

  command -v aws >/dev/null 2>&1 || error "AWS CLI not installed. Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  command -v jq >/dev/null 2>&1 || error "jq not installed. Install: https://stedolan.github.io/jq/download/"

  # Verify AWS credentials
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) || error "AWS credentials not configured. Run: aws configure"
  info "AWS Account ID: $ACCOUNT_ID"
  info "AWS Region: $REGION"

  # Update S3 bucket name with account ID (ensures global uniqueness)
  S3_BUCKET="${PROJECT_NAME}-uploads-${ACCOUNT_ID}"
}

# ─── Generate Passwords ────────────────────────────────────────────────────
generate_passwords() {
  log "Generating secure passwords..."

  DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  REDIS_AUTH_TOKEN=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)

  info "DB Password: (saved to ${PROJECT_NAME}-secrets.txt)"
  info "Redis Auth Token: (saved to ${PROJECT_NAME}-secrets.txt)"

  # Save to file (DO NOT COMMIT THIS FILE)
  cat > "${PROJECT_NAME}-secrets.txt" << EOF
# ═══════════════════════════════════════════════════════════════
# Neuraline EMR — Generated Secrets
# Generated: $(date)
# ⚠️  DO NOT COMMIT THIS FILE TO GIT!
# Add to .gitignore: echo "${PROJECT_NAME}-secrets.txt" >> .gitignore
# ═══════════════════════════════════════════════════════════════

DB_HOST=               # Will be filled in after RDS creation
DB_PORT=5432
DB_DATABASE=${DB_NAME}
DB_USERNAME=${DB_MASTER_USER}
DB_PASSWORD=${DB_PASSWORD}

REDIS_HOST=            # Will be filled in after ElastiCache creation
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_AUTH_TOKEN}

# Generate these separately for JWT:
# JWT_SECRET=$(openssl rand -base64 48)
# JWT_REFRESH_SECRET=$(openssl rand -base64 48)
# ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF

  warn "${PROJECT_NAME}-secrets.txt created — add to .gitignore!"
}

# ─── 1. KMS Encryption Key ─────────────────────────────────────────────────
create_kms_key() {
  log "Creating KMS encryption key for PHI..."

  KMS_KEY_ID=$(aws kms create-key \
    --description "Neuraline EMR PHI encryption key" \
    --query 'KeyMetadata.KeyId' \
    --output text \
    --region "$REGION")

  aws kms create-alias \
    --alias-name "alias/${KMS_ALIAS}" \
    --target-key-id "$KMS_KEY_ID" \
    --region "$REGION"

  info "KMS Key ID: $KMS_KEY_ID (alias: $KMS_ALIAS)"
}

# ─── 2. VPC ────────────────────────────────────────────────────────────────
create_vpc() {
  log "Creating VPC..."

  VPC_ID=$(aws ec2 create-vpc \
    --cidr-block "$VPC_CIDR" \
    --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${VPC_NAME}}]" \
    --query 'Vpc.VpcId' \
    --output text \
    --region "$REGION")

  aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-support \
    --region "$REGION"
  aws ec2 modify-vpc-attribute --vpc-id "$VPC_ID" --enable-dns-hostnames \
    --region "$REGION"

  info "VPC ID: $VPC_ID"

  # Create public subnet 1 (us-east-1a)
  PUBLIC_SUBNET_1_ID=$(aws ec2 create-subnet \
    --vpc-id "$VPC_ID" \
    --cidr-block "$PUBLIC_SUBNET_1_CIDR" \
    --availability-zone "${REGION}a" \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${VPC_NAME}-public-1a}]" \
    --query 'Subnet.SubnetId' \
    --output text \
    --region "$REGION")

  # Create public subnet 2 (us-east-1b)
  PUBLIC_SUBNET_2_ID=$(aws ec2 create-subnet \
    --vpc-id "$VPC_ID" \
    --cidr-block "$PUBLIC_SUBNET_2_CIDR" \
    --availability-zone "${REGION}b" \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${VPC_NAME}-public-1b}]" \
    --query 'Subnet.SubnetId' \
    --output text \
    --region "$REGION")

  # Create private subnet 1 (us-east-1a)
  PRIVATE_SUBNET_1_ID=$(aws ec2 create-subnet \
    --vpc-id "$VPC_ID" \
    --cidr-block "$PRIVATE_SUBNET_1_CIDR" \
    --availability-zone "${REGION}a" \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${VPC_NAME}-private-1a}]" \
    --query 'Subnet.SubnetId' \
    --output text \
    --region "$REGION")

  # Create private subnet 2 (us-east-1b)
  PRIVATE_SUBNET_2_ID=$(aws ec2 create-subnet \
    --vpc-id "$VPC_ID" \
    --cidr-block "$PRIVATE_SUBNET_2_CIDR" \
    --availability-zone "${REGION}b" \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${VPC_NAME}-private-1b}]" \
    --query 'Subnet.SubnetId' \
    --output text \
    --region "$REGION")

  # Create Internet Gateway for public subnets
  IGW_ID=$(aws ec2 create-internet-gateway \
    --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${VPC_NAME}-igw}]" \
    --query 'InternetGateway.InternetGatewayId' \
    --output text \
    --region "$REGION")

  aws ec2 attach-internet-gateway --vpc-id "$VPC_ID" --internet-gateway-id "$IGW_ID" \
    --region "$REGION"

  # Create public route table
  PUBLIC_ROUTE_TABLE_ID=$(aws ec2 create-route-table \
    --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${VPC_NAME}-public-rt}]" \
    --query 'RouteTable.RouteTableId' \
    --output text \
    --region "$REGION")

  aws ec2 create-route \
    --route-table-id "$PUBLIC_ROUTE_TABLE_ID" \
    --destination-cidr-block "0.0.0.0/0" \
    --gateway-id "$IGW_ID" \
    --region "$REGION"

  # Associate public subnets with public route table
  aws ec2 associate-route-table --subnet-id "$PUBLIC_SUBNET_1_ID" --route-table-id "$PUBLIC_ROUTE_TABLE_ID" \
    --region "$REGION"
  aws ec2 associate-route-table --subnet-id "$PUBLIC_SUBNET_2_ID" --route-table-id "$PUBLIC_ROUTE_TABLE_ID" \
    --region "$REGION"

  # Enable auto-assign public IP on public subnets
  aws ec2 modify-subnet-attribute --subnet-id "$PUBLIC_SUBNET_1_ID" --map-public-ip-on-launch \
    --region "$REGION"
  aws ec2 modify-subnet-attribute --subnet-id "$PUBLIC_SUBNET_2_ID" --map-public-ip-on-launch \
    --region "$REGION"

  info "Public subnets: $PUBLIC_SUBNET_1_ID, $PUBLIC_SUBNET_2_ID"
  info "Private subnets: $PRIVATE_SUBNET_1_ID, $PRIVATE_SUBNET_2_ID"

  # Save IDs to file for later use
  echo "VPC_ID=$VPC_ID" > "${PROJECT_NAME}-aws-ids.txt"
  echo "PUBLIC_SUBNET_1_ID=$PUBLIC_SUBNET_1_ID" >> "${PROJECT_NAME}-aws-ids.txt"
  echo "PUBLIC_SUBNET_2_ID=$PUBLIC_SUBNET_2_ID" >> "${PROJECT_NAME}-aws-ids.txt"
  echo "PRIVATE_SUBNET_1_ID=$PRIVATE_SUBNET_1_ID" >> "${PROJECT_NAME}-aws-ids.txt"
  echo "PRIVATE_SUBNET_2_ID=$PRIVATE_SUBNET_2_ID" >> "${PROJECT_NAME}-aws-ids.txt"
  echo "KMS_KEY_ID=$KMS_KEY_ID" >> "${PROJECT_NAME}-aws-ids.txt"
}

# ─── 3. Security Groups ────────────────────────────────────────────────────
create_security_groups() {
  log "Creating security groups..."

  # EC2 security group (SSH + HTTP + HTTPS)
  EC2_SG_ID=$(aws ec2 create-security-group \
    --group-name "$EC2_SG_NAME" \
    --description "Neuraline EC2 — SSH, HTTP, HTTPS" \
    --vpc-id "$VPC_ID" \
    --query 'GroupId' \
    --output text \
    --region "$REGION")

  # Get your current public IP for SSH access restriction
  MY_IP=$(curl -s https://checkip.amazonaws.com)/32
  info "Your public IP: $MY_IP (SSH access restricted to this IP)"

  aws ec2 authorize-security-group-ingress --group-id "$EC2_SG_ID" \
    --protocol tcp --port 22 --cidr "$MY_IP" --region "$REGION"
  aws ec2 authorize-security-group-ingress --group-id "$EC2_SG_ID" \
    --protocol tcp --port 80 --cidr "0.0.0.0/0" --region "$REGION"
  aws ec2 authorize-security-group-ingress --group-id "$EC2_SG_ID" \
    --protocol tcp --port 443 --cidr "0.0.0.0/0" --region "$REGION"

  # RDS security group (PostgreSQL from EC2 only)
  RDS_SG_ID=$(aws ec2 create-security-group \
    --group-name "$RDS_SG_NAME" \
    --description "Neuraline RDS — PostgreSQL from EC2 only" \
    --vpc-id "$VPC_ID" \
    --query 'GroupId' \
    --output text \
    --region "$REGION")

  aws ec2 authorize-security-group-ingress --group-id "$RDS_SG_ID" \
    --protocol tcp --port 5432 --source-group "$EC2_SG_ID" --region "$REGION"

  # Redis security group (Redis from EC2 only)
  REDIS_SG_ID=$(aws ec2 create-security-group \
    --group-name "$REDIS_SG_NAME" \
    --description "Neuraline Redis — from EC2 only" \
    --vpc-id "$VPC_ID" \
    --query 'GroupId' \
    --output text \
    --region "$REGION")

  aws ec2 authorize-security-group-ingress --group-id "$REDIS_SG_ID" \
    --protocol tcp --port 6379 --source-group "$EC2_SG_ID" --region "$REGION"

  info "EC2 SG: $EC2_SG_ID (SSH:22, HTTP:80, HTTPS:443)"
  info "RDS SG: $RDS_SG_ID (PG:5432 from EC2 SG only)"
  info "Redis SG: $REDIS_SG_ID (Redis:6379 from EC2 SG only)"

  echo "EC2_SG_ID=$EC2_SG_ID" >> "${PROJECT_NAME}-aws-ids.txt"
  echo "RDS_SG_ID=$RDS_SG_ID" >> "${PROJECT_NAME}-aws-ids.txt"
  echo "REDIS_SG_ID=$REDIS_SG_ID" >> "${PROJECT_NAME}-aws-ids.txt"
}

# ─── 4. RDS PostgreSQL ─────────────────────────────────────────────────────
create_rds() {
  log "Creating RDS PostgreSQL (free tier)..."

  # Create DB subnet group with private subnets
  aws rds create-db-subnet-group \
    --db-subnet-group-name "${PROJECT_NAME}-db-subnet-group" \
    --db-subnet-group-description "Neuraline private DB subnets" \
    --subnet-ids "$PRIVATE_SUBNET_1_ID" "$PRIVATE_SUBNET_2_ID" \
    --region "$REGION"

  # Create RDS instance
  aws rds create-db-instance \
    --db-instance-identifier "$RDS_IDENTIFIER" \
    --db-instance-class "$RDS_INSTANCE_TYPE" \
    --engine postgres \
    --engine-version 15.5 \
    --master-username "$DB_MASTER_USER" \
    --master-user-password "$DB_PASSWORD" \
    --allocated-storage "$DB_STORAGE" \
    --storage-type gp3 \
    --storage-encrypted \
    --kms-key-id "$KMS_KEY_ID" \
    --vpc-security-group-ids "$RDS_SG_ID" \
    --db-subnet-group-name "${PROJECT_NAME}-db-subnet-group" \
    --db-name "$DB_NAME" \
    --backup-retention-period 7 \
    --no-publicly-accessible \
    --auto-minor-version-upgrade \
    --region "$REGION"

  info "RDS creating... (this takes ~5-10 minutes)"
  info "Waiting for RDS to become available..."

  aws rds wait db-instance-available \
    --db-instance-identifier "$RDS_IDENTIFIER" \
    --region "$REGION"

  RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier "$RDS_IDENTIFIER" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text \
    --region "$REGION")

  RDS_PORT=$(aws rds describe-db-instances \
    --db-instance-identifier "$RDS_IDENTIFIER" \
    --query 'DBInstances[0].Endpoint.Port' \
    --output text \
    --region "$REGION")

  info "RDS Endpoint: $RDS_ENDPOINT:$RDS_PORT"

  # Update secrets file with RDS endpoint
  sed -i "s/^DB_HOST=.*/DB_HOST=$RDS_ENDPOINT/" "${PROJECT_NAME}-secrets.txt"

  echo "RDS_ENDPOINT=$RDS_ENDPOINT" >> "${PROJECT_NAME}-aws-ids.txt"
  echo "RDS_PORT=$RDS_PORT" >> "${PROJECT_NAME}-aws-ids.txt"
}

# ─── 5. ElastiCache Redis ──────────────────────────────────────────────────
create_redis() {
  log "Creating ElastiCache Redis (free tier)..."

  # Create cache subnet group with private subnets
  aws elasticache create-cache-subnet-group \
    --cache-subnet-group-name "${PROJECT_NAME}-cache-subnet-group" \
    --cache-subnet-group-description "Neuraline private Redis subnets" \
    --subnet-ids "$PRIVATE_SUBNET_1_ID" "$PRIVATE_SUBNET_2_ID" \
    --region "$REGION"

  # Create Redis cluster (free tier cache.t3.micro)
  # Note: encryption-at-rest requires Redis 6+ and is supported on t3.micro
  aws elasticache create-replication-group \
    --replication-group-id "$REDIS_NAME" \
    --replication-group-description "Neuraline Redis cache" \
    --engine redis \
    --engine-version 7.0 \
    --cache-node-type "$REDIS_NODE_TYPE" \
    --cache-subnet-group-name "${PROJECT_NAME}-cache-subnet-group" \
    --security-group-ids "$REDIS_SG_ID" \
    --num-cache-clusters 1 \
    --at-rest-encryption-enabled \
    --transit-encryption-enabled \
    --auth-token "$REDIS_AUTH_TOKEN" \
    --region "$REGION"

  info "Redis creating... (this takes ~3-5 minutes)"
  info "Waiting for Redis to become available..."

  aws elasticache wait replication-group-available \
    --replication-group-id "$REDIS_NAME" \
    --region "$REGION"

  REDIS_ENDPOINT=$(aws elasticache describe-replication-groups \
    --replication-group-id "$REDIS_NAME" \
    --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
    --output text \
    --region "$REGION")

  REDIS_PORT=$(aws elasticache describe-replication-groups \
    --replication-group-id "$REDIS_NAME" \
    --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Port' \
    --output text \
    --region "$REGION")

  info "Redis Endpoint: $REDIS_ENDPOINT:$REDIS_PORT"

  # Update secrets file with Redis endpoint
  sed -i "s/^REDIS_HOST=.*/REDIS_HOST=$REDIS_ENDPOINT/" "${PROJECT_NAME}-secrets.txt"

  echo "REDIS_ENDPOINT=$REDIS_ENDPOINT" >> "${PROJECT_NAME}-aws-ids.txt"
  echo "REDIS_PORT=$REDIS_PORT" >> "${PROJECT_NAME}-aws-ids.txt"
}

# ─── 6. S3 Bucket for File Uploads ─────────────────────────────────────────
create_s3_bucket() {
  log "Creating S3 bucket for file uploads..."

  aws s3api create-bucket \
    --bucket "$S3_BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null || true

  # Enable encryption
  aws s3api put-bucket-encryption \
    --bucket "$S3_BUCKET" \
    --server-side-encryption-configuration \
    "{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"aws:kms\",\"KMSMasterKeyID\":\"$KMS_KEY_ID\"}}]}" \
    --region "$REGION"

  # Block all public access (HIPAA)
  aws s3api put-public-access-block \
    --bucket "$S3_BUCKET" \
    --public-access-block-configuration \
    BlockPublicAcl=true,IgnorePublicAcl=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
    --region "$REGION"

  # Enable versioning (disaster recovery)
  aws s3api put-bucket-versioning \
    --bucket "$S3_BUCKET" \
    --versioning-configuration Status=Enabled \
    --region "$REGION"

  info "S3 Bucket: $S3_BUCKET (encrypted, private, versioned)"

  echo "S3_BUCKET=$S3_BUCKET" >> "${PROJECT_NAME}-aws-ids.txt"
}

# ─── 7. IAM Role for EC2 ───────────────────────────────────────────────────
create_iam_role() {
  log "Creating IAM role for EC2..."

  # Create trust policy (allow EC2 to assume role)
  cat > /tmp/trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

  aws iam create-role \
    --role-name "$IAM_ROLE" \
    --assume-role-policy-document file:///tmp/trust-policy.json \
    --region "$REGION" 2>/dev/null || true

  # Create permissions policy (S3 + KMS access)
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
  cat > /tmp/permissions-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::${S3_BUCKET}",
        "arn:aws:s3:::${S3_BUCKET}/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:DescribeKey"],
      "Resource": "arn:aws:kms:${REGION}:${ACCOUNT_ID}:key/${KMS_KEY_ID}"
    },
    {
      "Effect": "Allow",
      "Action": ["cloudwatch:PutMetricData", "cloudwatch:GetMetricStatistics", "cloudwatch:ListMetrics"],
      "Resource": "*"
    }
  ]
}
EOF

  aws iam put-role-policy \
    --role-name "$IAM_ROLE" \
    --policy-name "${PROJECT_NAME}-permissions" \
    --policy-document file:///tmp/permissions-policy.json \
    --region "$REGION"

  # Create instance profile
  aws iam create-instance-profile \
    --instance-profile-name "$IAM_PROFILE" \
    --region "$REGION" 2>/dev/null || true

  aws iam add-role-to-instance-profile \
    --instance-profile-name "$IAM_PROFILE" \
    --role-name "$IAM_ROLE" \
    --region "$REGION"

  info "IAM Role: $IAM_ROLE"
  info "Instance Profile: $IAM_PROFILE"

  echo "IAM_ROLE=$IAM_ROLE" >> "${PROJECT_NAME}-aws-ids.txt"
  echo "IAM_PROFILE=$IAM_PROFILE" >> "${PROJECT_NAME}-aws-ids.txt"
}

# ─── 8. EC2 Instance ───────────────────────────────────────────────────────
create_ec2() {
  log "Creating EC2 instance (free tier)..."

  # Create EC2 instance
  EC2_INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AWS_AMI" \
    --instance-type "$EC2_INSTANCE_TYPE" \
    --key-name "${PROJECT_NAME}-key" \
    --subnet-id "$PUBLIC_SUBNET_1_ID" \
    --security-group-ids "$EC2_SG_ID" \
    --iam-instance-profile Name="$IAM_PROFILE" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":${EC2_STORAGE},\"VolumeType\":\"gp3\",\"Encrypted\":true,\"KmsKeyId\":\"$KMS_KEY_ID\"}}]" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${EC2_NAME}}]" \
    --user-data "#!/bin/bash
# Initial setup will be done via deploy/setup-ec2.sh after SSH access
" \
    --query 'Instances[0].InstanceId' \
    --output text \
    --region "$REGION")

  info "EC2 Instance ID: $EC2_INSTANCE_ID"
  info "Waiting for EC2 to be running..."

  aws ec2 wait instance-running \
    --instance-ids "$EC2_INSTANCE_ID" \
    --region "$REGION"

  # Allocate and associate Elastic IP
  ELASTIC_IP_ALLOCATION=$(aws ec2 allocate-address \
    --domain vpc \
    --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=${PROJECT_NAME}-eip}]" \
    --query 'AllocationId' \
    --output text \
    --region "$REGION")

  aws ec2 associate-address \
    --instance-id "$EC2_INSTANCE_ID" \
    --allocation-id "$ELASTIC_IP_ALLOCATION" \
    --region "$REGION"

  ELASTIC_IP=$(aws ec2 describe-addresses \
    --allocation-ids "$ELASTIC_IP_ALLOCATION" \
    --query 'Addresses[0].PublicIp' \
    --output text \
    --region "$REGION")

  info "Elastic IP: $ELASTIC_IP"

  echo "EC2_INSTANCE_ID=$EC2_INSTANCE_ID" >> "${PROJECT_NAME}-aws-ids.txt"
  echo "ELASTIC_IP=$ELASTIC_IP" >> "${PROJECT_NAME}-aws-ids.txt"
}

# ─── 9. Route 53 Hosted Zone (optional) ────────────────────────────────────
create_route53() {
  if [ -z "$DOMAIN_NAME" ]; then
    warn "DOMAIN_NAME not set — skipping Route 53 hosted zone creation."
    warn "Set DOMAIN_NAME at the top of this script and re-run, or create it manually."
    return
  fi

  log "Creating Route 53 hosted zone for $DOMAIN_NAME..."

  HOSTED_ZONE_ID=$(aws route53 create-hosted-zone \
    --name "$DOMAIN_NAME" \
    --caller-reference "neuraline-$(date +%s)" \
    --query 'HostedZone.Id' \
    --output text \
    --region "$REGION" | sed 's|/hostedzone/||')

  info "Route 53 Hosted Zone ID: $HOSTED_ZONE_ID"

  # Get NS records to update at GoDaddy
  NS_RECORDS=$(aws route53 get-hosted-zone \
    --id "$HOSTED_ZONE_ID" \
    --query 'DelegationSet.NameServers' \
    --output text \
    --region "$REGION" | tr '\t' '\n')

  info "Update these nameservers at GoDaddy for $DOMAIN_NAME:"
  echo "$NS_RECORDS" | while read -r ns; do
    echo "  $ns"
  done

  # Create A record pointing to EC2 Elastic IP
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "{
      \"Changes\": [{
        \"Action\": \"CREATE\",
        \"ResourceRecordSet\": {
          \"Name\": \"$DOMAIN_NAME.\",
          \"Type\": \"A\",
          \"TTL\": 300,
          \"ResourceRecords\": [{\"Value\": \"$ELASTIC_IP\"}]
        }
      }]
    }" \
    --region "$REGION"

  # Create www A record
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "{
      \"Changes\": [{
        \"Action\": \"CREATE\",
        \"ResourceRecordSet\": {
          \"Name\": \"www.$DOMAIN_NAME.\",
          \"Type\": \"A\",
          \"TTL\": 300,
          \"ResourceRecords\": [{\"Value\": \"$ELASTIC_IP\"}]
        }
      }]
    }" \
    --region "$REGION"

  info "Route 53 A records created: $DOMAIN_NAME → $ELASTIC_IP"
  info "Route 53 A records created: www.$DOMAIN_NAME → $ELASTIC_IP"

  echo "HOSTED_ZONE_ID=$HOSTED_ZONE_ID" >> "${PROJECT_NAME}-aws-ids.txt"
}

# ─── 10. EC2 Key Pair ──────────────────────────────────────────────────────
create_key_pair() {
  log "Creating EC2 key pair..."

  KEY_FILE="${PROJECT_NAME}-key.pem"

  aws ec2 create-key-pair \
    --key-name "${PROJECT_NAME}-key" \
    --query 'KeyMaterial' \
    --output text \
    --region "$REGION" > "$KEY_FILE"

  chmod 600 "$KEY_FILE"

  info "Key pair created: ${PROJECT_NAME}-key"
  info "Private key saved to: $KEY_FILE (KEEP THIS SAFE — cannot be re-downloaded)"
}

# ─── Summary ───────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  ✅ AWS Resources Created Successfully!"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  echo "Resources created:"
  echo "  VPC:              $VPC_ID"
  echo "  KMS Key:          $KMS_KEY_ID"
  echo "  RDS PostgreSQL:   $RDS_ENDPOINT"
  echo "  ElastiCache Redis:$REDIS_ENDPOINT"
  echo "  S3 Bucket:        $S3_BUCKET"
  echo "  EC2 Instance:     $EC2_INSTANCE_ID"
  echo "  Elastic IP:       $ELASTIC_IP"
  echo "  IAM Role:         $IAM_ROLE"
  if [ -n "$DOMAIN_NAME" ]; then
    echo "  Route 53 Zone:    $HOSTED_ZONE_ID ($DOMAIN_NAME)"
  fi
  echo ""
  echo "Files created:"
  echo "  ${PROJECT_NAME}-secrets.txt    — Database + Redis passwords (ADD TO .gitignore!)"
  echo "  ${PROJECT_NAME}-aws-ids.txt    — AWS resource IDs (for teardown)"
  echo "  ${PROJECT_NAME}-key.pem        — EC2 SSH private key (KEEP SAFE!)"
  echo ""
  echo "NEXT STEPS:"
  echo ""
  echo "1. Add to .gitignore:"
  echo "   echo '${PROJECT_NAME}-secrets.txt' >> .gitignore"
  echo "   echo '${PROJECT_NAME}-aws-ids.txt' >> .gitignore"
  echo "   echo '${PROJECT_NAME}-key.pem' >> .gitignore"
  echo ""
  echo "2. SSH into your EC2:"
  echo "   ssh -i ${PROJECT_NAME}-key.pem ubuntu@$ELASTIC_IP"
  echo ""
  echo "3. Run the setup script on EC2:"
  echo "   cd /opt/neuraline && ./deploy/setup-ec2.sh"
  echo ""
  echo "4. Update .env on EC2 with values from ${PROJECT_NAME}-secrets.txt:"
  echo "   nano /opt/neuraline/.env"
  echo ""
  if [ -n "$DOMAIN_NAME" ]; then
    echo "5. Update GoDaddy nameservers to the Route 53 NS records listed above"
    echo "   GoDaddy → DNS → Nameservers → Change → Custom → Paste 4 NS records"
    echo ""
    echo "6. After DNS propagates, set up SSL on EC2:"
    echo "   sudo certbot --nginx -d $DOMAIN_NAME -d www.$DOMAIN_NAME"
    echo ""
  fi
  echo "═══════════════════════════════════════════════════════════"
}

# ─── Teardown (for testing) ────────────────────────────────────────────────
destroy() {
  log "⚠️  DESTROYING ALL Neuraline AWS resources..."
  warn "This will delete everything. Type 'yes' to confirm:"
  read -r confirm
  if [ "$confirm" != "yes" ]; then
    info "Aborted."
    exit 0
  fi

  source "${PROJECT_NAME}-aws-ids.txt"

  log "Deleting Route 53 hosted zone..."
  if [ -n "$HOSTED_ZONE_ID" ]; then
    aws route53 delete-hosted-zone --id "$HOSTED_ZONE_ID" --region "$REGION" 2>/dev/null || true
  fi

  log "Terminating EC2 instance..."
  if [ -n "$EC2_INSTANCE_ID" ]; then
    aws ec2 terminate-instances --instance-ids "$EC2_INSTANCE_ID" --region "$REGION" 2>/dev/null || true
    aws ec2 wait instance-terminated --instance-ids "$EC2_INSTANCE_ID" --region "$REGION" 2>/dev/null || true
  fi

  log "Releasing Elastic IP..."
  if [ -n "$ELASTIC_IP" ]; then
    EIP_ALLOCATION=$(aws ec2 describe-addresses --public-ips "$ELASTIC_IP" --query 'Addresses[0].AllocationId' --output text --region "$REGION" 2>/dev/null)
    aws ec2 release-address --allocation-id "$EIP_ALLOCATION" --region "$REGION" 2>/dev/null || true
  fi

  log "Deleting RDS instance..."
  if [ -n "$RDS_IDENTIFIER" ]; then
    aws rds delete-db-instance --db-instance-identifier "$RDS_IDENTIFIER" --skip-final-snapshot --region "$REGION" 2>/dev/null || true
    aws rds wait db-instance-deleted --db-instance-identifier "$RDS_IDENTIFIER" --region "$REGION" 2>/dev/null || true
  fi

  log "Deleting ElastiCache Redis..."
  if [ -n "$REDIS_NAME" ]; then
    aws elasticache delete-replication-group --replication-group-id "$REDIS_NAME" --region "$REGION" 2>/dev/null || true
  fi

  log "Deleting S3 bucket..."
  if [ -n "$S3_BUCKET" ]; then
    aws s3 rb "s3://$S3_BUCKET" --force --region "$REGION" 2>/dev/null || true
  fi

  log "Deleting security groups..."
  if [ -n "$REDIS_SG_ID" ]; then
    aws ec2 delete-security-group --group-id "$REDIS_SG_ID" --region "$REGION" 2>/dev/null || true
  fi
  if [ -n "$RDS_SG_ID" ]; then
    aws ec2 delete-security-group --group-id "$RDS_SG_ID" --region "$REGION" 2>/dev/null || true
  fi
  if [ -n "$EC2_SG_ID" ]; then
    aws ec2 delete-security-group --group-id "$EC2_SG_ID" --region "$REGION" 2>/dev/null || true
  fi

  log "Deleting subnet group and subnets..."
  aws rds delete-db-subnet-group --db-subnet-group-name "${PROJECT_NAME}-db-subnet-group" --region "$REGION" 2>/dev/null || true
  aws elasticache delete-cache-subnet-group --cache-subnet-group-name "${PROJECT_NAME}-cache-subnet-group" --region "$REGION" 2>/dev/null || true

  log "Deleting IAM role and profile..."
  aws iam remove-role-from-instance-profile --instance-profile-name "$IAM_PROFILE" --role-name "$IAM_ROLE" 2>/dev/null || true
  aws iam delete-instance-profile --instance-profile-name "$IAM_PROFILE" 2>/dev/null || true
  aws iam delete-role-policy --role-name "$IAM_ROLE" --policy-name "${PROJECT_NAME}-permissions" 2>/dev/null || true
  aws iam delete-role --role-name "$IAM_ROLE" 2>/dev/null || true

  log "Deleting VPC..."
  if [ -n "$VPC_ID" ]; then
    # Delete subnets
    for subnet in $(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].SubnetId' --output text --region "$REGION" 2>/dev/null); do
      aws ec2 delete-subnet --subnet-id "$subnet" --region "$REGION" 2>/dev/null || true
    done
    # Delete route tables
    for rt in $(aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" --query 'RouteTables[].RouteTableId' --output text --region "$REGION" 2>/dev/null); do
      aws ec2 delete-route-table --route-table-id "$rt" --region "$REGION" 2>/dev/null || true
    done
    # Delete internet gateway
    for igw in $(aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query 'InternetGateways[].InternetGatewayId' --output text --region "$REGION" 2>/dev/null); do
      aws ec2 detach-internet-gateway --internet-gateway-id "$igw" --vpc-id "$VPC_ID" --region "$REGION" 2>/dev/null || true
      aws ec2 delete-internet-gateway --internet-gateway-id "$igw" --region "$REGION" 2>/dev/null || true
    done
    aws ec2 delete-vpc --vpc-id "$VPC_ID" --region "$REGION" 2>/dev/null || true
  fi

  log "Deleting KMS key..."
  if [ -n "$KMS_KEY_ID" ]; then
    aws kms schedule-key-deletion --key-id "$KMS_KEY_ID" --pending-window-in-days 7 --region "$REGION" 2>/dev/null || true
  fi

  log "Deleting key pair..."
  aws ec2 delete-key-pair --key-name "${PROJECT_NAME}-key" --region "$REGION" 2>/dev/null || true

  echo ""
  echo "✅ All AWS resources destroyed."
  echo "Note: KMS key is scheduled for deletion in 7 days (AWS requirement)."
}

# ─── Main ──────────────────────────────────────────────────────────────────
main() {
  echo "═══════════════════════════════════════════════════════════"
  echo "  Neuraline EMR — AWS Resource Provisioning"
  echo "  Region: $REGION"
  echo "  Project: $PROJECT_NAME"
  if [ -n "$DOMAIN_NAME" ]; then
    echo "  Domain: $DOMAIN_NAME"
  fi
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  if [ "$1" = "--destroy" ]; then
    destroy
    exit 0
  fi

  check_prerequisites
  generate_passwords
  create_kms_key
  create_vpc
  create_security_groups
  create_key_pair
  create_rds
  create_redis
  create_s3_bucket
  create_iam_role
  create_ec2
  create_route53
  print_summary
}

main "$@"
