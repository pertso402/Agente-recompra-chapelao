import { buscarConfigIncentivo, salvarConfigIncentivo, listarProdutosParaBrinde } from '../../../lib/supabase';

// Protegida só pela senha do painel (middleware padrão) — uso humano, não
// chamada pelo cron/trigger, então não precisa do CRON_SECRET.

export async function GET() {
  try {
    const [incentivo, produtos] = await Promise.all([
      buscarConfigIncentivo(),
      listarProdutosParaBrinde(),
    ]);
    return Response.json({ incentivo, produtos });
  } catch (err) {
    console.error('Erro ao buscar config de incentivo:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { descricao, itensPermitidos } = await request.json();

    if (!descricao?.trim()) {
      return Response.json({ error: 'Descrição não pode ser vazia' }, { status: 400 });
    }
    if (!Array.isArray(itensPermitidos) || itensPermitidos.length === 0) {
      return Response.json({ error: 'Selecione pelo menos 1 item' }, { status: 400 });
    }

    const incentivo = await salvarConfigIncentivo({ descricao: descricao.trim(), itensPermitidos });
    return Response.json({ sucesso: true, incentivo });
  } catch (err) {
    console.error('Erro ao salvar config de incentivo:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
