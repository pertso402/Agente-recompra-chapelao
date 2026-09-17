import {
  listarPosPrimeiraCompra,
  buscarIncentivoPosCompra,
  criarCupom,
  removerCupom,
  registrarOfertaEnviada,
} from '../../../lib/supabase';
import { enviarTexto, verificarNumeroWhatsapp } from '../../../lib/evolution';
import { montarMensagemPosCompra, diasDeValidade, horaSaoPaulo } from '../../../lib/pos-compra';

export const maxDuration = 60;

function autorizado(request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  return (request.headers.get('authorization') || '') === `Bearer ${segredo}`;
}

export async function POST(request) { return executar(request); }
export async function GET(request) { return executar(request); }

async function executar(request) {
  let cupom = null;
  try {
    if (!autorizado(request)) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const dias = Number(url.searchParams.get('dias')) || 4;

    // A oferta é pro almoço de HOJE, então só faz sentido mandar enquanto dá
    // tempo de pedir. Fora disso o convite chega como lembrete de algo que já
    // fechou — e queima a única bala que este cliente tem (é uma vez por pessoa).
    const hora = horaSaoPaulo();
    if (!url.searchParams.get('forcar') && (hora < 9 || hora >= 13)) {
      return Response.json({ disparou: false, motivo: 'fora_da_janela', hora });
    }

    const [candidatos, incentivo] = await Promise.all([
      listarPosPrimeiraCompra({ limite: 5, dias }),
      buscarIncentivoPosCompra(),
    ]);

    if (!incentivo) {
      return Response.json({ disparou: false, motivo: 'incentivo_nao_configurado' }, { status: 500 });
    }
    if (!candidatos.length) {
      return Response.json({ disparou: false, motivo: 'ninguem_elegivel', dias });
    }

    // Um por chamada, igual à campanha: o ritmo vem da frequência do cron, e
    // não de lote — mandar 27 mensagens de uma vez é o padrão que dá ban.
    let lead = null;
    for (const candidato of candidatos) {
      const check = await verificarNumeroWhatsapp(candidato.telefone);
      if (check.existe) { lead = { ...candidato, telefone: check.numero }; break; }
    }
    if (!lead) {
      return Response.json({ disparou: false, motivo: 'nenhum_numero_valido_no_lote' });
    }

    // O cupom precisa existir antes da mensagem porque o agente de atendimento
    // o encontra pelo telefone quando a pessoa responder.
    cupom = await criarCupom({
      clienteId: lead.id,
      tipo: 'brinde',
      descontoPercentual: 0,
      descricao: incentivo.descricao,
      itensPermitidos: incentivo.itens_permitidos,
      validoAteDias: diasDeValidade(),
    });

    const mensagem = montarMensagemPosCompra(lead, incentivo.descricao);

    // Sai do CHIP DE DISPARO, não do número principal. O principal atende todos
    // os clientes da casa: 20-30 mensagens automáticas por dia saindo dele arrisca
    // o ban do número que sustenta o negócio inteiro — e esse risco é maior que o
    // ganho de abertura. O chip existe pra absorver exatamente isso.
    //
    // O que compensa a abertura menor aqui é a personalização: esta mensagem cita
    // o nome e o prato que a pessoa realmente comeu, coisa que o disparo genérico
    // da campanha não tinha.
    await enviarTexto(lead.telefone, mensagem);

    const oferta = await registrarOfertaEnviada({
      clienteId: lead.id,
      diasSemComprar: dias,
      tipoOferta: 'pos_primeira_compra',
      descontoPercentual: 0,
      cupomId: cupom.id,
      cupomCodigo: cupom.codigo,
      mensagemCta: mensagem,
    });

    return Response.json({
      disparou: true,
      lead: { nome: lead.nome, telefone: lead.telefone, prato: lead.carnes },
      cupom: cupom.codigo,
      oferta: oferta.id,
      restantes: candidatos.length - 1,
    });
  } catch (err) {
    // Cupom criado e mensagem não enviada tira a pessoa da fila por dias sem
    // ela ter recebido nada — e como é uma vez por cliente, seria pra sempre.
    if (cupom) await removerCupom(cupom.id).catch(() => {});
    console.error('Erro no pós-primeira-compra:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
