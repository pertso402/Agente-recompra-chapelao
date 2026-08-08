import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'content-type': 'application/json',
  },
});

// Hora no fuso de Brasília — o servidor roda em UTC, então new Date().getHours()
// sozinho daria a hora errada (ex: 13h em SP lido como 16h). Sem isso, chamadas
// que não passam horaAtual explicitamente saem do range "almoço" por engano.
function horaSaoPauloAgora() {
  return Number(
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date())
  );
}

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
  const hora = horaAtual ?? horaSaoPauloAgora();
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

// ─── CAMPANHA DE PRIMEIRA COMPRA (BRINDE) ────────────────────────────────────
// Diferente da recompra clássica: aqui nunca há um "último pedido" real pra
// citar (mesmo pra quem já é cliente — tag ja_comprou não tem pedido detalhado
// no sistema, só a tag), então a âncora é sempre o vídeo do buffet de hoje +
// o brinde. O que muda por público é só a RELAÇÃO com a casa (ver `segmento`
// e CONTEXTO_POR_SEGMENTO acima) — sem isso, um cliente de verdade recebe
// mensagem dizendo "nunca comprou aqui", o que é factualmente errado.

// A campanha manda a mesma oferta (brinde) pra 3 públicos com relação diferente
// com a casa, e a copy PRECISA refletir isso — dizer "nunca comprou aqui" pra
// alguém que já é cliente de verdade soa como erro de cadastro, não como
// atenção. 'segmento' muda só o bloco de contexto/relação, não a estrutura
// problema→solução nem o brinde.
const CONTEXTO_POR_SEGMENTO = {
  // Tag lead_frio: nunca comprou, nunca interagiu. É o caso original.
  frio: (restaurante) => `CONTEXTO CRÍTICO: esta pessoa NUNCA comprou aqui ainda. É o primeiro contato.
- NÃO invente histórico ("aquele seu pedido de sempre", "seu prato favorito", "que bom te ver de novo").
- NÃO diga que sentiu falta nem que faz tempo — nunca houve pedido nenhum.
- Como ela pode não saber quem está falando, diga com naturalidade que é do ${restaurante} logo no começo.
- O convite é pra EXPERIMENTAR pela primeira vez, não pra "voltar".`,

  // Tag interessado: já mandou mensagem/demonstrou interesse (ex: respondeu
  // anúncio), mas nunca chegou a pedir. Não é "primeiro contato", mas também
  // não é cliente — não pode dizer que ela já comprou.
  interessado: (restaurante) => `CONTEXTO CRÍTICO: esta pessoa já demonstrou interesse antes (mandou mensagem,
respondeu um anúncio), mas NUNCA chegou a fazer um pedido de verdade.
- NÃO diga "primeiro contato" nem aja como se ela nunca tivesse ouvido falar do ${restaurante}.
- NÃO diga que ela já comprou, nem cite "seu pedido" — isso nunca aconteceu.
- Pode reconhecer de leve que vocês já se falaram antes, sem ser específico ou parecer que está
  vigiando ("oi, sei que já trocamos uma ideia por aqui" é ok; detalhe específico da conversa não é).
- O convite é pra ela finalmente topar fazer o primeiro pedido de verdade.`,

  // Tag ja_comprou: cliente de verdade, já comeu no restaurante antes. Aqui o
  // brinde é agradecimento/incentivo de volta, NUNCA moldado como "primeira
  // compra" — isso soaria como erro de sistema pra quem já é cliente.
  cliente: (restaurante) => `CONTEXTO CRÍTICO: esta pessoa JÁ É CLIENTE — já comeu comida do ${restaurante} antes.
- NÃO diga "primeira vez", "nunca comprou", "venha conhecer" ou qualquer coisa que sugira que ela
  nunca pediu aqui — isso é factualmente errado e soa como erro de cadastro pra quem já é cliente.
- NÃO tem detalhe do pedido anterior disponível (não invente prato específico) — trate como alguém
  que já é da casa, sem citar detalhe que você não sabe.
- Fale como quem tá com saudade de receber o pedido dela nesse horário de correria de almoço de novo.
- O brinde aqui é um "obrigado por ser cliente" / incentivo de voltar a pedir logo, não "cortesia de
  boas-vindas pra quem tá conhecendo agora".`,
};

export async function gerarMensagemPrimeiraCompra({
  cliente,
  brinde,
  cupom,
  restaurante = 'Chapelão',
  cidade = 'Umuarama',
  segmento = 'frio',
}) {
  const contexto = (CONTEXTO_POR_SEGMENTO[segmento] || CONTEXTO_POR_SEGMENTO.frio)(restaurante);

  const prompt = `Você escreve o roteiro de um ÁUDIO de WhatsApp (a pessoa vai OUVIR) para um restaurante
de comida caseira: ${restaurante}, em ${cidade}. Também escreve um TEXTO curtíssimo que
acompanha o VÍDEO REAL do buffet de hoje, que é enviado junto.

## QUEM É A PESSOA (persona-alvo desta campanha, sempre a mesma)
Alguém CLT (emprego registrado, horário fixo), com pouco tempo de almoço — geralmente uma pausa
curta. Ela está com fome AGORA, no meio do expediente, e precisa decidir rápido entre três saídas
ruins:
1. Comer besteira na rua (lanche, fast-food) só porque é rápido, mesmo sem ser o que ela queria.
2. Ir pra casa almoçar — mas o deslocamento (trânsito, ida e volta) não compensa numa pausa curta,
   ela gastaria o horário todo só se locomovendo, sem tempo de comer com calma.
3. Segurar a fome e aguentar mal-alimentada até a noite.

O ${restaurante} resolve isso: comida caseira de verdade, pronta, pertinho, sem precisar cozinhar
nem perder a pausa toda se deslocando. Ela pede, resolve o almoço na hora certa, sem abrir mão de
comer bem.

ISSO É SEMPRE HORÁRIO DE ALMOÇO — esta campanha só dispara entre 11h e 14h. A mensagem tem que soar
como algo que chega bem na hora em que a fome bate e a decisão do almoço precisa ser tomada JÁ.
NUNCA mencione noite, jantar, fim de expediente ou qualquer horário que não seja o almoço.

${contexto}

Estrutura do áudio (problema → solução):
1. Cumprimenta pelo nome e se identifica como sendo do ${restaurante}, de forma leve e humana.
2. Nomeia o dilema do almoço curto de forma natural, sem soar como discurso de marketing — a correria
   de decidir rápido o que comer, sem tempo de ir em casa, sem vontade de comer besteira de novo. Varie
   como fala isso a cada geração (não repita sempre as mesmas palavras), mas mantenha a ideia central:
   pouco tempo, fome de verdade, decisão que precisa ser rápida.
3. Aponta a comida como solução prática: buffet caseiro, feito hoje, prontinho, resolve o almoço rápido
   e sem esforço — sem abrir mão de comer de verdade. Menciona que está mandando o vídeo do buffet de
   hoje pra pessoa ver a comida de verdade.
4. Fecha oferecendo ${brinde} de brinde, do jeito que fizer sentido pro contexto de relação com a
   pessoa descrito acima (primeira vez / voltar a topar / agradecimento por já ser cliente). Fale como
   um empurrãozinho a mais, não como promoção agressiva de vendas.

Tom: humano, caloroso, gente do bairro convidando — não telemarketing, não anúncio.
Frases curtas, linguagem falada ("tá", "pra", "cê", "né", "olha"), no máximo 5-6 frases.

PROIBIDO:
- "sentimos sua falta", "matar a saudade", "faz tempo que você não..."
- qualquer menção a noite, jantar ou fim de expediente — é sempre horário de almoço
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
- Brinde oferecido: ${brinde}
- Código do cupom: ${cupom.codigo}

Retorne um único objeto JSON PLANO (sem aninhamento, sem chaves extras) com exatamente:

"audio": o roteiro completo do áudio, com as audio tags e pausas. Sem emoji.

"cta": uma linha curtíssima (máximo 14 palavras) que acompanha o vídeo do buffet: o brinde + o código
do cupom + chamada pra pedir. É TEXTO puro, sem audio tags, pode ter emoji.
Exemplo de estilo: "🍽️ Buffet de hoje! Ganhe ${brinde} — cupom ${cupom.codigo}"

Responda APENAS com o JSON plano {"audio": "...", "cta": "..."}, sem markdown, sem explicação.`;

  return gerarAudioECta(prompt);
}
