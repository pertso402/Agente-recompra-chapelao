// Regras de ritmo da campanha diária.
//
// A meta é espalhar N disparos numa janela (ex: 20 entre 11h e 14h) em
// intervalos que não pareçam automáticos. Em vez de sortear horários fixos no
// começo do dia — o que exigiria guardar estado entre execuções serverless —
// cada tick do cron decide sozinho se dispara agora, comparando quantos já
// saíram com quantos "deveriam" ter saído a esta altura da janela.
//
// Isso é auto-corretivo: se o cron falhar ou a janela começar atrasada, os
// ticks seguintes recuperam o atraso sozinhos, e no fim da janela a meta é
// garantida.

export const JANELA_INICIO = 10.5; // 10:30
export const JANELA_FIM = 14; // 14:00
export const META_DIARIA = 40;
export const FUSO = 'America/Sao_Paulo';

// Piso real de espaçamento entre duas mensagens, em minutos — não é sugestão,
// é limite duro. Existe pra cobrir o caso da "reta final" (abaixo), que abre
// mão do jitter de propósito pra garantir a meta: sem este piso, uma correria
// nos últimos 10% da janela poderia mandar várias mensagens quase juntas
// (tick a cada 5min), o que é exatamente o padrão que dá risco de ban.
//
// 40 msgs em 3h30 (210min) exige ~1 a cada 5,25min — matematicamente incompatível
// com uma folga de segurança confortável (o piso de 6min usado quando a meta era
// 20 já reduzia o alcançado pra ~16-18). Decisão explícita do dono: manter a
// janela 10:30-14h e a meta em 40, aceitando que o piso cai pra praticamente o
// mesmo intervalo do tick do cron (5min) — a garantia de espaçamento fica bem
// mais fraca que o piso de 6min anterior. Registrado aqui pra não parecer
// acidental se alguém for mexer nisso depois.
export const MIN_INTERVALO_MINUTOS = 5;

// Hora/minuto no fuso do restaurante — o servidor da Vercel roda em UTC, então
// ler new Date().getHours() daria 3h de diferença e a campanha dispararia fora
// do horário do almoço.
export function agoraNoFuso(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(agora);

  const hora = Number(partes.find((p) => p.type === 'hour').value);
  const minuto = Number(partes.find((p) => p.type === 'minute').value);
  return { hora, minuto, minutosDoDia: hora * 60 + minuto };
}

export function dentroDaJanela(agora = new Date()) {
  const { minutosDoDia } = agoraNoFuso(agora);
  return minutosDoDia >= JANELA_INICIO * 60 && minutosDoDia < JANELA_FIM * 60;
}

// Fração da janela já decorrida (0 no início, 1 no fim).
export function fracaoDecorrida(agora = new Date()) {
  const { minutosDoDia } = agoraNoFuso(agora);
  const inicio = JANELA_INICIO * 60;
  const total = (JANELA_FIM - JANELA_INICIO) * 60;
  return Math.min(1, Math.max(0, (minutosDoDia - inicio) / total));
}

// Decide se este tick deve disparar.
//
// `aleatorio` é injetável pra permitir teste determinístico — sem isso não dá
// pra verificar o comportamento de uma função que depende de Math.random.
export function deveDispararAgora({
  enviadosHoje,
  meta = META_DIARIA,
  agora = new Date(),
  aleatorio = Math.random,
  minutosDesdeUltimoEnvio = Infinity,
}) {
  if (enviadosHoje >= meta) {
    return { disparar: false, motivo: 'meta_diaria_atingida' };
  }
  if (!dentroDaJanela(agora)) {
    return { disparar: false, motivo: 'fora_da_janela' };
  }

  // Piso duro: nada supera isso, nem a reta final. Roda ANTES de qualquer
  // outra decisão de propósito.
  if (minutosDesdeUltimoEnvio < MIN_INTERVALO_MINUTOS) {
    return { disparar: false, motivo: 'intervalo_minimo', minutosDesdeUltimoEnvio };
  }

  const f = fracaoDecorrida(agora);

  // Reta final: garante a meta mesmo que os ticks anteriores tenham pulado.
  if (f >= 0.9) {
    return { disparar: true, motivo: 'reta_final' };
  }

  // Quantos deveriam ter saído a esta altura, com deslocamento aleatório de
  // até ±1 envio — é o que quebra a regularidade e faz os intervalos variarem.
  const jitter = aleatorio() * 2 - 1;
  const alvo = Math.round(meta * f + jitter);

  if (enviadosHoje >= alvo) {
    return { disparar: false, motivo: 'adiantado_para_o_horario', alvo, f };
  }

  // Atraso de apenas 1 envio: pula às vezes, pra não virar cadência fixa.
  // O atraso é recuperado nos ticks seguintes, então a meta não é ameaçada.
  if (alvo - enviadosHoje === 1 && aleatorio() < 0.25) {
    return { disparar: false, motivo: 'pulo_aleatorio', alvo, f };
  }

  return { disparar: true, motivo: 'no_ritmo', alvo, f };
}
