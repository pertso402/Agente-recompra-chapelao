import {
  listarLeadsCampanha,
  contarEnviadosHoje,
  minutosDesdeUltimoEnvio,
  criarCupom,
  registrarOfertaEnviada,
  buscarMidiaDoDia,
  marcarWhatsappInvalido,
  buscarConfigIncentivo,
} from '../../../lib/supabase';
import { enviarMidia, verificarNumeroWhatsapp } from '../../../lib/evolution';
import { gerarMensagemPrimeiraCompra } from '../../../lib/openai';
import { deveDispararAgora, agoraNoFuso, META_DIARIA } from '../../../lib/campanha';

// Um disparo leva ~10s (OpenAI + 1 envio). O teto do plano é 60s, mas este
// endpoint manda no máximo UM por chamada mesmo assim — o ritmo vem da
// frequência do cron, não de lote.
export const maxDuration = 60;

const CANDIDATOS_POR_TICK = 8;

// Falha fechado de propósito: esta rota está fora da senha do painel (o
// agendador não faz login), então sem CRON_SECRET configurado ela fica
// inacessível em vez de ficar aberta pra internet.
function autorizado(request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  return (request.headers.get('authorization') || '') === `Bearer ${segredo}`;
}

export async function POST(request) {
  return executar(request);
}

// pg_net faz GET com mais facilidade que POST; aceitar os dois evita ter que
// escolher o verbo pelo agendador.
export async function GET(request) {
  return executar(request);
}

async function executar(request) {
  try {
    if (!autorizado(request)) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const forcar = url.searchParams.get('forcar') === '1';

    // Restringe a campanha a contatos com determinada tag. Serve pra testar
    // com um contato controlado e pra rodar piloto num subgrupo, sem exigir
    // mudança de código.
    const tagsParam = url.searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : null;
    const agora = new Date();
    const { hora, minuto } = agoraNoFuso(agora);
    const relogio = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;

    const [enviadosHoje, minutosDesdeUltimo] = await Promise.all([
      contarEnviadosHoje('brinde'),
      minutosDesdeUltimoEnvio('brinde'),
    ]);

    const decisao = forcar
      ? { disparar: true, motivo: 'forcado_manualmente' }
      : deveDispararAgora({ enviadosHoje, agora, minutosDesdeUltimoEnvio: minutosDesdeUltimo });

    if (!decisao.disparar) {
      return Response.json({ disparou: false, motivo: decisao.motivo, enviadosHoje, meta: META_DIARIA, relogio });
    }

    // A campanha é "vídeo real da marmita + texto". buscarMidiaDoDia() cai no
    // vídeo padrão sozinha quando ninguém subiu um vídeo específico pra hoje —
    // então isto só dispara se nem o padrão estiver configurado (praticamente
    // nunca deveria acontecer).
    const midia = await buscarMidiaDoDia();
    if (!midia) {
      return Response.json({
        disparou: false,
        motivo: 'sem_midia_configurada',
        aviso: 'Nenhum vídeo do dia nem vídeo padrão configurado. Suba um vídeo no painel para a campanha rodar.',
        enviadosHoje,
        meta: META_DIARIA,
        relogio,
      });
    }

    const candidatos = await listarLeadsCampanha({ limite: CANDIDATOS_POR_TICK, tipoOferta: 'brinde', tags });
    if (!candidatos.length) {
      return Response.json({ disparou: false, motivo: 'sem_leads_elegiveis', tags, enviadosHoje, relogio });
    }

    // Percorre candidatos até achar um WhatsApp válido. Números mortos são
    // marcados e saem da fila, em vez de bloquear a campanha repetidamente.
    let lead = null;
    const invalidos = [];
    for (const candidato of candidatos) {
      const check = await verificarNumeroWhatsapp(candidato.telefone);
      if (check.existe) {
        lead = { ...candidato, telefone: check.numero };
        break;
      }
      await marcarWhatsappInvalido(candidato.id);
      invalidos.push(candidato.telefone);
    }

    if (!lead) {
      return Response.json({
        disparou: false,
        motivo: 'nenhum_numero_valido_no_lote',
        numerosInvalidos: invalidos,
        enviadosHoje,
        relogio,
      });
    }

    const incentivo = await buscarConfigIncentivo();
    if (!incentivo) {
      return Response.json({ disparou: false, motivo: 'incentivo_nao_configurado' }, { status: 500 });
    }

    // Sequência de recompra: 0 = oferta inicial, 1 = lembrete, 2 = última tentativa.
    // A validade do cupom é o que define o espaçamento real entre etapas — ela some
    // da lista de elegíveis (campanha_selecionar_leads) enquanto o cupom da etapa
    // anterior ainda estiver válido e não usado, e só reaparece quando ele expira.
    // Última etapa com validade mais curta: gera urgência real, não só na copy.
    const etapa = lead.etapa_sequencia ?? 0;
    const validoAteDiasPorEtapa = { 0: 7, 1: 7, 2: 4 };
    const validoAteDias = validoAteDiasPorEtapa[etapa] ?? 7;

    const cupom = await criarCupom({
      clienteId: lead.id,
      tipo: 'brinde',
      descontoPercentual: 0,
      descricao: incentivo.descricao,
      itensPermitidos: incentivo.itens_permitidos,
      validoAteDias,
    });

    // A copy muda pela relação real com a casa — mandar "nunca comprou aqui"
    // pra quem já é cliente seria factualmente errado, não só um detalhe de tom.
    //
    // São duas famílias de tag convivendo, e olhar só pra uma delas é o bug que
    // isso corrige: `ja_comprou` vem de importação manual, enquanto
    // `cliente`/`cliente_fiel` são mantidas por trigger a partir de
    // total_pedidos — ou seja, são as que de fato provam pedido no sistema.
    // Considerar só `ja_comprou` classificava como "frio" 47 clientes reais,
    // todos com pedido registrado, que receberiam um convite pra "conhecer
    // pela primeira vez" a casa onde já compraram.
    const TAGS_CLIENTE = ['ja_comprou', 'cliente', 'cliente_fiel'];
    const segmento = TAGS_CLIENTE.some((t) => lead.tags?.includes(t))
      ? 'cliente'
      : lead.tags?.includes('interessado')
        ? 'interessado'
        : 'frio';

    const { mensagem } = await gerarMensagemPrimeiraCompra({
      cliente: lead,
      brinde: incentivo.descricao,
      cupom,
      segmento,
      etapa,
    });

    // Um envio só: vídeo com a mensagem inteira como legenda. A campanha
    // mandava áudio antes da mídia, mas o áudio não mudou resultado nenhum e
    // custava crédito de ElevenLabs a cada disparo — agora o texto carrega
    // sozinho o que a fala carregava.
    const envio = await enviarMidia(lead.telefone, {
      url: midia.video_url,
      tipo: midia.tipo,
      legenda: mensagem,
    });

    // Guardar o id da mensagem é o que permite perguntar depois se ela foi
    // entregue e lida. Sem ele, "enviada" é tudo que se sabe pra sempre.
    const whatsappMessageId = envio?.key?.id || null;

    const oferta = await registrarOfertaEnviada({
      clienteId: lead.id,
      diasSemComprar: 0,
      tipoOferta: 'brinde',
      descontoPercentual: 0,
      cupomId: cupom.id,
      cupomCodigo: cupom.codigo,
      mensagemVideo: midia.video_url,
      mensagemAudio: null,
      mensagemCta: mensagem,
      etapaSequencia: etapa,
      whatsappMessageId,
    });

    return Response.json({
      disparou: true,
      motivo: decisao.motivo,
      relogio,
      lead: { nome: lead.nome, telefone: lead.telefone, segmento, etapa },
      cupom: cupom.codigo,
      enviadosHoje: enviadosHoje + 1,
      meta: META_DIARIA,
      numerosInvalidos: invalidos,
      oferta: oferta.id,
    });
  } catch (err) {
    console.error('Erro na campanha:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
