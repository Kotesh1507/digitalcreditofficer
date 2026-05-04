#!/usr/bin/env bash
# Usage:
#   First time:  ./deploy.sh --init   (creates ECR, pushes image, then applies all infra)
#   After that:  ./deploy.sh          (builds new image, pushes, forces ECS redeploy)
set -euo pipefail

AWS_REGION="us-west-2"
APP_NAME="dco-app"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}"

build_and_push() {
  echo "==> Logging into ECR..."
  aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

  echo "==> Building image (multi-stage: React + Flask)..."
  docker build --platform linux/amd64 -t "${APP_NAME}" .

  echo "==> Pushing to ECR..."
  docker tag "${APP_NAME}:latest" "${ECR_URL}:latest"
  docker push "${ECR_URL}:latest"
}

if [[ "${1:-}" == "--init" ]]; then
  echo "==> [INIT] Creating ECR repository first..."
  cd terraform
  terraform init
  terraform apply -target=aws_ecr_repository.app -auto-approve
  cd ..

  build_and_push

  echo "==> [INIT] Applying remaining infrastructure..."
  cd terraform
  terraform apply -auto-approve
  cd ..

  echo ""
  echo "==> Done! Your app URL:"
  cd terraform && terraform output app_url
else
  build_and_push

  echo "==> Forcing ECS redeployment..."
  aws ecs update-service \
    --cluster "$APP_NAME" \
    --service  "$APP_NAME" \
    --force-new-deployment \
    --region "$AWS_REGION" \
    --output text --query 'service.serviceName'

  echo ""
  echo "==> Deployed. New task will be running in ~60s."
  echo "    Watch: https://us-west-2.console.aws.amazon.com/ecs/v2/clusters/${APP_NAME}/services"
fi
