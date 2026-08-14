import { createClient } from '@supabase/supabase-js';

// Banco Supabase separado, só pra demo de prospecção (/app/demo, /api/disparar-demo).
// Existe pra nunca escrever nada no banco real do Chapelão durante uma demo na
// frente de um lead — cliente demo, cupom e oferta ficam isolados aqui.
const supabaseDemo = createClient(process.env.DEMO_SUPA_URL, process.env.DEMO_SUPA_SERVICE_KEY);

export async function buscarOuCriarClienteDemo({ nome, telefone }) {
  const { data: existente, error: errBusca } = await supabaseDemo
    .from('clientes')
    .select('*')
    .eq('telefone', telefone)
    .maybeSingle();
  if (errBusca) throw errBusca;
  if (existente) return existente;

  const { data: criado, error: errCriar } = await supabaseDemo
    .from('clientes')
    .insert({ nome, telefone, status_cadencia: 'ativo' })
    .select()
    .single();
  if (errCriar) throw errCriar;
  return criado;
}

const PALAVRAS_CUPOM = ['FOME', 'BORA', 'QUERO', 'SIM', 'TOPA', 'VEM', 'MASSA', 'BOA'];

function gerarCodigoCupom() {
  const palavra = PALAVRAS_CUPOM[Math.floor(Math.random() * PALAVRAS_CUPOM.length)];
  const numero = Math.floor(Math.random() * 90 + 10);
  return `${palavra}${numero}`;
}

export async function criarCupom({ clienteId, descontoPercentual = 0, validoAteDias = 7 }) {
  const validoAte = new Date(Date.now() + validoAteDias * 86400000).toISOString().slice(0, 10);

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigoCupom();
    const { data, error } = await supabaseDemo
      .from('cupons')
      .insert({ cliente_id: clienteId, codigo, desconto_percentual: descontoPercentual, valido_ate: validoAte })
      .select()
      .single();

    if (!error) return data;
    if (error.code !== '23505') throw error;
  }

  throw new Error('Não foi possível gerar um código de cupom único após várias tentativas');
}

export async function registrarOfertaEnviada({
  clienteId,
  diasSemComprar,
  tipoOferta = 'reconexao',
  descontoPercentual = 0,
  cupomId = null,
  cupomCodigo = null,
  mensagemVideo = null,
  mensagemAudio = null,
  mensagemCta,
}) {
  const { data, error } = await supabaseDemo
    .from('ofertas_enviadas')
    .insert({
      cliente_id: clienteId,
      faixa_cadencia: diasSemComprar,
      dias_sem_comprar: diasSemComprar,
      tipo_oferta: tipoOferta,
      desconto_percentual: descontoPercentual,
      cupom_id: cupomId,
      cupom_codigo: cupomCodigo,
      mensagem_video: mensagemVideo,
      mensagem_audio: mensagemAudio,
      mensagem_cta: mensagemCta,
    })
    .select()
    .single();
  if (error) throw error;

  await supabaseDemo
    .from('clientes')
    .update({ ultima_oferta_enviada_em: new Date().toISOString(), ultima_faixa_enviada: diasSemComprar })
    .eq('id', clienteId);

  return data;
}
