import {
  criarCupom,
  registrarOfertaEnviada,
  buscarMidiaDoDia,
  buscarConfigIncentivo,
  buscarContextoDoDia,
  removerCupom,
} from './supabase';
import { enviarMidia } from './evolution';
import { gerarMensagemPrimeiraCompra } from './openai';

// ─── OFERTA DIRETA: VÍDEO + LEGENDA ───────────────────────────────────────────
// Um envio só: o vídeo do buffet com a mensagem inteira como legenda. É o
// formato que converte — 7,0% em agosto e 3,9% em setembro, contra 2,1% da
// roleta (medida pelos prêmios que viraram venda de verdade, não pelo cupom da
// oferta, que a roleta nem usa).
//
// Vive aqui, e não dentro de uma rota, porque agora tem dois chamadores: a
// campanha e o webhook de resposta. Deixar a criação de cupom duplicada em dois
// lugares é como uma das duas cópias envelhece e passa a dar brinde diferente
// da outra.

// Quem RESPONDEU uma mensagem nossa merece prazo curto: ela está com o celular
// na mão agora, e o almoço é hoje. A sequência normal usa 7 dias porque é
// disparo frio, que precisa sobreviver a quem só lê no dia seguinte.
const VALIDADE_PADRAO_DIAS = 7;

const TAGS_CLIENTE = ['ja_comprou', 'cliente', 'cliente_fiel'];

function segmentoDoLead(lead) {
  if (TAGS_CLIENTE.some((t) => lead.tags?.includes(t))) return 'cliente';
  return lead.tags?.includes('interessado') ? 'interessado' : 'frio';
}

// Devolve { cupom, mensagem, midia, oferta } ou estoura. O cupom é removido se
// a copy ou o envio falharem: cupom válido e não usado tira o lead da seleção
// por dias, então cada falha silenciosa sumia com alguém que nunca recebeu
// mensagem nenhuma.
export async function enviarOfertaVideo({ lead, etapa = 0, validadeDias = VALIDADE_PADRAO_DIAS }) {
  const incentivo = await buscarConfigIncentivo();
  if (!incentivo) throw new Error('Incentivo não configurado — sem ele a oferta não tem o que prometer.');

  const midia = await buscarMidiaDoDia();
  if (!midia) throw new Error('Sem mídia do dia — a oferta em vídeo não sai sem o vídeo do buffet.');

  const cupom = await criarCupom({
    clienteId: lead.id,
    tipo: 'brinde',
    descontoPercentual: 0,
    descricao: incentivo.descricao,
    itensPermitidos: incentivo.itens_permitidos,
    validoAteDias: validadeDias,
  });

  let mensagem;
  let envio;
  try {
    const contextoDoDia = await buscarContextoDoDia();
    ({ mensagem } = await gerarMensagemPrimeiraCompra({
      cliente: lead,
      brinde: incentivo.descricao,
      cupom,
      segmento: segmentoDoLead(lead),
      etapa,
      contextoDoDia,
    }));

    envio = await enviarMidia(lead.telefone, {
      url: midia.video_url,
      tipo: midia.tipo,
      legenda: mensagem,
    });
  } catch (err) {
    // A limpeza não pode mascarar o erro original: se ela própria falhar, o que
    // chegaria no log seria a falha da limpeza, e não a causa do disparo ter
    // quebrado — que é justamente o que se quer diagnosticar.
    try {
      await removerCupom(cupom.id);
    } catch (erroLimpeza) {
      console.error('Falha ao remover cupom órfão', cupom.codigo, erroLimpeza);
    }
    throw err;
  }

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
    whatsappMessageId: envio?.key?.id || null,
  });

  return { cupom, mensagem, midia, oferta };
}
