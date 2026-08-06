import {
  listarLeadsCampanha,
  contarEnviadosHoje,
  criarCupom,
  registrarOfertaEnviada,
  buscarMidiaDoDia,
  marcarWhatsappInvalido,
} from '../../../lib/supabase';
import { enviarMidia, enviarAudio, verificarNumeroWhatsapp } from '../../../lib/evolution';
import { gerarMensagemPrimeiraCompra } from '../../../lib/openai';
import { gerarAudioBase64 } from '../../../lib/elevenlabs';
import { deveDispararAgora, agoraNoFuso, META_DIARIA } from '../../../lib/campanha';

// Um disparo leva ~25s (OpenAI + ElevenLabs + 2 envios). O teto do plano é 60s,
// por isso este endpoint manda no máximo UM por chamada — o ritmo vem da
// frequência do cron, não de lote.
export const maxDuration = 60;

// Texto que o cliente ouve. O volume da sobremesa fica de fora de propósito:
// "75ml" soa pequeno e tira o apelo do brinde.
const BRINDE = '1 coquinha mini de 200ml (ou outro refrigerante mini) + 1 sobremesa';

// Nomes EXATOS do cardápio que podem sair como cortesia. É esta lista, e não
// o texto acima, que o atendimento usa pra decidir o que entregar — sem ela
// um pedido de "refrigerante" casaria com a Coca de 2L.
const BRINDE_ITENS_PERMITIDOS = ['Refrigerante 200ml Pet', 'Sobremesa 75ml'];
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

    const enviadosHoje = await contarEnviadosHoje('brinde');

    const decisao = forcar
      ? { disparar: true, motivo: 'forcado_manualmente' }
      : deveDispararAgora({ enviadosHoje, agora });

    if (!decisao.disparar) {
      return Response.json({ disparou: false, motivo: decisao.motivo, enviadosHoje, meta: META_DIARIA, relogio });
    }

    // A campanha é "vídeo do buffet de hoje + áudio". Sem o vídeo do dia ela
    // perde o que a torna crível, então não dispara pela metade — melhor não
    // enviar e sinalizar no painel do que mandar uma oferta sem a comida real.
    const midia = await buscarMidiaDoDia();
    if (!midia) {
      return Response.json({
        disparou: false,
        motivo: 'sem_midia_do_dia',
        aviso: 'Nenhum vídeo do buffet foi enviado hoje. Suba o vídeo no painel para a campanha rodar.',
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

    const cupom = await criarCupom({
      clienteId: lead.id,
      tipo: 'brinde',
      descontoPercentual: 0,
      descricao: BRINDE,
      itensPermitidos: BRINDE_ITENS_PERMITIDOS,
      validoAteDias: 7,
    });

    const { audio: textoAudio, cta: textoCta } = await gerarMensagemPrimeiraCompra({
      cliente: lead,
      brinde: BRINDE,
      cupom,
    });

    // Áudio primeiro, mídia depois — é a ordem que soa como pessoa mandando
    // mensagem: fala e em seguida mostra a comida.
    let audioEnviado = false;
    const audioBase64 = await gerarAudioBase64(textoAudio);
    if (audioBase64) {
      await enviarAudio(lead.telefone, audioBase64);
      audioEnviado = true;
    }

    await enviarMidia(lead.telefone, {
      url: midia.video_url,
      tipo: midia.tipo,
      legenda: textoCta,
    });

    const oferta = await registrarOfertaEnviada({
      clienteId: lead.id,
      diasSemComprar: 0,
      tipoOferta: 'brinde',
      descontoPercentual: 0,
      cupomId: cupom.id,
      cupomCodigo: cupom.codigo,
      mensagemVideo: midia.video_url,
      mensagemAudio: audioEnviado ? textoAudio : null,
      mensagemCta: textoCta,
    });

    return Response.json({
      disparou: true,
      motivo: decisao.motivo,
      relogio,
      lead: { nome: lead.nome, telefone: lead.telefone },
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
