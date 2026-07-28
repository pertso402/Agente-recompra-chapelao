import { listarClientesElegiveis, pausarCliente, reativarCliente } from '../../../lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const diasMinimo = Number(searchParams.get('diasMinimo') || 7);
    const clientes = await listarClientesElegiveis({ diasMinimo });
    return Response.json({ clientes });
  } catch (err) {
    console.error('Erro ao listar clientes:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { clienteId, acao, pausarAte = null } = await request.json();
    if (!clienteId || !acao) {
      return Response.json({ error: 'clienteId e acao são obrigatórios' }, { status: 400 });
    }

    if (acao === 'pausar') {
      await pausarCliente(clienteId, pausarAte);
    } else if (acao === 'reativar') {
      await reativarCliente(clienteId);
    } else {
      return Response.json({ error: 'acao inválida (use pausar ou reativar)' }, { status: 400 });
    }

    return Response.json({ sucesso: true });
  } catch (err) {
    console.error('Erro ao atualizar cliente:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
