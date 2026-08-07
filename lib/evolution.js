import axios from 'axios';

// Duas instâncias/números distintos:
// - 'recompra' (padrão): número dedicado só a disparo — campanha, disparo
//   manual, demo de prospecção. É o que este projeto existe pra usar.
// - 'principal': o WhatsApp do agente de atendimento. Usado APENAS por
//   /api/notificar-status, pra notificação de pedido sair do mesmo número
//   onde o cliente já está conversando, não do número de disparo.
const clientes = {
  recompra: axios.create({
    baseURL: process.env.EVOLUTION_URL,
    headers: { apikey: process.env.EVOLUTION_KEY },
  }),
  principal: axios.create({
    baseURL: process.env.EVOLUTION_URL,
    headers: { apikey: process.env.EVOLUTION_KEY_PRINCIPAL },
  }),
};

const instancias = {
  recompra: process.env.EVOLUTION_INSTANCE,
  principal: process.env.EVOLUTION_INSTANCE_PRINCIPAL,
};

function resolver(origem) {
  const client = clientes[origem];
  const instancia = instancias[origem];
  if (!client || !instancia) {
    throw new Error(`Instância Evolution "${origem}" não configurada (faltam env vars).`);
  }
  return { client, instancia };
}

// A Evolution exige o número no formato internacional completo. Um número
// digitado como "44 99708-8509" (sem o 55) é aceito pela API e só falha lá na
// frente com 400 "exists: false" — por isso o DDI é reposto aqui, no ponto de
// entrada, em vez de confiar em quem digitou.
export function normalizarTelefone(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('55')) return digitos;
  // 10 dígitos = DDD + fixo/celular antigo; 11 = DDD + celular com o 9
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos; // números de outros países passam intactos
}

// Transforma o erro cru do axios ("Request failed with status code 400") na
// mensagem que a Evolution realmente devolveu, senão fica impossível saber se
// o problema foi número inválido, instância fora do ar ou payload recusado.
function erroEvolution(err, acao) {
  const resp = err.response?.data;
  const detalhe =
    resp?.response?.message
      ? JSON.stringify(resp.response.message)
      : resp?.message || resp?.error || err.message;
  const e = new Error(`Evolution (${acao}): ${detalhe}`);
  e.status = err.response?.status;
  e.original = err;
  return e;
}

// Pergunta ao WhatsApp se o número existe de fato. Usado ANTES de criar cupom
// ou gerar áudio, pra não gastar API paga nem deixar cupom órfão no banco
// quando o número está errado.
export async function verificarNumeroWhatsapp(telefone, origem = 'recompra') {
  const number = normalizarTelefone(telefone);
  if (!number) return { existe: false, numero: '', motivo: 'Telefone vazio' };

  const { client, instancia } = resolver(origem);
  try {
    const { data } = await client.post(`/chat/whatsappNumbers/${instancia}`, {
      numbers: [number],
    });
    const info = Array.isArray(data) ? data[0] : null;
    return {
      existe: Boolean(info?.exists),
      numero: number,
      nomeWhatsapp: info?.name || null,
    };
  } catch (err) {
    throw erroEvolution(err, 'verificarNumero');
  }
}

export async function enviarTexto(telefone, texto, origem = 'recompra') {
  const number = normalizarTelefone(telefone);
  const { client, instancia } = resolver(origem);
  try {
    const { data } = await client.post(`/message/sendText/${instancia}`, {
      number,
      text: texto,
    });
    return data;
  } catch (err) {
    throw erroEvolution(err, 'enviarTexto');
  }
}

export async function enviarMidia(telefone, { url, tipo = 'video', legenda = '' }, origem = 'recompra') {
  const number = normalizarTelefone(telefone);
  const mediatype = tipo === 'video' ? 'video' : 'image';
  const { client, instancia } = resolver(origem);
  try {
    const { data } = await client.post(`/message/sendMedia/${instancia}`, {
      number,
      mediatype,
      media: url,
      caption: legenda,
    });
    return data;
  } catch (err) {
    throw erroEvolution(err, 'enviarMidia');
  }
}

export async function enviarAudio(telefone, audioBase64, origem = 'recompra') {
  const number = normalizarTelefone(telefone);
  const { client, instancia } = resolver(origem);
  try {
    const { data } = await client.post(`/message/sendWhatsAppAudio/${instancia}`, {
      number,
      audio: audioBase64,
    });
    return data;
  } catch (err) {
    throw erroEvolution(err, 'enviarAudio');
  }
}
