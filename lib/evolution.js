import axios from 'axios';

const client = axios.create({
  baseURL: process.env.EVOLUTION_URL,
  headers: { apikey: process.env.EVOLUTION_KEY },
});

function numeroWhatsapp(telefone) {
  return telefone.replace(/\D/g, '');
}

export async function enviarTexto(telefone, texto) {
  const number = numeroWhatsapp(telefone);
  const { data } = await client.post(`/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
    number,
    text: texto,
  });
  return data;
}

export async function enviarMidia(telefone, { url, tipo = 'video', legenda = '' }) {
  const number = numeroWhatsapp(telefone);
  const mediatype = tipo === 'video' ? 'video' : 'image';
  const { data } = await client.post(`/message/sendMedia/${process.env.EVOLUTION_INSTANCE}`, {
    number,
    mediatype,
    media: url,
    caption: legenda,
  });
  return data;
}

export async function enviarAudio(telefone, audioBase64) {
  const number = numeroWhatsapp(telefone);
  const { data } = await client.post(`/message/sendWhatsAppAudio/${process.env.EVOLUTION_INSTANCE}`, {
    number,
    audio: audioBase64,
  });
  return data;
}
