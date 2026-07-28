import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.anthropic.com/v1',
  headers: {
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
});

export async function gerarMensagemRecompra({ cliente, ultimoPedido, itens, diasSemComprar, cupom }) {
  const nomeItens = (itens || []).map((i) => `${i.quantidade}x ${i.nome_produto}`).join(', ') || 'um pedido';

  const prompt = `Você escreve mensagens curtas de WhatsApp para reativar clientes de uma marmitaria (Chapelão).
Tom: humano, caloroso, direto — nunca robótico, nunca genérico, sem exagero de emoji.

Dados do cliente:
- Nome: ${cliente.nome}
- Dias sem comprar: ${diasSemComprar}
- Último pedido: ${nomeItens}
- Cupom de desconto: ${cupom.codigo} (${cupom.desconto_percentual}% off, válido até ${cupom.valido_ate})

Escreva uma mensagem curta (máximo 4 linhas) que:
1. Cite o último pedido de forma natural (não pareça extraído de banco de dados)
2. Crie desejo/oportunidade de pedir de novo
3. Inclua o código do cupom de forma clara
4. Tenha um CTA simples

Responda APENAS com o texto da mensagem, sem aspas, sem explicação.`;

  const { data } = await client.post('/messages', {
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  return data.content[0].text.trim();
}
