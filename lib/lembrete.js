import { primeiroNome } from './nome';

// ─── LEMBRETE DO PRÊMIO ───────────────────────────────────────────────────────
// A pessoa girou a roleta, ganhou e não veio pedir. Medido: dos 27 que
// resgataram, 15 clicaram pra chamar no WhatsApp e só 1 virou pedido. O maior
// buraco da campanha inteira está entre "tem prêmio na mão" e "fez o pedido".
//
// Vai com vídeo de propósito: o prêmio já foi ganho, então o que falta não é
// incentivo, é vontade de comer agora. Texto sozinho lembra; comida na tela dá
// fome.
//
// A urgência é verdadeira — o prêmio vale até o próximo almoço, e a casa fecha
// às 14h. Não é escassez inventada.
// "seu sobremesa grátis" — o nome do prêmio vem do banco e tem gênero variável
// (sobremesa é feminino, almoço é masculino, refri é masculino). Em vez de
// carregar uma tabela de gênero que quebra no primeiro prêmio novo, as frases
// são construídas pra o prêmio nunca vir precedido de artigo concordado:
// "seu prêmio" é sempre masculino e o nome entra depois, solto.
const LEMBRETES = [
  ({ nome, premio }) =>
    `${nome ? `${nome}, s` : 'S'}eu prêmio tá separado aqui: ${premio} 👀\n\nO almoço de hoje saiu assim ó. Vale até as 14h — me chama que eu já monto a sua.`,
  ({ nome, premio }) =>
    `${nome ? `Ô ${nome}, n` : 'N'}ão esquece: você ganhou ${premio} e ainda dá tempo de usar hoje.\n\nOlha como tá o almoço. Me chama que eu separo a sua.`,
  ({ nome, premio }) =>
    `${nome ? `${nome}, s` : 'S'}eu prêmio ainda tá de pé — ${premio}, só até as 14h.\n\nDá uma olhada no almoço de hoje e me diz se eu já monto a sua.`,
];

// `aleatorio` injetável pra teste determinístico.
export function montarLembrete(lead, aleatorio = Math.random) {
  const nome = primeiroNome(lead.nome);
  // O nome do prêmio vem do banco em caixa de título ("Sobremesa grátis"), e no
  // meio da frase isso soa como etiqueta de sistema.
  const premio = String(lead.premio || 'seu prêmio').toLowerCase();

  const escolhido = LEMBRETES[Math.floor(aleatorio() * LEMBRETES.length) % LEMBRETES.length];
  return escolhido({ nome, premio });
}
