import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'content-type': 'application/json',
  },
});

function periodoDoDia(hora) {
  if (hora >= 5 && hora < 11) return 'manhã, provavelmente pensando no almoço que vem';
  if (hora >= 11 && hora < 15) return 'horário de almoço, fome batendo agora';
  if (hora >= 15 && hora < 18) return 'meio da tarde, aquela vontade de beliscar/lanchar';
  if (hora >= 18 && hora < 22) return 'horário de janta, fome de fim de dia';
  return 'tarde da noite, fome de quem não jantou direito';
}

export async function gerarMensagemRecompra({ cliente, ultimoPedido, itens, diasSemComprar, cupom, horaAtual }) {
  const nomeItens = (itens || []).map((i) => `${i.quantidade}x ${i.nome_produto}`).join(', ') || 'um pedido';
  const hora = horaAtual ?? new Date().getHours();
  const contextoHorario = periodoDoDia(hora);

  const prompt = `Você escreve mensagens curtas de WhatsApp pra reativar clientes de uma marmitaria (Chapelão).
O objetivo NÃO é "matar saudade" ou dizer "sentimos sua falta" — isso é clichê, genérico, e não vende.
O objetivo é ativar a FOME REAL que a pessoa está sentindo AGORA, no momento em que ela lê a mensagem,
e conectar essa fome com o prato específico que ela já ama.

PROIBIDO usar (ou variações próximas de):
- "sentimos sua falta" / "sentindo sua falta" / "sentindo falta"
- "mate a saudade" / "matar a saudade"
- "há quanto tempo" / "faz tempo que você não..."
- qualquer coisa que soe como lembrete de CRM ou mensagem de robô

Em vez disso, escreva como se fosse uma pessoa que sabe que o cliente está com fome AGORA e quer
resolver isso rápido com o prato que ele já aprovou. Fale de sabor, textura, aquele prato quentinho,
a conveniência de já saber o que pedir. Foco no desejo imediato, não no tempo que passou.

Contexto de quando a mensagem está sendo enviada: ${contextoHorario}.

Dados do cliente:
- Nome: ${cliente.nome}
- Último pedido: ${nomeItens}
- Cupom de desconto: ${cupom.codigo} (${cupom.desconto_percentual}% off, válido até ${cupom.valido_ate})

Escreva uma mensagem curta (máximo 4 linhas) que:
1. Conecte com a fome/vontade de comer AGORA, ancorada no horário
2. Cite o prato do último pedido de forma apetitosa e específica (não como dado de banco)
3. Inclua o código do cupom de forma clara
4. Tenha um CTA direto e urgente (ex: "peça agora", "chama no zap")

Responda APENAS com o texto da mensagem, sem aspas, sem explicação.`;

  const { data } = await client.post('/chat/completions', {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  return data.choices[0].message.content.trim();
}
