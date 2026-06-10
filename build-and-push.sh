#!/bin/bash
# ============================================
# Mesa do Bem — Build & Push para Docker Hub
# ============================================
# Uso: ./build-and-push.sh [versão]
# Ex:  ./build-and-push.sh 1.0.0

VERSION=${1:-"latest"}
REGISTRY="vydhal"

echo "🍽️  Mesa do Bem — Build & Push v${VERSION}"
echo "================================================"

# Backend
echo ""
echo "▶ Buildando backend..."
docker build \
  -t ${REGISTRY}/mesa-do-bem-backend:${VERSION} \
  -t ${REGISTRY}/mesa-do-bem-backend:latest \
  ./backend

echo "▶ Pushando backend..."
docker push ${REGISTRY}/mesa-do-bem-backend:${VERSION}
docker push ${REGISTRY}/mesa-do-bem-backend:latest

# Frontend
echo ""
echo "▶ Buildando frontend..."
docker build \
  --build-arg VITE_API_URL=/api \
  -t ${REGISTRY}/mesa-do-bem-frontend:${VERSION} \
  -t ${REGISTRY}/mesa-do-bem-frontend:latest \
  ./frontend

echo "▶ Pushando frontend..."
docker push ${REGISTRY}/mesa-do-bem-frontend:${VERSION}
docker push ${REGISTRY}/mesa-do-bem-frontend:latest

# Face Service
echo ""
echo "▶ Buildando face-service..."
docker build \
  -t ${REGISTRY}/mesa-do-bem-face-service:${VERSION} \
  -t ${REGISTRY}/mesa-do-bem-face-service:latest \
  ./face-service

echo "▶ Pushando face-service..."
docker push ${REGISTRY}/mesa-do-bem-face-service:${VERSION}
docker push ${REGISTRY}/mesa-do-bem-face-service:latest

echo ""
echo "✅ Build e push concluídos!"
echo ""
echo "Imagens disponíveis:"
echo "  ${REGISTRY}/mesa-do-bem-backend:${VERSION}"
echo "  ${REGISTRY}/mesa-do-bem-frontend:${VERSION}"
echo "  ${REGISTRY}/mesa-do-bem-face-service:${VERSION}"
echo ""
echo "Para deploy no Portainer:"
echo "  1. Copie stack.yml para o Portainer"
echo "  2. Configure as variáveis de ambiente (.env.example)"
echo "  3. Deploy!"
