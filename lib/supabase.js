import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPA_URL, process.env.SUPA_SERVICE_KEY);

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

export async function criarCupom({ clienteId, descontoPercentual, validoAteDias = 7 }) {
  const codigo = `VOLTA${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const validoAte = new Date(Date.now() + validoAteDias * 86400000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('cupons')
    .insert({
      cliente_id: clienteId,
      codigo,
      desconto_percentual: descontoPercentual,
      valido_ate: validoAte,
    })
    .select()
    .single();
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
