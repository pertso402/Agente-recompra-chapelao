// Nome de contato do WhatsApp é bagunçado: vem com sobrenome, emoji e caixa
// alta ("Amanda Ribeiro❤️", "odety souza", "."). Falar o nome inteiro soa como
// cobrança de banco, não como vizinho chamando — só o primeiro nome resolve.
//
// Vive num módulo próprio porque três lugares precisam dela (copy da campanha,
// convite da roleta e gatilho pós-compra) e nenhum deles deveria importar o
// cliente da OpenAI só pra limpar um nome.
const NOMES_GENERICOS = new Set(['desconhecido', 'cliente', 'contato', 'whatsapp', 'lead', 'demo']);

export function primeiroNome(nome) {
  const bruto = String(nome || '').trim();
  // Placeholder do WhatsApp não é nome: cumprimentar "Cliente WhatsApp final
  // 4829" entrega o disparo automático na primeira linha.
  if (/^cliente whatsapp final/i.test(bruto)) return null;

  // Remove emoji e símbolos, preservando acentuação do português.
  const limpo = bruto.replace(/[^\p{L}\p{M}\s'-]/gu, ' ').trim();

  const primeiro = limpo.split(/\s+/)[0] || '';
  if (!primeiro || primeiro.length < 2 || NOMES_GENERICOS.has(primeiro.toLowerCase())) return null;

  // "odety" → "Odety", "MULTLUB" → "Multlub": caixa alta vira grito no TTS e
  // parece etiqueta de sistema no texto. Cada parte de nome composto entra
  // maiúscula, senão "Ana-Clara" volta como "Ana-clara".
  return primeiro
    .toLowerCase()
    .replace(/(^|[-'])(\p{L})/gu, (_, separador, letra) => separador + letra.toUpperCase());
}
