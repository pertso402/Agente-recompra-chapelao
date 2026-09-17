import { primeiroNome } from './nome';

// ─── GATILHO PÓS-PRIMEIRA-COMPRA ──────────────────────────────────────────────
// Quem comprou UMA vez e não voltou é o público mais valioso e menos trabalhado
// da casa: quem volta gasta ~R$104 no total contra ~R$36 de quem veio uma vez
// só. Cada pessoa convertida de 1x pra 2x vale ~R$68.
//
// Diferença crucial pro resto da campanha: esta mensagem sai do número
// PRINCIPAL, o mesmo onde a pessoa já fez o pedido. Não existe aqui o problema
// que derruba o número de disparo (medido: 84% nunca abriram) — ela reconhece
// o remetente porque já conversou com ele.

// A casa serve até as 14h. Antes disso o brinde vale hoje; depois, amanhã —
// senão a pessoa recebe um cupom que já nasce morto.
const FIM_DO_ALMOCO = 14;

export function horaSaoPaulo(agora = new Date()) {
  return Number(
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(agora)
  );
}

export function diasDeValidade(agora = new Date()) {
  return horaSaoPaulo(agora) < FIM_DO_ALMOCO ? 0 : 1;
}

// "Costela assada, Paleta Suina ao Molho" -> "costela assada e paleta suína ao
// molho". Vem de itens_pedido.observacao, que guarda o que a pessoa realmente
// escolheu — é o que deixa a mensagem específica em vez de genérica.
export function carnesEmPalavras(carnes) {
  const lista = String(carnes || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    // Remove parênteses explicativos do cardápio ("Frango assado (coxa/sobrecoxa)"),
    // que ninguém fala em voz alta.
    .map((c) => c.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase())
    .filter(Boolean);

  if (!lista.length) return null;
  if (lista.length === 1) return lista[0];
  return `${lista[0]} e ${lista[1]}`;
}

const COM_PRATO = [
  ({ nome, prato, brinde }) =>
    `Oi${nome ? ` ${nome}` : ''}! 🎩\n\nVocê pediu aquela marmita de ${prato} aqui com a gente e não voltou mais.\n\nHoje o almoço tá pronto e eu separei ${brinde} por nossa conta — mas vale só pra hoje. Bora?`,
  ({ nome, prato, brinde }) =>
    `Oi${nome ? ` ${nome}` : ''}, tudo bem? 🎩\n\nLembrei de você: da última vez foi ${prato}.\n\nSe quiser repetir hoje, ${brinde} fica por nossa conta. Só hoje, viu?`,
];

const SEM_PRATO = [
  ({ nome, tamanho, brinde }) =>
    `Oi${nome ? ` ${nome}` : ''}! 🎩\n\nVocê pediu sua marmita${tamanho ? ` ${tamanho}` : ''} aqui com a gente e não voltou mais.\n\nHoje o almoço tá pronto e separei ${brinde} por nossa conta — vale só hoje. Bora?`,
  ({ nome, brinde }) =>
    `Oi${nome ? ` ${nome}` : ''}, tudo bem? 🎩\n\nFaz um tempinho que você não pede sua marmita com a gente.\n\nSe vier hoje, ${brinde} fica por nossa conta. Só hoje 😉`,
];

// `aleatorio` injetável pra teste determinístico.
export function montarMensagemPosCompra(lead, brinde, aleatorio = Math.random) {
  const nome = primeiroNome(lead.nome);
  const prato = carnesEmPalavras(lead.carnes);
  const tamanho = (lead.tamanho || '').trim();

  const lista = prato ? COM_PRATO : SEM_PRATO;
  const escolhido = lista[Math.floor(aleatorio() * lista.length) % lista.length];

  return escolhido({ nome, prato, tamanho, brinde });
}
