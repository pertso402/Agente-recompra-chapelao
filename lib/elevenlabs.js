import axios from 'axios';

// Eleven v3 é o modelo mais expressivo da ElevenLabs — entende audio tags
// inline (ex: [warm], [laughs], [sighs]) e pontuação como direção de atuação,
// o que é o que faz o áudio soar humano em vez de locução de robô.
// Diferente dos modelos v2, aqui `stability` aceita só 3 valores:
//   0.0 = Creative (mais emotivo, mais risco de alucinar)
//   0.5 = Natural  (equilibrado — o que usamos)
//   1.0 = Robust   (estável, mas ignora mais as audio tags)
const MODEL_ID = process.env.ELEVENLABS_MODEL || 'eleven_v3';

export async function gerarAudioBase64(texto) {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) return null;

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
}
