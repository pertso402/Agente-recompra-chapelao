import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPA_URL, process.env.SUPA_SERVICE_KEY);

export async function buscarOuCriarClienteDemo({ nome, telefone }) {
  const { data: existente, error: errBusca } = await supabase
    .from('clientes')
    .select('*')
    .eq('telefone', telefone)
    .maybeSingle();
  if (errBusca) throw errBusca;
  if (existente) return existente;

  const { data: criado, error: errCriar } = await supabase
    .from('clientes')
    .insert({ nome, telefone, status_cadencia: 'ativo' })
    .select()
    .single();
  if (errCriar) throw errCriar;
  return criado;
}

export function diasSemComprar(ultimoPedido) {
  if (!ultimoPedido) return null;
  const ms = Date.now() - new Date(ultimoPedido).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export async function listarClientesElegiveis({ diasMinimo = 7 } = {}) {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, telefone, endereco, total_pedidos, total_gasto, ultimo_pedido, status_cadencia, ultima_oferta_enviada_em, cadencia_pausada_ate')
    .neq('status_cadencia', 'bloqueado')
    .not('ultimo_pedido', 'is', null)
    .order('ultimo_pedido', { ascending: true });

  if (error) throw error;

  const agora = Date.now();
  return (data || [])
    .map((c) => ({ ...c, dias_sem_comprar: diasSemComprar(c.ultimo_pedido) }))
    .filter((c) => c.dias_sem_comprar >= diasMinimo)
    .filter((c) => !c.cadencia_pausada_ate || new Date(c.cadencia_pausada_ate).getTime() < agora);
}

export async function buscarCliente(clienteId) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clienteId)
    .single();
  if (error) throw error;
  return data;
}

export async function pausarCliente(clienteId, ate = null) {
  const { error } = await supabase
    .from('clientes')
    .update({
      status_cadencia: ate ? 'pausado' : 'pausado',
      cadencia_pausada_ate: ate,
    })
    .eq('id', clienteId);
  if (error) throw error;
}

export async function reativarCliente(clienteId) {
  const { error } = await supabase
    .from('clientes')
    .update({ status_cadencia: 'ativo', cadencia_pausada_ate: null })
    .eq('id', clienteId);
  if (error) throw error;
}

export async function buscarUltimoPedidoComItens(clienteId) {
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!pedido) return null;

  const { data: itens, error: errItens } = await supabase
    .from('itens_pedido')
    .select('id, produto_id, nome_produto, quantidade, preco_unitario, total')
    .eq('pedido_id', pedido.id);
  if (errItens) throw errItens;

  let produtoDestaque = null;
  const primeiroComProduto = (itens || []).find((i) => i.produto_id);
  if (primeiroComProduto) {
    const { data: produto } = await supabase
      .from('produtos')
      .select('id, nome, categoria, imagem_url, video_url')
      .eq('id', primeiroComProduto.produto_id)
      .maybeSingle();
    produtoDestaque = produto || null;
  }

  return { pedido, itens: itens || [], produtoDestaque };
}

const PALAVRAS_CUPOM = ['FOME', 'BORA', 'QUERO', 'SIM', 'TOPA', 'VEM', 'MASSA', 'BOA'];

function gerarCodigoCupom() {
  const palavra = PALAVRAS_CUPOM[Math.floor(Math.random() * PALAVRAS_CUPOM.length)];
  const numero = Math.floor(Math.random() * 90 + 10); // 2 dígitos, evita colisão
  return `${palavra}${numero}`;
}

export async function criarCupom({
  clienteId,
  descontoPercentual = 0,
  validoAteDias = 7,
  tipo = 'desconto_percentual',
  descricao = null,
}) {
  const validoAte = new Date(Date.now() + validoAteDias * 86400000).toISOString().slice(0, 10);

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigoCupom();
    const { data, error } = await supabase
      .from('cupons')
      .insert({
        cliente_id: clienteId,
        codigo,
        desconto_percentual: descontoPercentual,
        valido_ate: validoAte,
        tipo,
        descricao,
      })
      .select()
      .single();

    if (!error) return data;
    if (error.code !== '23505') throw error; // não é colisão de código único, propaga o erro
  }

  throw new Error('Não foi possível gerar um código de cupom único após várias tentativas');
}

// ─── MÍDIA DO BUFFET DO DIA ───────────────────────────────────────────────────

function hojeSaoPaulo() {
  // pt-BR/São Paulo em vez de UTC: às 21h de Brasília o UTC já virou o dia
  // seguinte, e a campanha buscaria a mídia de um dia que ainda não existe.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function buscarMidiaDoDia(data = null) {
  const dia = data || hojeSaoPaulo();
  const { data: midia, error } = await supabase
    .from('midia_do_dia')
    .select('*')
    .eq('data', dia)
    .eq('ativo', true)
    .maybeSingle();
  if (error) throw error;
  return midia || null;
}

export async function salvarMidiaDoDia({ videoUrl, tipo = 'video', data = null }) {
  const dia = data || hojeSaoPaulo();
  const { data: midia, error } = await supabase
    .from('midia_do_dia')
    .upsert({ data: dia, video_url: videoUrl, tipo, ativo: true }, { onConflict: 'data' })
    .select()
    .single();
  if (error) throw error;
  return midia;
}

export async function uploadMidiaBuffet({ buffer, contentType, extensao }) {
  const dia = hojeSaoPaulo();
  const caminho = `${dia}/buffet-${Date.now()}.${extensao}`;

  const { error } = await supabase.storage
    .from('buffet-videos')
    .upload(caminho, buffer, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('buffet-videos').getPublicUrl(caminho);
  return data.publicUrl;
}

// ─── CAMPANHA ─────────────────────────────────────────────────────────────────

export async function listarLeadsCampanha({ limite = 20, tipoOferta = 'brinde', tags = null } = {}) {
  const { data, error } = await supabase.rpc('campanha_selecionar_leads', {
    p_limite: limite,
    p_tipo_oferta: tipoOferta,
    p_tipo_cupom: 'brinde',
    p_tags: tags,
  });
  if (error) throw error;
  return data || [];
}

// Tira de circulação um contato cujo número não existe no WhatsApp. Sem isso
// ele seria sorteado de novo a cada tick do cron e a janela do almoço se
// esgotaria tentando entregar pra um número morto.
export async function marcarWhatsappInvalido(clienteId) {
  const { data: atual } = await supabase.from('clientes').select('tags').eq('id', clienteId).maybeSingle();
  const tags = new Set([...(atual?.tags || []), 'whatsapp_invalido']);

  const { error } = await supabase
    .from('clientes')
    .update({ status_cadencia: 'inativo', tags: Array.from(tags) })
    .eq('id', clienteId);
  if (error) throw error;
}

export async function contarEnviadosHoje(tipoOferta = 'brinde') {
  const { data, error } = await supabase.rpc('campanha_enviados_hoje', { p_tipo_oferta: tipoOferta });
  if (error) throw error;
  return Number(data) || 0;
}

export { hojeSaoPaulo };

export async function marcarCupomUsado(codigo, pedidoId = null) {
  const { data, error } = await supabase
    .from('cupons')
    .update({ usado: true, pedido_id: pedidoId })
    .eq('codigo', codigo)
    .eq('usado', false)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function buscarCupomPorCodigo(codigo) {
  const { data, error } = await supabase
    .from('cupons')
    .select('*')
    .eq('codigo', codigo)
    .maybeSingle();
  if (error) throw error;
  return data;
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
  const { data, error } = await supabase
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

  await supabase
    .from('clientes')
    .update({ ultima_oferta_enviada_em: new Date().toISOString(), ultima_faixa_enviada: diasSemComprar })
    .eq('id', clienteId);

  return data;
}

export default supabase;
