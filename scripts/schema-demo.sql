-- Rodar no SQL Editor do projeto Supabase de DEMO (mhonpvgdklrapcdfovmv).
-- Cria só o mínimo que /api/disparar-demo precisa. Isolado do banco do Chapelão.

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text,
  telefone text unique not null,
  status_cadencia text default 'ativo',
  ultima_oferta_enviada_em timestamptz,
  ultima_faixa_enviada int,
  created_at timestamptz default now()
);

create table if not exists cupons (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  codigo text unique not null,
  desconto_percentual numeric default 0,
  valido_ate date,
  usado boolean default false,
  pedido_id uuid,
  created_at timestamptz default now()
);

create table if not exists ofertas_enviadas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  faixa_cadencia int,
  dias_sem_comprar int,
  tipo_oferta text,
  desconto_percentual numeric default 0,
  cupom_id uuid references cupons(id),
  cupom_codigo text,
  mensagem_video text,
  mensagem_audio text,
  mensagem_cta text,
  converteu boolean default false,
  enviado_em timestamptz default now()
);

-- Sem RLS: este projeto só serve pra demo de prospecção, sem dado sensível real.
alter table clientes disable row level security;
alter table cupons disable row level security;
alter table ofertas_enviadas disable row level security;
