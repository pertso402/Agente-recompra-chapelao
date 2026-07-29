import { buscarOuCriarClienteDemo, criarCupom, registrarOfertaEnviada } from '../../../lib/supabase';
import { enviarMidia, enviarTexto, enviarAudio, verificarNumeroWhatsapp } from '../../../lib/evolution';
import { gerarMensagemRecompra } from '../../../lib/openai';
import { gerarAudioBase64 } from '../../../lib/elevenlabs';

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

    // Valida o número antes de gastar API paga (OpenAI/ElevenLabs) e antes de
    // criar cupom — senão um número digitado errado deixa cupom órfão no banco
    // e só falha depois de todo o trabalho feito.
    const check = await verificarNumeroWhatsapp(telefone);
    if (!check.existe) {
      return Response.json(
        { error: `O número ${check.numero || telefone} não existe no WhatsApp. Confira o DDD e o número (não precisa digitar o 55).` },
        { status: 400 }
      );
    }

    const cliente = await buscarOuCriarClienteDemo({ nome, telefone: check.numero });
    const cupom = await criarCupom({ clienteId: cliente.id, descontoPercentual });

    // A copy usa o nome digitado no formulário, não o do registro no banco:
    // se o telefone já existe como cliente, buscarOuCriarClienteDemo devolve
    // o cadastro antigo (e não sobrescreve o nome real de propósito) — sem
    // isso a demo falava o nome do cliente antigo em vez do prospect.
    const { audio: textoAudio, cta: textoCta } = await gerarMensagemRecompra({
      cliente: { ...cliente, nome },
      itens: [{ quantidade: 1, nome_produto: nomeProduto }],
      diasSemComprar: 12,
      cupom,
      nicho,
    });

    let audioEnviado = false;
    const audioBase64 = await gerarAudioBase64(textoAudio);
    if (audioBase64) {
      await enviarAudio(telefone, audioBase64);
      audioEnviado = true;
    }

    if (mediaUrl) {
      await enviarMidia(telefone, { url: mediaUrl, tipo: tipoMidia, legenda: textoCta });
    } else {
      await enviarTexto(telefone, textoCta);
    }

    const oferta = await registrarOfertaEnviada({
      clienteId: cliente.id,
      diasSemComprar: 12,
      tipoOferta: 'reconexao',
      descontoPercentual,
      cupomId: cupom.id,
      cupomCodigo: cupom.codigo,
      mensagemVideo: mediaUrl || null,
      mensagemAudio: audioEnviado ? textoAudio : null,
      mensagemCta: textoCta,
    });

    return Response.json({ sucesso: true, oferta, cupom, mensagemCta: textoCta, mensagemAudio: textoAudio });
  } catch (err) {
    console.error('Erro ao disparar demo:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
