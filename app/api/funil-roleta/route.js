import { buscarFunilRoleta } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// Funil da campanha roleta. Fica atrás da senha do painel (não está na lista de
// exceções do middleware), porque expõe nome e telefone de cliente.
export async function GET() {
  try {
    const { resumo, linhas } = await buscarFunilRoleta();

    const enviados = Number(resumo?.convites_enviados || 0);
    // Percentual sempre sobre o total de convites, e não sobre o degrau
    // anterior: é o que responde "de cada 100 pessoas abordadas, quantas
    // chegaram até aqui" — a pergunta que o teste existe pra responder.
    const pct = (n) => (enviados ? Math.round((Number(n || 0) / enviados) * 1000) / 10 : 0);

    return Response.json({
      resumo,
      etapas: [
        { etapa: '1. Convite enviado',   total: enviados,                              pct: enviados ? 100 : 0 },
        { etapa: '2. Entregue',           total: Number(resumo?.entregues || 0),        pct: pct(resumo?.entregues) },
        { etapa: '3. Lida',               total: Number(resumo?.lidas || 0),            pct: pct(resumo?.lidas) },
        { etapa: '4. Respondeu',          total: Number(resumo?.responderam || 0),      pct: pct(resumo?.responderam) },
        { etapa: '5. Recebeu o link',    total: Number(resumo?.receberam_link || 0),   pct: pct(resumo?.receberam_link) },
        { etapa: '6. Abriu o link',      total: Number(resumo?.abriram_link || 0),     pct: pct(resumo?.abriram_link) },
        { etapa: '7. Girou a roleta',    total: Number(resumo?.giraram || 0),          pct: pct(resumo?.giraram) },
        { etapa: '8. Preencheu os dados',total: Number(resumo?.preencheram || 0),      pct: pct(resumo?.preencheram) },
        { etapa: '9. Resgatou o prêmio', total: Number(resumo?.resgataram || 0),       pct: pct(resumo?.resgataram) },
        { etapa: '10. Chamou no WhatsApp',total: Number(resumo?.chamaram_whatsapp || 0),pct: pct(resumo?.chamaram_whatsapp) },
        { etapa: '11. Virou pedido',      total: Number(resumo?.viraram_pedido || 0),   pct: pct(resumo?.viraram_pedido) },
      ],
      receita: Number(resumo?.receita || 0),
      linhas,
    });
  } catch (err) {
    console.error('Erro no funil da roleta:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
