import {
  buscarCliente,
  buscarUltimoPedidoComItens,
  criarCupom,
  registrarOfertaEnviada,
  diasSemComprar,
} from '../../../lib/supabase';
import { enviarMidia, enviarTexto, enviarAudio } from '../../../lib/evolution';
import { gerarMensagemRecompra } from '../../../lib/openai';
import { gerarAudioBase64 } from '../../../lib/elevenlabs';

export async function POST(request) {
  try {
    const { clienteId, descontoPercentual = 15 } = await request.json();
    if (!clienteId) {
      return Response.json({ error: 'clienteId é obrigatório' }, { status: 400 });
    }

    const cliente = await buscarCliente(clienteId);
    if (!cliente) {
      return Response.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    const ultimo = await buscarUltimoPedidoComItens(clienteId);
    if (!ultimo) {
      return Response.json({ error: 'Cliente não tem pedidos anteriores' }, { status: 400 });
    }

    const dias = diasSemComprar(cliente.ultimo_pedido);
    const cupom = await criarCupom({ clienteId, descontoPercentual });

    const texto = await gerarMensagemRecompra({
      cliente,
      ultimoPedido: ultimo.pedido,
      itens: ultimo.itens,
      diasSemComprar: dias,
      cupom,
    });

    const midiaUrl = ultimo.produtoDestaque?.video_url || ultimo.produtoDestaque?.imagem_url || null;
    if (midiaUrl) {
      await enviarMidia(cliente.telefone, {
        url: midiaUrl,
        tipo: ultimo.produtoDestaque?.video_url ? 'video' : 'image',
        legenda: texto,
      });
    } else {
      await enviarTexto(cliente.telefone, texto);
    }

    let audioEnviado = false;
    const audioBase64 = await gerarAudioBase64(texto);
    if (audioBase64) {
      await enviarAudio(cliente.telefone, audioBase64);
      audioEnviado = true;
    }

    const oferta = await registrarOfertaEnviada({
      clienteId,
      diasSemComprar: dias,
      tipoOferta: 'reconexao',
      descontoPercentual,
      cupomId: cupom.id,
      cupomCodigo: cupom.codigo,
      mensagemVideo: midiaUrl,
      mensagemAudio: audioEnviado ? 'enviado' : null,
      mensagemCta: texto,
    });

    return Response.json({ sucesso: true, oferta, cupom, mensagem: texto });
  } catch (err) {
    console.error('Erro ao disparar recompra:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
