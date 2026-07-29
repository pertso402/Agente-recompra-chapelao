import axios from 'axios';

const client = axios.create({
  baseURL: process.env.EVOLUTION_URL,
  headers: { apikey: process.env.EVOLUTION_KEY },
});

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
export async function verificarNumeroWhatsapp(telefone) {
  const number = normalizarTelefone(telefone);
  if (!number) return { existe: false, numero: '', motivo: 'Telefone vazio' };

  try {
    const { data } = await client.post(`/chat/whatsappNumbers/${process.env.EVOLUTION_INSTANCE}`, {
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

export async function enviarTexto(telefone, texto) {
  const number = normalizarTelefone(telefone);
  try {
    const { data } = await client.post(`/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
      number,
      text: texto,
    });
    return data;
  } catch (err) {
    throw erroEvolution(err, 'enviarTexto');
  }
}

export async function enviarMidia(telefone, { url, tipo = 'video', legenda = '' }) {
  const number = normalizarTelefone(telefone);
  const mediatype = tipo === 'video' ? 'video' : 'image';
  try {
    const { data } = await client.post(`/message/sendMedia/${process.env.EVOLUTION_INSTANCE}`, {
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

export async function enviarAudio(telefone, audioBase64) {
  const number = normalizarTelefone(telefone);
  try {
    const { data } = await client.post(`/message/sendWhatsAppAudio/${process.env.EVOLUTION_INSTANCE}`, {
      number,
      audio: audioBase64,
    });
    return data;
  } catch (err) {
    throw erroEvolution(err, 'enviarAudio');
  }
}
