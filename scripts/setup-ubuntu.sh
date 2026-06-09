#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Finance OS — Setup Ubuntu/Linux (modo desenvolvimento)
#  Uso: bash scripts/setup-ubuntu.sh
# ═══════════════════════════════════════════════════════════════

set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Finance OS — Setup Ubuntu/Linux    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# 1. Node.js
echo -e "${YELLOW}[1/4]${NC} A verificar Node.js..."
if ! command -v node &>/dev/null; then
  echo "  Node.js não encontrado. A instalar via nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install 20 && nvm use 20
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# 2. Dependências
echo ""
echo -e "${YELLOW}[2/4]${NC} A instalar dependências npm..."
npm install --legacy-peer-deps
echo -e "${GREEN}✓ Dependências instaladas${NC}"

# 3. Configurar .env
echo ""
echo -e "${YELLOW}[3/4]${NC} A configurar ambiente..."
if [ ! -f "$DIR/.env.local" ]; then
  cp "$DIR/.env.example" "$DIR/.env.local" 2>/dev/null || cat > "$DIR/.env.local" << 'ENVEOF'
ANTHROPIC_API_KEY=sk-ant-COLOCA_AQUI_A_TUA_KEY
AUTH_SECRET=dev-secret-finance-os-2026
RUI_PASSWORD=rui123
ANA_PASSWORD=ana123
DATABASE_URL=file:./data/finance.db
NEXT_PUBLIC_APP_NAME=Finance OS
NODE_ENV=development
ENVEOF
  echo ""
  echo -e "  ${YELLOW}⚠ Ficheiro .env.local criado.${NC}"
  echo -e "  Para o AI Advisor funcionar, adiciona a tua ANTHROPIC_API_KEY:"
  echo -e "    ${BLUE}nano $DIR/.env.local${NC}"
  echo ""
fi
echo -e "${GREEN}✓ Ambiente configurado${NC}"

# 4. Base de dados
echo ""
echo -e "${YELLOW}[4/4]${NC} A inicializar base de dados com dados reais..."
mkdir -p data
npx tsx scripts/seed.ts
echo -e "${GREEN}✓ Base de dados pronta${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Finance OS pronto a usar!            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo "  Para arrancar em modo desenvolvimento:"
echo -e "    ${BLUE}npm run dev${NC}"
echo ""
echo "  Depois abre no browser:"
echo -e "    ${BLUE}http://localhost:3000${NC}"
echo ""
echo "  Para atualizar quando houver mudanças:"
echo -e "    ${BLUE}git pull && npm install${NC}"
echo ""
echo -e "${YELLOW}  ℹ Lembra-te: para o AI Advisor, edita .env.local com a tua ANTHROPIC_API_KEY${NC}"
echo ""
