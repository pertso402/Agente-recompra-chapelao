import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'content-type': 'application/json',
  },
});

function periodoDoDia(hora) {
  if (hora >= 5 && hora < 11) return 'manhã — dia começando, já pensando no que vai comer mais tarde';
  if (hora >= 11 && hora < 15) return 'horário de almoço — decisão de última hora, fome batendo, sem paciência pra cozinhar';
  if (hora >= 15 && hora < 18) return 'meio da tarde — aquele cansaço/tédio que dá vontade de beliscar algo bom';
  if (hora >= 18 && hora < 22) return 'fim do dia — chegando cansado, sem vontade nenhuma de cozinhar ou decidir o que jantar';
  return 'tarde da noite — bateu a fome de quem não jantou direito e só quer resolver rápido';
}

const PROBLEMAS_POR_HORARIO = {
  manha: ['indecisão sobre o que comer mais tarde', 'correria do início do dia'],
  almoco: ['fome forte batendo agora', 'não ter tempo/paciência de cozinhar', 'indecisão do que pedir'],
  tarde: ['cansaço/tédio da tarde', 'vontade de beliscar algo bom'],
  noite: ['chegar cansado do trabalho/dia', 'não ter vontade de cozinhar ou decidir o jantar', 'fome de fim de dia'],
  madrugada: ['fome de quem não jantou direito', 'vontade de resolver rápido sem esforço'],
};

function faixaHorario(hora) {
  if (hora >= 5 && hora < 11) return 'manha';
  if (hora >= 11 && hora < 15) return 'almoco';
  if (hora >= 15 && hora < 18) return 'tarde';
  if (hora >= 18 && hora < 22) return 'noite';
  return 'madrugada';
}

export async function gerarMensagemRecompra({ cliente, ultimoPedido, itens, diasSemComprar, cupom, horaAtual, nicho = 'marmitaria' }) {
  const nomeItens = (itens || []).map((i) => `${i.quantidade}x ${i.nome_produto}`).join(', ') || 'um pedido';
  const hora = horaAtual ?? new Date().getHours();
  const contextoHorario = periodoDoDia(hora);
  const faixa = faixaHorario(hora);
  const problemasProvaveis = PROBLEMAS_POR_HORARIO[faixa].join(' / ');

  const prompt = `Você escreve o roteiro de um ÁUDIO de WhatsApp (a pessoa vai OUVIR, não ler) pra reativar
clientes de um negócio de comida (nicho: ${nicho}). Também escreve um TEXTO curtíssimo que acompanha a
foto/vídeo do prato.

A estrutura do áudio segue uma lógica de PROBLEMA → SOLUÇÃO, como uma pessoa de verdade puxando papo:

1. Abre como um check-in genuíno e casual (tipo "Oi [nome], tudo bem? Como tá sendo seu dia?" ou variação
   natural disso — pode adaptar o texto, não repita sempre a mesma frase).
2. Nomeia, de forma leve e sem forçar, um problema real e provável pro momento atual: ${contextoHorario}.
   Problemas prováveis nesse horário: ${problemasProvaveis}. Escolha o que fizer mais sentido (cansaço,
   correria, não saber o que comer, fome batendo, preguiça de cozinhar, indecisão, etc — adapte à realidade
   do dia a dia da pessoa, não invente detalhes específicos que você não sabe).
3. Conecta esse problema com a SOLUÇÃO: comer é o momento de resolver isso — relaxar, matar a fome, não
   precisar pensar em nada. Aí sim descreve o prato do último pedido de forma apetitosa e sensorial
   (sabor, textura, aroma) como a solução óbvia e prática.
4. Fecha mencionando o cupom de forma natural (não como código de desconto de robô, como se fosse uma
   dica de amigo: "ainda de brinde eu separei um cuponzinho pra você").

Tom: humano, caloroso, conversa de gente normal — igual mensagem de voz que um amigo manda, não anúncio.
Frases curtas, linguagem falada (contrações, "tá", "pra", etc), no máximo 5-6 frases.

PROIBIDO usar (ou variações próximas de):
- "sentimos sua falta" / "sentindo sua falta" / "sentindo falta"
- "mate a saudade" / "matar a saudade"
- "há quanto tempo" / "faz tempo que você não..."
- qualquer coisa que soe como lembrete de CRM, script de vendas ou mensagem de robô
- perguntas repetidas sempre da mesma forma — varie a abertura a cada geração

Dados do cliente:
- Nome: ${cliente.nome}
- Último pedido: ${nomeItens}
- Cupom de desconto: ${cupom.codigo} (${cupom.desconto_percentual}% off, válido até ${cupom.valido_ate})

Retorne um único objeto JSON PLANO (sem aninhamento, sem "version_1"/"version_2", sem chaves extras)
contendo exatamente estas duas chaves:

"audio": o roteiro completo do áudio seguindo a estrutura problema→solução acima.

"cta": uma linha curtíssima (máximo 12 palavras) só com a chamada pra ação — cupom + urgência.
Vai como legenda da foto/vídeo do prato. Exemplo de estilo: "🔥 15% OFF com o cupom ${cupom.codigo} — peça agora!"

Responda APENAS com o JSON plano {"audio": "...", "cta": "..."}, sem markdown, sem explicação.`;

  const { data } = await client.post('/chat/completions', {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    max_tokens: 400,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'mensagem_recompra',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            audio: { type: 'string' },
            cta: { type: 'string' },
          },
          required: ['audio', 'cta'],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: 'user', content: prompt }],
  });

  const resultado = JSON.parse(data.choices[0].message.content);
  return {
    audio: (resultado.audio || '').trim(),
    cta: (resultado.cta || '').trim(),
  };
}
