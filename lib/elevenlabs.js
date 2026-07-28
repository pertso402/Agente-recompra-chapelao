import axios from 'axios';

export async function gerarAudioBase64(texto) {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) return null;

  const { data } = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
    { text: texto, model_id: 'eleven_multilingual_v2' },
    {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, accept: 'audio/mpeg' },
      responseType: 'arraybuffer',
    }
  );

  return Buffer.from(data).toString('base64');
}
