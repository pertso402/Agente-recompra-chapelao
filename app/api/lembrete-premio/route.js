import {
  listarLembretesPremio,
  reivindicarLembretePremio,
  devolverLembretePremio,
  buscarVideoParaLembrete,
} from '../../../lib/supabase';
import { enviarMidia } from '../../../lib/evolution';
import { montarLembrete } from '../../../lib/lembrete';
import { horaSaoPaulo } from '../../../lib/pos-compra';

export const maxDuration = 60;

function autorizado(request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  return (request.headers.get('authorization') || '') === `Bearer ${segredo}`;
}

export async function POST(request) { return executar(request); }
export async function GET(request) { return executar(request); }

async function executar(request) {
  let reivindicado = null;
  try {
    if (!autorizado(request)) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const minutos = Number(url.searchParams.get('minutos')) || 25;

    // A casa fecha às 14h. Lembrete que chega perto disso fala de um prêmio que
    // não dá mais tempo de usar — vira frustração, não venda. Corta às 11h40,
    // que deixa folga pra pedir, a cozinha montar e a entrega sair.
    const hora = horaSaoPaulo();
    const minutoAtual = Number(
      new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', minute: '2-digit' }).format(new Date())
    );
    const minutosDoDia = hora * 60 + minutoAtual;
    if (!url.searchParams.get('forcar') && (minutosDoDia < 10 * 60 || minutosDoDia > 11 * 60 + 40)) {
      return Response.json({ disparou: false, motivo: 'fora_da_janela', relogio: `${hora}:${minutoAtual}` });
    }

    const candidatos = await listarLembretesPremio({ limite: 5, minutos });
    if (!candidatos.length) {
      return Response.json({ disparou: false, motivo: 'ninguem_para_lembrar' });
    }

    const video = await buscarVideoParaLembrete();
    if (!video) {
      return Response.json({ disparou: false, motivo: 'sem_video' });
    }

    // Reivindica ANTES de enviar: perder a corrida significa que outro tick já
    // pegou essa pessoa, e dois lembretes do mesmo prêmio é pior que nenhum.
    let lead = null;
    for (const candidato of candidatos) {
      if (await reivindicarLembretePremio(candidato.resgate_id)) {
        lead = candidato;
        reivindicado = candidato.resgate_id;
        break;
      }
    }
    if (!lead) {
      return Response.json({ disparou: false, motivo: 'todos_ja_reivindicados' });
    }

    await enviarMidia(lead.telefone, {
      url: video.video_url,
      tipo: video.tipo,
      legenda: montarLembrete(lead),
    });

    return Response.json({
      disparou: true,
      lead: { nome: lead.nome, telefone: lead.telefone },
      premio: lead.premio,
      codigo: lead.codigo,
      veio_da_campanha: lead.veio_da_campanha,
      restantes: candidatos.length - 1,
    });
  } catch (err) {
    // Sem devolver, a pessoa ficaria marcada como lembrada sem ter recebido
    // nada — e é uma vez por resgate, então seria pra sempre.
    if (reivindicado) await devolverLembretePremio(reivindicado).catch(() => {});
    console.error('Erro no lembrete de prêmio:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
