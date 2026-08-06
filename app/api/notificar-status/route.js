import { createClient } from '@supabase/supabase-js';
import { enviarTexto } from '../../../lib/evolution';

const supabase = createClient(process.env.SUPA_URL, process.env.SUPA_SERVICE_KEY);

// Falha fechado, mesmo padrão do /api/campanha: essa rota é chamada pelo
// trigger do banco (pg_net), não por um navegador logado — sem o segredo
// configurado ela recusa tudo em vez de ficar aberta.
function autorizado(request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  return (request.headers.get('authorization') || '') === `Bearer ${segredo}`;
}

function montarMensagem(status, pedido) {
  const numero = pedido.numero_pedido;
  const nome = pedido.clientes?.nome?.split(' ')[0] || '';
  const saudacao = nome ? `Oi, ${nome}! ` : '';
  const retirada = pedido.tipo_entrega === 'retirada';

  if (status === 'preparando') {
    return `🎩 ${saudacao}Seu pedido *#${numero}* já entrou na cozinha e está sendo preparado! Não demora 😊`;
  }

  if (status === 'pronto') {
    return retirada
      ? `✅ ${saudacao}Seu pedido *#${numero}* está pronto! Pode vir buscar quando quiser 😄`
      : `✅ ${saudacao}Seu pedido *#${numero}* está pronto e esperando o motoboy! Ele sai a qualquer momento 🛵`;
  }

  if (status === 'saiu_entrega') {
    // Só delivery passa por este status (retirada nunca tem motoboy).
    return `🛵 ${saudacao}O motoboy já saiu com seu pedido *#${numero}*! Chega até você daqui a pouquinho.`;
  }

  return null;
}

export async function POST(request) {
  try {
    if (!autorizado(request)) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { pedidoId, status } = await request.json();
    if (!pedidoId || !status) {
      return Response.json({ error: 'pedidoId e status são obrigatórios' }, { status: 400 });
    }

    // Trava contra duplicata: se já existe registro pra este pedido+status,
    // não manda de novo (staff clicando duas vezes, retry do pg_net, etc).
    const { error: errTrava } = await supabase
      .from('notificacoes_pedido_enviadas')
      .insert({ pedido_id: pedidoId, status });
    if (errTrava) {
      if (errTrava.code === '23505') {
        return Response.json({ enviado: false, motivo: 'ja_notificado' });
      }
      throw errTrava;
    }

    const { data: pedido, error: errPedido } = await supabase
      .from('pedidos')
      .select('numero_pedido, tipo_entrega, clientes(nome, telefone)')
      .eq('id', pedidoId)
      .maybeSingle();
    if (errPedido) throw errPedido;
    if (!pedido) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

    const telefone = pedido.clientes?.telefone;
    if (!telefone) {
      return Response.json({ enviado: false, motivo: 'cliente_sem_telefone' });
    }

    const texto = montarMensagem(status, pedido);
    if (!texto) {
      return Response.json({ enviado: false, motivo: 'status_sem_mensagem' });
    }

    await enviarTexto(telefone, texto);

    return Response.json({ enviado: true, numeroPedido: pedido.numero_pedido, status });
  } catch (err) {
    console.error('Erro ao notificar status:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
