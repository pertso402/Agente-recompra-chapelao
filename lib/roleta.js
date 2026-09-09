// ─── CAMPANHA ROLETA ──────────────────────────────────────────────────────────
// O disparo antigo mandava vídeo + legenda e acabava ali. Aqui ele vira uma
// conversa de duas etapas: primeiro uma PERGUNTA curta em texto, e o link da
// roleta só depois que a pessoa responde.
//
// A troca não é estética. Medindo os disparos de vídeo pela Evolution API, 25
// de 25 foram entregues e só 4 lidos — 84% nunca abriram. Áudio e vídeo de um
// número desconhecido é o formato que o WhatsApp e o próprio usuário tratam
// como spam. Texto curto, identificado e com pergunta é o que tem chance de
// ser lido na notificação, sem nem precisar abrir a conversa.
//
// E a resposta não é só engajamento: ela abre a janela de conversa, o que tira
// a mensagem seguinte (a do link) da categoria de disparo frio.

// A oferta é uma CHANCE real, não uma promessa. "Pode almoçar por nossa conta"
// e "chance de" são verdade com o prêmio raro a ~1%; "vamos pagar o seu almoço"
// não seria, e é a diferença entre uma isca boa e uma pegadinha que queima a
// marca no primeiro cliente que reclamar.
const CONVITES = [
  (nome) => `Oi ${nome}! Aqui é do Chapelão 🎩\n\nE se eu te falar que hoje o seu almoço pode sair por nossa conta? Topa tentar a sua sorte?`,
  (nome) => `${nome}, tudo bem? Aqui é do Chapelão 🎩\n\nSeparei uma chance de o seu almoço de hoje ficar por nossa conta. Quer tentar?`,
  (nome) => `Oi ${nome}, aqui é do Chapelão 🎩\n\nHoje tem uma chance real do seu almoço sair de graça. Posso te mandar?`,
  (nome) => `Oi ${nome}! Chapelão aqui 🎩\n\nTô com uma chance de pagar o seu almoço de hoje. Quer arriscar?`,
];

// Sem nome utilizável, cumprimenta sem citar nome — "Oi Cliente WhatsApp final
// 4829" é pior que não chamar de nada.
const CONVITES_SEM_NOME = [
  () => 'Oi! Aqui é do Chapelão 🎩\n\nE se eu te falar que hoje o seu almoço pode sair por nossa conta? Topa tentar a sua sorte?',
  () => 'Oi, tudo bem? Aqui é do Chapelão 🎩\n\nSeparei uma chance de o seu almoço de hoje ficar por nossa conta. Quer tentar?',
];

const NOMES_GENERICOS = new Set(['desconhecido', 'cliente', 'contato', 'whatsapp', 'lead', 'demo']);

// Mesma regra do áudio: nome de contato do WhatsApp vem com sobrenome, emoji e
// caixa alta ("odety souza", "Amanda Ribeiro❤️"). Só o primeiro nome soa gente.
export function primeiroNome(nome) {
  const limpo = String(nome || '').replace(/[^\p{L}\p{M}\s'-]/gu, ' ').trim();
  if (/^cliente whatsapp final/i.test(String(nome || '').trim())) return null;

  const primeiro = limpo.split(/\s+/)[0] || '';
  if (!primeiro || primeiro.length < 2 || NOMES_GENERICOS.has(primeiro.toLowerCase())) return null;

  return primeiro
    .toLowerCase()
    .replace(/(^|[-'])(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase());
}

// `aleatorio` injetável pra teste determinístico — sem isso não dá pra afirmar
// nada sobre uma função que sorteia.
export function montarConvite(nomeCompleto, aleatorio = Math.random) {
  const nome = primeiroNome(nomeCompleto);
  const lista = nome ? CONVITES : CONVITES_SEM_NOME;
  const escolhido = lista[Math.floor(aleatorio() * lista.length) % lista.length];
  return escolhido(nome);
}

// O `ref` amarra o clique ao disparo que o gerou. Sem ele a sessão da roleta é
// anônima e o funil perde justamente o degrau "abriu o link".
export function montarLinkRoleta(ofertaId, { base = process.env.ROLETA_URL, lote = null } = {}) {
  if (!base) throw new Error('ROLETA_URL não configurada — sem ela o link da roleta sairia quebrado.');

  const url = new URL(base);
  url.searchParams.set('origem', 'recompra');
  url.searchParams.set('ref', ofertaId);
  if (lote) url.searchParams.set('lote', lote);
  return url.toString();
}

const MENSAGENS_LINK = [
  (link) => `Boa! 🎉\n\nÉ só girar a roleta aqui e ver o que você tirou:\n${link}\n\nTem de refrigerante grátis até almoço por nossa conta. O prêmio vale por 7 dias 😉`,
  (link) => `Show! 🎉\n\nGira aqui pra descobrir o seu prêmio:\n${link}\n\nVai de refrigerante grátis a almoço por nossa conta — o seu vale por 7 dias 😉`,
];

export function montarMensagemLink(link, aleatorio = Math.random) {
  const escolhido = MENSAGENS_LINK[Math.floor(aleatorio() * MENSAGENS_LINK.length) % MENSAGENS_LINK.length];
  return escolhido(link);
}

// Lote = mês do disparo. Serve pra comparar rodadas da campanha no painel da
// roleta sem precisar cruzar data na mão.
export function loteDoMes(data = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
  }).format(data).slice(0, 7);
}
