import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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

  const { data } = await client.post('/chat/completions', {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  return data.choices[0].message.content.trim();
}
