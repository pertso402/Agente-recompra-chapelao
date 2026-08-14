import { enviarMidia, enviarTexto, enviarAudio, verificarNumeroWhatsapp } from '../../../lib/evolution';
import { gerarMensagemRecompra } from '../../../lib/openai';
import { gerarAudioBase64 } from '../../../lib/elevenlabs';

// Disparo de demo de prospecção: 100% stateless de propósito — não grava
// cliente, cupom nem histórico em nenhum banco. É só uma demonstração ao vivo
// pro lead ver a mensagem chegando; o cupom citado na copy é só pra soar real,
// não é resgatável.
const PALAVRAS_CUPOM = ['FOME', 'BORA', 'QUERO', 'SIM', 'TOPA', 'VEM', 'MASSA', 'BOA'];

function cupomFicticio(descontoPercentual) {
  const palavra = PALAVRAS_CUPOM[Math.floor(Math.random() * PALAVRAS_CUPOM.length)];
  const numero = Math.floor(Math.random() * 90 + 10);
  const validoAte = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  return { codigo: `${palavra}${numero}`, desconto_percentual: descontoPercentual, valido_ate: validoAte };
}

export async function POST(request) {
  try {
    const {
      telefone,
      nome = 'Cliente Demo',
      nicho = 'marmitaria',
      nomeProduto,
      mediaUrl,
      tipoMidia = 'video',
      descontoPercentual = 15,
    } = await request.json();

    if (!telefone || !nomeProduto) {
      return Response.json({ error: 'telefone e nomeProduto são obrigatórios' }, { status: 400 });
    }

    // Valida o número antes de gastar API paga (OpenAI/ElevenLabs).
    const check = await verificarNumeroWhatsapp(telefone);
    if (!check.existe) {
      return Response.json(
        { error: `O número ${check.numero || telefone} não existe no WhatsApp. Confira o DDD e o número (não precisa digitar o 55).` },
        { status: 400 }
      );
    }

    const cupom = cupomFicticio(descontoPercentual);

    const { audio: textoAudio, cta: textoCta } = await gerarMensagemRecompra({
      cliente: { nome },
      itens: [{ quantidade: 1, nome_produto: nomeProduto }],
      diasSemComprar: 12,
      cupom,
      nicho,
    });

    const audioBase64 = await gerarAudioBase64(textoAudio);
    if (audioBase64) {
      await enviarAudio(telefone, audioBase64);
    }

    if (mediaUrl) {
      await enviarMidia(telefone, { url: mediaUrl, tipo: tipoMidia, legenda: textoCta });
    } else {
      await enviarTexto(telefone, textoCta);
    }

    return Response.json({ sucesso: true, cupom, mensagemCta: textoCta, mensagemAudio: textoAudio });
  } catch (err) {
    console.error('Erro ao disparar demo:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
