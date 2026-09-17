import { primeiroNome } from './nome';

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

// A ordem das frases é o que decide se a mensagem é lida. A primeira linha é o
// que aparece na notificação do celular, sem abrir a conversa — então ela
// precisa carregar o BENEFÍCIO e o NOME, não a apresentação.
//
// A versão anterior abria com "Oi Fulano! Chapelão aqui": gastava a linha mais
// valiosa dizendo quem somos, que é justamente o que faz a pessoa ignorar. A
// casa se identifica na segunda linha, depois do gancho ter ganhado a atenção.
//
// Sem emoji: em disparo de número desconhecido ele não decora, sinaliza massa.
const CONVITES = [
  (nome) => `Quer almoçar de graça hoje, ${nome}?\n\nÉ o Chapelão. Responde aí que eu te conto como.`,
  (nome) => `${nome}, quer almoçar de graça hoje?\n\nAqui é o Chapelão. Me responde que eu te explico.`,
  (nome) => `Quer almoçar de graça hoje, ${nome}?\n\nÉ o Chapelão aqui. Responde que eu te mostro.`,
];

// Sem nome utilizável, o gancho segue na frente — só perde a personalização.
const CONVITES_SEM_NOME = [
  () => `Quer almoçar de graça hoje?\n\nÉ o Chapelão. Responde aí que eu te conto como.`,
  () => `Quer almoçar de graça hoje?\n\nAqui é o Chapelão. Me responde que eu te explico.`,
];

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
//
// Vai o código CURTO, não o UUID: o link antigo tinha 100 caracteres
// (`?origem=recompra&ref=<uuid>&lote=2026-09`) e num WhatsApp de número
// desconhecido isso parece rastreador — link comprido derruba clique.
// `origem` e `lote` saíram porque são deriváveis do outro lado: se veio `r`, a
// origem é recompra, e o lote é o mês da sessão.
export function montarLinkRoleta(refCurto, { base = process.env.ROLETA_URL } = {}) {
  if (!base) throw new Error('ROLETA_URL não configurada — sem ela o link da roleta sairia quebrado.');
  if (!refCurto) throw new Error('Sem ref_curto o clique não teria como ser atribuído ao disparo.');

  const url = new URL(base);
  url.searchParams.set('r', refCurto);
  return url.toString();
}

// O texto do prêmio tem que bater com a validade real do cupom, que passou a
// ser o PRÓXIMO ALMOÇO (ver validoAteProximoAlmoco na roleta). A versão
// anterior prometia 7 dias — prazo que não existe mais, e promessa vencida na
// hora de usar é o que queima a confiança que a campanha inteira tenta criar.
//
// A faixa de prêmios citada também acompanha o que está ativo hoje: sobremesa,
// refri e o almoço raro. Nada de sorvete, que saiu da roda.
const MENSAGENS_LINK = [
  (link) => `Boa!\n\nGira aqui e vê o que você tirou:\n${link}\n\nTem de sobremesa a almoço por nossa conta — e vale pro almoço de hoje.`,
  (link) => `Show!\n\nÉ só girar pra descobrir o seu prêmio:\n${link}\n\nVai de sobremesa grátis a almoço por nossa conta. Vale pro almoço de hoje.`,
];

export function montarMensagemLink(link, aleatorio = Math.random) {
  const escolhido = MENSAGENS_LINK[Math.floor(aleatorio() * MENSAGENS_LINK.length) % MENSAGENS_LINK.length];
  return escolhido(link);
}

