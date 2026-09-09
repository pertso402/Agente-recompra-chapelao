import { reivindicarRespostaRoleta, devolverRespostaRoleta } from '../../../lib/supabase';
import { enviarTexto } from '../../../lib/evolution';
import { montarLinkRoleta, montarMensagemLink, loteDoMes } from '../../../lib/roleta';

export const maxDuration = 30;

// Este é o número de DISPARO, não o de atendimento. Ele existe pra fazer uma
// pergunta e mandar um link — nada mais. Qualquer outra conversa aqui continua
// sendo respondida pelo dono, na mão, como sempre foi.
//
// O Evolution não manda header customizado neste webhook (headers: null na
// config da instância), então o segredo viaja na query string. É o que o
// Evolution suporta; a URL fica só na configuração da instância.
function autorizado(request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const url = new URL(request.url);
  return url.searchParams.get('s') === segredo;
}

// O JID vem em dois formatos. O novo (@lid) esconde o número real e traz o
// telefone em remoteJidAlt — ignorar isso faria a resposta nunca casar com o
// disparo que a originou, e o lead ficaria esperando um link que não vem.
function telefoneDoEvento(chave = {}) {
  const bruto = chave.remoteJidAlt || chave.remoteJid || '';
  if (bruto.endsWith('@g.us')) return null; // grupo, não é conversa de campanha
  const digitos = String(bruto).split('@')[0].replace(/\D/g, '');
  return digitos.length >= 10 ? digitos : null;
}

// Só o texto interessa: o gatilho é "a pessoa respondeu", e uma figurinha ou um
// áudio também são resposta. Por isso texto vazio não descarta o evento — só
// não vira `resposta_texto`.
function textoDaMensagem(msg = {}) {
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    ''
  ).trim();
}

export async function POST(request) {
  // Responder 200 mesmo em caso ignorado é de propósito: erro aqui faz o
  // Evolution reenfileirar o evento e reentregar em loop.
  try {
    if (!autorizado(request)) {
      return Response.json({ ok: false, motivo: 'nao_autorizado' }, { status: 401 });
    }

    const corpo = await request.json().catch(() => ({}));
    const dados = corpo?.data || {};
    const chave = dados.key || {};

    if (corpo?.event && corpo.event !== 'messages.upsert') {
      return Response.json({ ok: true, ignorado: 'evento_irrelevante' });
    }
    if (chave.fromMe) {
      return Response.json({ ok: true, ignorado: 'mensagem_propria' });
    }

    const telefone = telefoneDoEvento(chave);
    if (!telefone) {
      return Response.json({ ok: true, ignorado: 'sem_telefone' });
    }

    const texto = textoDaMensagem(dados.message || {});

    // Reivindicação atômica: se não havia convite pendente pra este número —
    // ou se outra entrega do mesmo evento já ganhou a corrida —, não faz nada.
    // É isso que impede o número de disparo de virar um bot que responde
    // qualquer mensagem de qualquer pessoa.
    const oferta = await reivindicarRespostaRoleta(telefone, texto);
    if (!oferta) {
      return Response.json({ ok: true, ignorado: 'sem_convite_pendente', telefone });
    }

    try {
      const link = montarLinkRoleta(oferta.oferta_id, { lote: loteDoMes() });
      await enviarTexto(telefone, montarMensagemLink(link));
    } catch (err) {
      // Devolve a reivindicação: sem isso o lead ficaria marcado como "link
      // enviado" tendo recebido só a pergunta, e sairia do fluxo em silêncio.
      await devolverRespostaRoleta(oferta.oferta_id).catch(() => {});
      throw err;
    }

    return Response.json({ ok: true, enviou_link: true, oferta: oferta.oferta_id, nome: oferta.nome });
  } catch (err) {
    console.error('Erro no webhook da recompra:', err);
    return Response.json({ ok: false, erro: err.message || 'erro interno' }, { status: 200 });
  }
}

// O Evolution valida a URL com GET em algumas versões.
export async function GET() {
  return Response.json({ ok: true, servico: 'webhook-recompra' });
}
