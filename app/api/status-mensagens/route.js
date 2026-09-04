import {
  listarOfertasSemStatusFinal,
  atualizarStatusEntrega,
  marcarStatusChecado,
} from '../../../lib/supabase';
import { consultarStatusMensagem } from '../../../lib/evolution';

// Cada consulta é uma chamada à Evolution (~200ms). O lote é limitado pra caber
// com folga no teto de 60s do plano, e o que sobrar entra na execução seguinte —
// a fila é sempre pequena porque só ofertas dos últimos dias são reavaliadas.
export const maxDuration = 60;

const LOTE = 45;

// Mesma proteção de /api/campanha: a rota fica fora da senha do painel porque
// quem chama é o pg_cron, que não faz login. Falha fechado sem o segredo.
function autorizado(request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  return (request.headers.get('authorization') || '') === `Bearer ${segredo}`;
}

export async function POST(request) {
  return executar(request);
}

export async function GET(request) {
  return executar(request);
}

async function executar(request) {
  try {
    if (!autorizado(request)) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const pendentes = await listarOfertasSemStatusFinal({ limite: LOTE });
    if (!pendentes.length) {
      return Response.json({ checadas: 0, motivo: 'nada_pendente' });
    }

    const contagem = { enviada: 0, entregue: 0, lida: 0, falhou: 0, sem_ack: 0 };
    const erros = [];

    for (const oferta of pendentes) {
      try {
        const resultado = await consultarStatusMensagem(oferta.whatsapp_message_id);

        if (!resultado) {
          // A Evolution ainda não registrou ACK nenhum. Marca a checagem pra
          // não repetir a mesma consulta em sequência, mas mantém pendente.
          await marcarStatusChecado(oferta.id);
          contagem.sem_ack += 1;
          continue;
        }

        contagem[resultado.status] = (contagem[resultado.status] || 0) + 1;

        // Só grava quando o estágio de fato avançou — regravar o mesmo status
        // sujaria entregue_em/lida_em com o horário da última varredura.
        if (resultado.status !== oferta.status_entrega) {
          await atualizarStatusEntrega(oferta.id, resultado.status);
        } else {
          await marcarStatusChecado(oferta.id);
        }
      } catch (err) {
        // Uma mensagem problemática não pode derrubar o lote inteiro: o valor
        // desta rota está em varrer o máximo possível a cada execução.
        erros.push({ oferta: oferta.id, erro: err.message });
      }
    }

    return Response.json({
      checadas: pendentes.length,
      contagem,
      erros: erros.length ? erros.slice(0, 5) : undefined,
      totalErros: erros.length || undefined,
    });
  } catch (err) {
    console.error('Erro ao consultar status de mensagens:', err);
    return Response.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
