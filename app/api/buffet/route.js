import { buscarMidiaDoDia, salvarMidiaDoDia, uploadMidiaBuffet } from '../../../lib/supabase';

export const maxDuration = 60;

const EXTENSAO_POR_MIME = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const TAMANHO_MAXIMO = 50 * 1024 * 1024; // limite do bucket no Supabase

export async function GET() {
  try {
    const midia = await buscarMidiaDoDia();
    return Response.json({ midia });
  } catch (err) {
    console.error('Erro ao buscar mídia do dia:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const arquivo = form.get('arquivo');

    if (!arquivo || typeof arquivo.arrayBuffer !== 'function') {
      return Response.json({ error: 'Envie um arquivo no campo "arquivo".' }, { status: 400 });
    }

    const extensao = EXTENSAO_POR_MIME[arquivo.type];
    if (!extensao) {
      return Response.json(
        { error: `Formato não suportado (${arquivo.type || 'desconhecido'}). Use MP4, MOV, WEBM, JPG, PNG ou WEBP.` },
        { status: 400 }
      );
    }

    if (arquivo.size > TAMANHO_MAXIMO) {
      const mb = (arquivo.size / 1024 / 1024).toFixed(1);
      return Response.json(
        { error: `Arquivo de ${mb}MB excede o limite de 50MB. Grave um vídeo mais curto ou reduza a qualidade.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const videoUrl = await uploadMidiaBuffet({ buffer, contentType: arquivo.type, extensao });

    const tipo = arquivo.type.startsWith('video/') ? 'video' : 'image';
    const midia = await salvarMidiaDoDia({ videoUrl, tipo });

    return Response.json({ sucesso: true, midia });
  } catch (err) {
    console.error('Erro ao subir mídia do buffet:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
