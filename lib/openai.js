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

  const prompt = `Você escreve mensagens de WhatsApp pra reativar clientes de uma marmitaria (Chapelão).
A mensagem vai sair em DUAS partes: um ÁUDIO (a pessoa ouve) e um TEXTO curto que acompanha a foto do prato.
O objetivo NÃO é "matar saudade" ou dizer "sentimos sua falta" — isso é clichê, genérico, e não vende.
O objetivo é ativar a FOME REAL que a pessoa está sentindo AGORA, no momento em que ela recebe a mensagem,
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

Gere DUAS versões da mensagem, retornando um JSON com exatamente estas chaves:

"audio": o texto completo que vai ser narrado em áudio (fala natural, como se fosse uma pessoa falando,
até 4 frases curtas). Conecte com a fome/vontade de comer AGORA ancorada no horário, descreva o prato do
último pedido de forma apetitosa e sensorial (sabor, textura, aroma), e feche mencionando o cupom.

"cta": uma linha curtíssima (máximo 12 palavras) só com a chamada pra ação — cupom + urgência.
Vai como legenda da foto do prato. Exemplo de estilo: "🔥 15% OFF com o cupom ${cupom.codigo} — peça agora!"

Responda APENAS com o JSON, sem markdown, sem explicação.`;

  const { data } = await client.post('/chat/completions', {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });

  const resultado = JSON.parse(data.choices[0].message.content);
  return {
    audio: (resultado.audio || '').trim(),
    cta: (resultado.cta || '').trim(),
  };
}
