# Contexto do Projeto — Agente de Recompra (ARTe / Chapelão)

Este documento resume tudo que foi discutido e decidido antes deste ponto, pra
qualquer pessoa (ou instância de Claude Code) continuar o trabalho sem precisar
reconstruir o raciocínio do zero.

## 1. Contexto de negócio

- Sou dono da **ARTe** (também chamada Food Scale), uma agência de marketing
  digital e automação com IA para restaurantes e food businesses, em sociedade
  com mais uma pessoa.
- O carro-chefe é o **Protocolo ARTe**, vendido por R$2.000/mês, construído em
  três pilares: **Aquisição** (tráfego pago), **Retenção** (automação/reativação
  via WhatsApp) e **Ticket Médio** (reestruturação de cardápio).
- Este projeto — o **agente de recompra** — é a peça técnica do pilar de
  Retenção: aumenta taxa de recompra e LTV do mesmo cliente, sem precisar de
  cliente novo.
- Cliente-piloto: **Chapelão**, uma marmitaria em Umuarama-PR, onde tenho
  contrato de marketing e uso como laboratório antes de vender pra outros.
  Vou começar a usar em produção no Chapelão em poucos dias.
- Depois de validado no Chapelão, o plano é transformar isso num produto
  replicável pra outros clientes (multi-tenant) — mas essa migração é
  trabalho de depois, não de agora.

## 2. Por que este agente existe (estratégico)

- Objetivo: trazer de volta clientes que já compraram, com mensagem
  personalizada baseada no **último pedido real** de cada um, incluindo uma
  oferta/cupom como incentivo.
- Vou usar isso também como **ferramenta de prospecção fria presencial**:
  demo ao vivo de ~30 segundos na frente do dono do restaurante/pizzaria —
  disparar a oferta e o cliente ver a mensagem chegando no WhatsApp na hora.
  Isso substitui qualquer deck/pitch inicial: gera valor percebido rápido
  antes de levar o prospect pra uma reunião de verdade.
- Decidi liderar a abordagem fria com o agente de recompra (não com o de
  atendimento), porque "atendimento" faz o prospect encaixar isso na
  caixinha de chatbot genérico (tipo anota.ai). Um agente que contata cada
  cliente de forma personalizada e proativa soa diferenciado.

### Situational selling (decisão de timing)

A ideia central é ancorar o disparo da mensagem ao contexto psicológico do
cliente, não só a "dias sem comprar":
- **Restaurantes em geral**: por volta das **11h**, quando a pessoa está
  decidindo o que vai almoçar.
- **Pizzaria / hamburgueria**: por volta das **19h30**, quando a pessoa ainda
  não jantou e está com fome/desejo.

A ideia é mandar um vídeo curto de comida apetitosa + texto com a oferta,
chegando no horário certo — parece oportuno, não invasivo.

**Importante**: essa janela de horário vale só pro **disparo automático
(cron)**. O **disparo manual** (botão do painel, usado em demo) sempre
dispara na hora, sem checar horário — porque a demo acontece quando eu
estiver na frente do prospect, não às 11h/19h30.

## 3. Arquitetura decidida

- **Dois repositórios separados**, um banco Supabase compartilhado:
  - `agente-chapelao` (já existe): **agente de atendimento** — recebe pedido
    via WhatsApp, conversa com o cliente, grava pedido no banco. É reativo
    (webhook), roda como processo sempre ligado (hoje no EasyPanel).
  - `agente-recompra` (este projeto, sendo criado agora): **agente de
    recompra/reativação** — só lê o banco (nunca escreve pedido), gera
    mensagem personalizada citando o último pedido, dispara oferta com
    cupom. É proativo (cron ou botão manual), pensado pra rodar como
    Next.js serverless na Vercel.
  - Motivo de serem separados: naturezas de execução diferentes (reativo vs
    proativo), lifecycle de deploy diferente, e não faz sentido acoplar
    lógica de conversa com lógica de campanha de reativação.
- **Código, não n8n**: decidi construir tudo em código (Node.js), mesma
  linha do agente de atendimento, por três motivos — reaproveita o que já
  existe (Supabase, Evolution), n8n vira operação manual por cliente (ruim
  pra produto replicável), e código escala/versiona/testa melhor que
  workflow visual quando isso vira produto vendido com suporte.
- **Banco único**: projeto Supabase `qlswjefuinhbtlhauhgj` concentra todos os
  dados do Chapelão — ERP, agente de atendimento e agente de recompra usam
  essa mesma base. Existe um projeto Supabase separado (`CARDAPIOS-CLIENTES`)
  que é só para os cardápios digitais de outros clientes — não tem relação
  com este agente.

## 4. Schema do banco (já existe, não precisa ser desenhado)

O banco **já tem as colunas certas** para este agente — provavelmente
desenhadas numa sessão anterior de Claude Code junto com o ERP. Principais
tabelas relevantes:

- **`clientes`**: `id, nome, telefone, endereco, total_pedidos, total_gasto,
  primeiro_pedido, ultimo_pedido, status_cadencia (ativo/pausado/inativo/
  bloqueado), ultima_faixa_enviada, ultima_oferta_enviada_em,
  cadencia_pausada_ate, foi_indicado_por, ...`
- **`pedidos`**: `id, cliente_id, numero_pedido, status, tipo_entrega,
  forma_pagamento, subtotal, taxa_entrega, desconto, total, cupom_id,
  canal, created_at, ...`
- **`itens_pedido`**: `id, pedido_id, produto_id, nome_produto, quantidade,
  preco_unitario, total`
- **`produtos`**: `id, nome, descricao, categoria, preco, preco_promocional,
  preco_delivery, disponivel, destaque, imagem_url, video_url` — já tem
  campo de vídeo/imagem por produto, pensado pro "vídeo de comida
  apetitosa" do situational selling.
- **`cupons`**: `id, cliente_id, codigo, desconto_percentual, valido_ate,
  usado, pedido_id`
- **`ofertas_enviadas`** (tabela de log/controle de cadência, ainda vazia):
  `id, cliente_id, faixa_cadencia, dias_sem_comprar, tipo_oferta
  (desconto_percentual/frete_gratis/brinde/reconexao/nurturing),
  desconto_percentual, cupom_id, cupom_codigo, mensagem_audio,
  mensagem_video, mensagem_cta, converteu, pedido_convertido_id, enviado_em`
  — já modela exatamente o combo áudio+vídeo+CTA que eu queria.
- **`info_restaurante`**: `chave, valor, descricao` — tabela chave/valor
  genérica, pode ser usada pra configs do restaurante (ex: horários de
  situational selling, se/quando isso virar configurável).

Não recriar/alterar esse schema sem necessidade — ele já foi pensado pra
este caso de uso.

## 5. O que já existe no `agente-chapelao` (atendimento) que dá pra reaproveitar

Repo: `https://github.com/pertso402/agente-chapelao.git`

- `src/services/supabase.js`: cliente Supabase (`SUPA_URL`,
  `SUPA_SERVICE_KEY`), funções de cliente/pedido/produtos. Usa
  `buscarOuCriarCliente`, `atualizarStatsCliente`, `criarPedidoCompleto`, etc.
- `src/services/evolution.js`: cliente Evolution API (`EVOLUTION_URL`,
  `EVOLUTION_KEY`, `EVOLUTION_INSTANCE`). Hoje só tem `enviarTexto` e
  `enviarDigitando` — **não tem envio de mídia (vídeo/imagem) nem áudio**,
  isso foi adicionado do zero no `agente-recompra`.
- `src/services/media.js`: usa OpenAI (Whisper pra transcrever áudio
  recebido, GPT-4o Vision pra analisar imagem/comprovante recebido) — é
  input, não output. Não tem ElevenLabs.
- Conclusão: o atendimento nunca gerou/mandou mídia proativamente, isso é
  território novo do agente de recompra.

## 6. O que já foi construído no `agente-recompra` (este projeto, novo)

Estrutura criada até agora (Next.js, pra rodar na Vercel):

```
agente-recompra/
├── package.json                    # next, @supabase/supabase-js, axios
├── .env.example                    # todas as env vars necessárias
├── README.md                       # instruções de deploy e do que falta
├── lib/
│   ├── supabase.js   # listarClientesElegiveis, buscarCliente, pausarCliente,
│   │                  # buscarUltimoPedidoComItens (traz itens + imagem/vídeo
│   │                  # do produto), criarCupom, registrarOfertaEnviada
│   ├── evolution.js   # enviarTexto, enviarMidia (video/image), enviarAudio
│   ├── claude.js       # gerarMensagemRecompra — chama a Claude API
│   │                    # (model: claude-sonnet-4-6) com prompt que cita o
│   │                    # último pedido, gera mensagem curta e humana
│   └── elevenlabs.js   # gerarAudioBase64 — opcional, TTS do texto gerado
├── app/
│   ├── layout.js
│   ├── page.js          # painel: lista clientes elegíveis (dias sem
│   │                     # comprar, total gasto, status), botão "Disparar
│   │                     # recompra", botão pausar/reativar. Mobile-first
│   │                     # (pensado pra abrir pelo celular na prospecção)
│   └── api/
│       ├── disparar/route.js  # POST — gatilho MANUAL. Busca cliente +
│       │                       # último pedido, gera cupom, gera mensagem
│       │                       # via Claude, manda vídeo do produto (se
│       │                       # tiver) + texto + áudio opcional, registra
│       │                       # em ofertas_enviadas. NÃO checa horário —
│       │                       # isso é regra só do cron.
│       └── clientes/route.js  # GET lista elegíveis, PATCH pausa/reativa
└── scripts/seed-demo.js   # cria seu próprio WhatsApp como cliente demo,
                             # com um "último pedido" de pizza há ~12 dias
                             # (usa produto real de categoria "pizza" se
                             # existir, pra já vir com imagem/vídeo real)
```

### O que AINDA NÃO foi construído (próximos passos)

1. **Cron automático** (`app/api/cron/route.js` não existe ainda): deve
   rodar em horário fixo, filtrar clientes elegíveis por `dias_sem_comprar`
   E pela janela de horário certa pro tipo de negócio (11h geral / 19h30
   pizza-hambúrguer), e chamar a mesma lógica do `/api/disparar` sem
   intervenção manual. Precisa decidir onde fica essa config de
   horário/categoria (provavelmente `info_restaurante` ou uma tabela nova).
2. **Multi-tenant**: hoje o projeto lê direto o banco do Chapelão via env
   vars fixas. Pra virar produto replicável pra outros clientes, precisa de
   `restaurant_id` nas tabelas relevantes + RLS por cliente. **Isso é
   trabalho de depois de validar no Chapelão, não prioridade agora.**
3. Testar o fluxo `/api/disparar` de ponta a ponta com credenciais reais
   (Supabase, Evolution, Claude, opcionalmente ElevenLabs).
4. Deploy na Vercel com as env vars preenchidas.
5. Rodar `scripts/seed-demo.js` com o telefone real antes de cada demo
   presencial.

## 7. Decisões de produto/preço (contexto, não é escopo técnico deste agente)

- Reprecificação decidida: **R$297 de setup + R$197/mês** para o combo
  agente de atendimento + agente de recompra.
- Cardápio digital (produto à parte, R$300 avulso) não faz parte deste
  agente — é outro produto da ARTe.

## 8. O que peço pra quem continuar (Claude Code)

- Seguir a arquitetura acima (repos separados, banco compartilhado, código
  não n8n, schema já existente sem redesenhar).
- Priorizar deixar o fluxo manual (`/api/disparar` + painel) 100% funcional
  e testável antes de partir pro cron — a demo presencial e o uso real no
  Chapelão (em poucos dias) dependem disso primeiro.
- Depois, implementar o cron automático com a lógica de situational
  selling (11h / 19h30).
- Multi-tenant só depois de validado — não otimizar cedo demais pra isso.
