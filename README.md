# Agente de Recompra — Chapelão

Agente proativo de reativação de clientes via WhatsApp. Lê o banco (nunca
escreve pedido), gera mensagem personalizada citando o último pedido real do
cliente, manda vídeo/imagem do produto + texto + cupom de desconto.

Faz parte do Protocolo ARTe (pilar de Retenção). Ver `CONTEXTO.md` para o
contexto completo de negócio e arquitetura.

## Stack

- Next.js (App Router), deploy na Vercel
- Supabase (banco compartilhado com `agente-chapelao` e o ERP)
- Evolution API (WhatsApp)
- Claude API (geração de mensagem)
- ElevenLabs (opcional — áudio)

## Rodando localmente

```bash
npm install
cp .env.example .env.local
# preencher .env.local com as credenciais reais
npm run dev
```

Abra `http://localhost:3000` — painel mobile-first com lista de clientes
elegíveis pra recompra.

## Criar cliente demo (pra prospecção presencial)

```bash
node scripts/seed-demo.js 5544999999999
```

Cria (ou atualiza) um cliente demo com telefone real e um "último pedido"
de pizza há 12 dias, pronto pra disparar ao vivo na frente do prospect.

## Endpoints

- `GET /api/clientes?diasMinimo=7` — lista clientes elegíveis
- `PATCH /api/clientes` — `{ clienteId, acao: 'pausar' | 'reativar' }`
- `POST /api/disparar` — `{ clienteId, descontoPercentual? }` — dispara a
  recompra na hora (usado pelo botão do painel e pela demo). Não checa
  horário — isso é regra só do cron (ainda não implementado).

## O que falta (ver CONTEXTO.md seção 6)

1. Cron automático com situational selling (11h geral / 19h30 pizza-hambúrguer)
2. Multi-tenant (depois de validar no Chapelão)
3. Testar `/api/disparar` ponta a ponta com credenciais reais
4. Deploy na Vercel
