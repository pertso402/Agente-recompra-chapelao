import axios from 'axios';

// Eleven v3 é o modelo mais expressivo da ElevenLabs — entende audio tags
// inline (ex: [warm], [laughs], [sighs]) e pontuação como direção de atuação,
// o que é o que faz o áudio soar humano em vez de locução de robô.
// Diferente dos modelos v2, aqui `stability` aceita só 3 valores:
//   0.0 = Creative (mais emotivo, mais risco de alucinar)
//   0.5 = Natural  (equilibrado — o que usamos)
//   1.0 = Robust   (estável, mas ignora mais as audio tags)
const MODEL_ID = process.env.ELEVENLABS_MODEL || 'eleven_v3';

// A resposta de sucesso vem como arraybuffer (áudio), então o corpo de ERRO
// também chega binário — sem decodificar, o motivo real da recusa fica
// invisível e sobra só o "Request failed with status code XXX" do axios.
function erroElevenLabs(err) {
  const status = err.response?.status;
  let detalhe = err.message;
  let motivo = null;

  const corpo = err.response?.data;
  if (corpo) {
    try {
      const texto = Buffer.from(corpo).toString('utf8');
      const json = JSON.parse(texto);
      motivo = json.detail?.status || null;
      detalhe = json.detail?.message || motivo || json.message || texto;
    } catch {
      /* corpo não era JSON legível — mantém a mensagem do axios */
    }
  }

  // O status HTTP sozinho engana: cota esgotada volta como 401, igualzinho a
  // chave inválida. Quem decide é o `detail.status` do corpo — sem isso o
  // painel manda conferir a ELEVENLABS_API_KEY quando o problema é saldo.
  const semCota = motivo === 'quota_exceeded' || status === 429 || /quota/i.test(detalhe);

  if (semCota) {
    detalhe = `créditos esgotados (${detalhe}). Recarregue o plano em elevenlabs.io/app/usage.`;
  } else if (status === 401) {
    detalhe = `chave de API recusada (${detalhe}). Confira ELEVENLABS_API_KEY.`;
  }

  const e = new Error(`ElevenLabs (áudio): ${detalhe}`);
  e.status = status;
  e.semCota = semCota;
  e.original = err;
  return e;
}

export async function gerarAudioBase64(texto) {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) return null;

  try {
    const { data } = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        text: texto,
        model_id: MODEL_ID,
        language_code: 'pt',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.45,
          use_speaker_boost: true,
          speed: 1.0,
        },
      },
      {
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, accept: 'audio/mpeg' },
        responseType: 'arraybuffer',
      }
    );

    return Buffer.from(data).toString('base64');
  } catch (err) {
    throw erroElevenLabs(err);
  }
}
