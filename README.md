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
- OpenAI API (geração de mensagem, gpt-4o)
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

## Campanha de primeira compra (buffet do dia)

Campanha diária de aquisição, separada do fluxo de recompra: os contatos do
Chapelão ainda não têm histórico de pedido, então não há último pedido pra
citar. A mensagem é **áudio convidando a experimentar + vídeo real do buffet
de hoje**, com brinde de primeira compra (1 refrigerante lata + 1 sobremesa).

**Todo dia é preciso subir o vídeo do buffet pelo painel.** Sem o vídeo do dia
a campanha não dispara — é proposital: mandar a oferta sem a comida real tira
o que faz a mensagem funcionar.

Ritmo: até **20 disparos por dia**, entre **11h e 14h** (horário de Brasília),
em intervalos irregulares. Cada tick do cron compara quantos já saíram com
quantos deveriam ter saído àquela altura da janela e sorteia se dispara agora
(`lib/campanha.js`). Sendo auto-corretivo, não precisa guardar horários entre
execuções serverless e recupera sozinho se algum tick falhar.

Quem já recebeu nunca recebe de novo: a seleção exclui quem tem cupom ou
oferta do tipo `brinde`. Números que não existem no WhatsApp são marcados como
`inativo` + tag `whatsapp_invalido`, pra não serem re-sorteados a cada tick.

### Agendamento

Fica no Supabase (`pg_cron` + `pg_net`), não na Vercel — o plano Hobby só
permite cron 1x/dia. O job `campanha-almoco-recompra` roda `*/5 14-16 * * *`
em UTC (= 11:00–13:55 de Brasília) e chama `/api/campanha` com o token do
Vault. Para inspecionar:

```sql
select * from cron.job where jobname = 'campanha-almoco-recompra';
select id, status_code, content::text from net._http_response order by id desc limit 10;
```

### Tags de contato (`clientes.tags`)

- `lead_frio` — nunca comprou
- `cliente` — já comprou (1–2 pedidos)
- `cliente_fiel` — recorrente (3+ pedidos)
- `interessado` — demonstrou interesse (manual; não dá pra derivar de pedido)
- `whatsapp_invalido` — número não existe no WhatsApp

As três primeiras são mantidas em sincronia por trigger a partir de
`total_pedidos`; as demais são preservadas.

### Testar sem atingir cliente real

Marque um contato com a tag `teste` e restrinja a campanha a ela:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://agente-recompra-chapelao.vercel.app/api/campanha?forcar=1&tags=teste"
```

`forcar=1` ignora a janela de horário; `tags=` restringe o público. Para
repetir o teste no mesmo contato, apague antes o cupom e a oferta dele
(senão ele é considerado "já contatado").

## Endpoints

- `GET /api/clientes?diasMinimo=7` — lista clientes elegíveis
- `PATCH /api/clientes` — `{ clienteId, acao: 'pausar' | 'reativar' }`
- `POST /api/disparar` — `{ clienteId, descontoPercentual? }` — recompra
  imediata citando o último pedido. Não checa horário.
- `POST /api/disparar-demo` — disparo livre pra prospecção: nicho, produto e
  mídia escolhidos na hora, sem depender de pedido no banco.
- `GET|POST /api/buffet` — consulta/sobe o vídeo do buffet de hoje.
- `GET|POST /api/campanha` — um tick da campanha. Fora da senha do painel
  (o agendador não faz login); exige `Authorization: Bearer $CRON_SECRET`.

## O que falta

1. Ajustar a meta/janela conforme o resultado do piloto de 20/dia
2. Classificar `interessado` automaticamente a partir das conversas do atendimento
3. Multi-tenant (depois de validar no Chapelão)
