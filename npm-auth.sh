#!/bin/sh

set -e

AWS_REGION="us-east-1"
AWS_DOMAIN_OWNER="120516861714"
AWS_DOMAIN="uigraph"
AWS_REPO="npm-sdk"

echo "> Npm base registry: $(npm config get registry)"
echo "> @uigraph registry: $(npm config get @uigraph:registry)"

TOKEN=$(aws codeartifact get-authorization-token \
  --region $AWS_REGION \
  --domain $AWS_DOMAIN \
  --domain-owner $AWS_DOMAIN_OWNER \
  --query authorizationToken --output text)

npm config set @$AWS_DOMAIN:registry=https://$AWS_DOMAIN-$AWS_DOMAIN_OWNER.d.codeartifact.$AWS_REGION.amazonaws.com/npm/$AWS_REPO/
npm config set //${AWS_DOMAIN}-${AWS_DOMAIN_OWNER}.d.codeartifact.${AWS_REGION}.amazonaws.com/npm/$AWS_REPO/:_authToken=$TOKEN
