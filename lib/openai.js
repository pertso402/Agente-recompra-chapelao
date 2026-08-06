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
Frases curtas, linguagem falada (contrações, "tá", "pra", "cê", "né", etc), no máximo 5-6 frases.

## COMO ESCREVER PRO ÁUDIO SOAR HUMANO (importante)
O texto do áudio é lido por um motor de voz (ElevenLabs v3) que INTERPRETA marcações de atuação
e pontuação. Escreva como roteiro falado, não como texto formal:

- Use audio tags entre colchetes pra dirigir a emoção, no máximo 3-4 no total, sempre ANTES da frase
  que elas afetam. Tags úteis: [warm] [friendly] [thoughtful] [excited] [laughs] [sighs] [whispers]
  [curious] [reassuring]. Ex: "[warm] Oi Eduardo, tudo bem?"
- Use reticências (...) pra dar respiro e pausa natural no meio da fala.
- Use vírgulas de verdade, do jeito que a pessoa respira falando.
- Pode usar hesitações naturais da fala ("ó", "olha", "então", "sabe?", "ãh") com moderação — é isso
  que quebra a sensação de locutor lendo um script.
- NÃO use emoji no áudio (o motor lê ou engasga neles). Emoji só no CTA.
- NÃO escreva o cupom letra por letra; escreva o código normal (ex: "TOPA45").

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

"audio": o roteiro completo do áudio seguindo a estrutura problema→solução acima, COM as audio tags
e pausas descritas na seção anterior. Sem emoji.

"cta": uma linha curtíssima (máximo 12 palavras) só com a chamada pra ação — cupom + urgência.
Vai como legenda da foto/vídeo do prato, é TEXTO puro: sem audio tags, pode ter emoji.
Exemplo de estilo: "🔥 15% OFF com o cupom ${cupom.codigo} — peça agora!"

Responda APENAS com o JSON plano {"audio": "...", "cta": "..."}, sem markdown, sem explicação.`;

  return gerarAudioECta(prompt);
}

// Chamada única ao modelo + sanitização, compartilhada pelos geradores de copy.
async function gerarAudioECta(prompt) {
  const { data } = await client.post('/chat/completions', {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    max_tokens: 400,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'mensagem_whatsapp',
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

  // O CTA é texto que o cliente LÊ no WhatsApp. Se o modelo escorregar e
  // deixar uma audio tag ali, ela apareceria literalmente como "[warm]" na
  // legenda — então limpa por garantia, sem depender só do prompt.
  const cta = (resultado.cta || '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    audio: (resultado.audio || '').trim(),
    cta,
  };
}

// ─── CAMPANHA DE PRIMEIRA COMPRA ──────────────────────────────────────────────
// Diferente da recompra: aqui o contato NUNCA comprou, então não existe último
// pedido pra citar e o áudio não pode fingir intimidade. A âncora é o vídeo do
// buffet de hoje (comida real, recém-feita) + o brinde de primeira compra.

export async function gerarMensagemPrimeiraCompra({
  cliente,
  brinde,
  cupom,
  restaurante = 'Chapelão',
  cidade = 'Umuarama',
  horaAtual,
}) {
  const hora = horaAtual ?? new Date().getHours();
  const contextoHorario = periodoDoDia(hora);
  const problemasProvaveis = PROBLEMAS_POR_HORARIO[faixaHorario(hora)].join(' / ');

  const prompt = `Você escreve o roteiro de um ÁUDIO de WhatsApp (a pessoa vai OUVIR) para um restaurante
de comida caseira: ${restaurante}, uma marmitaria em ${cidade}. Também escreve um TEXTO curtíssimo que
acompanha o VÍDEO REAL do buffet de hoje, que é enviado junto.

CONTEXTO CRÍTICO: esta pessoa NUNCA comprou aqui ainda. É o primeiro contato.
- NÃO invente histórico ("aquele seu pedido de sempre", "seu prato favorito", "que bom te ver de novo").
- NÃO diga que sentiu falta nem que faz tempo — nunca houve pedido nenhum.
- Como ela pode não saber quem está falando, diga com naturalidade que é do ${restaurante} logo no começo.
- O convite é pra EXPERIMENTAR pela primeira vez, não pra "voltar".

Estrutura do áudio (problema → solução):
1. Cumprimenta pelo nome e se identifica como sendo do ${restaurante}, de forma leve e humana.
2. Nomeia um problema real e provável pro momento: ${contextoHorario}.
   Problemas prováveis agora: ${problemasProvaveis}. Escolha um que faça sentido, sem inventar detalhes
   específicos da vida da pessoa que você não sabe.
3. Aponta a comida como solução prática: buffet caseiro, feito hoje, quentinho, resolve o almoço sem
   esforço. Menciona que está mandando o vídeo do buffet de hoje pra pessoa ver a comida de verdade.
4. Fecha com a oferta de primeira compra: no primeiro pedido leva ${brinde} de brinde. Fale como cortesia
   da casa pra pessoa experimentar, não como promoção agressiva de vendas.

Tom: humano, caloroso, gente do bairro convidando — não telemarketing, não anúncio.
Frases curtas, linguagem falada ("tá", "pra", "cê", "né", "olha"), no máximo 5-6 frases.

PROIBIDO:
- "sentimos sua falta", "matar a saudade", "faz tempo que você não..."
- qualquer coisa que soe como robô, CRM ou script de televendas
- prometer prazo, preço ou item que não foi informado aqui
- repetir sempre a mesma abertura — varie a cada geração

## COMO ESCREVER PRO ÁUDIO SOAR HUMANO
O texto é lido pelo ElevenLabs v3, que INTERPRETA marcações de atuação:
- Use no máximo 3-4 audio tags entre colchetes, antes da frase que elas afetam.
  Úteis: [warm] [friendly] [thoughtful] [excited] [laughs] [reassuring].
- Use reticências (...) pra dar respiro e pausa natural.
- Hesitações naturais da fala ("ó", "olha", "então", "sabe?") com moderação.
- NÃO use emoji no áudio. Emoji só no CTA.

Dados:
- Nome da pessoa: ${cliente.nome}
- Brinde de primeira compra: ${brinde}
- Código do cupom: ${cupom.codigo}

Retorne um único objeto JSON PLANO (sem aninhamento, sem chaves extras) com exatamente:

"audio": o roteiro completo do áudio, com as audio tags e pausas. Sem emoji.

"cta": uma linha curtíssima (máximo 14 palavras) que acompanha o vídeo do buffet: o brinde + o código
do cupom + chamada pra pedir. É TEXTO puro, sem audio tags, pode ter emoji.
Exemplo de estilo: "🍽️ Buffet de hoje! 1º pedido leva ${brinde} — cupom ${cupom.codigo}"

Responda APENAS com o JSON plano {"audio": "...", "cta": "..."}, sem markdown, sem explicação.`;

  return gerarAudioECta(prompt);
}
