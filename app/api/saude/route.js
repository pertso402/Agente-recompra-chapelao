export const dynamic = 'force-dynamic';

// Diagnóstico de configuração. Existe porque "a campanha parou" já foi causado
// três vezes por variável de ambiente ausente, e descobrir isso exigia ler log
// ou disparar um teste. Aqui é um clique.
//
// NUNCA devolve valor de variável, só se ela existe e o tamanho — o suficiente
// pra diferenciar "não cadastrei" de "cadastrei errado/vazio".
const OBRIGATORIAS = [
  ['SUPA_URL', 'banco'],
  ['SUPA_SERVICE_KEY', 'banco'],
  ['EVOLUTION_URL', 'whatsapp'],
  ['EVOLUTION_KEY', 'whatsapp (chip de disparo)'],
  ['EVOLUTION_INSTANCE', 'whatsapp (chip de disparo)'],
  ['CRON_SECRET', 'segurança das rotas de máquina'],
  ['OPENAI_API_KEY', 'copy do modo vídeo'],
  ['ROLETA_URL', 'link da roleta no modo roleta'],
];

const OPCIONAIS = [
  ['EVOLUTION_KEY_PRINCIPAL', 'notificação de status pelo número principal'],
  ['EVOLUTION_INSTANCE_PRINCIPAL', 'notificação de status pelo número principal'],
  ['PANEL_PASSWORD', 'senha do painel'],
];

function estado(lista) {
  return lista.map(([nome, pra_que]) => {
    const v = process.env[nome];
    return {
      variavel: nome,
      pra_que,
      status: v ? `ok (${v.length} caracteres)` : 'FALTANDO',
    };
  });
}

export async function GET() {
  const obrigatorias = estado(OBRIGATORIAS);
  const faltando = obrigatorias.filter((v) => v.status === 'FALTANDO').map((v) => v.variavel);

  return Response.json({
    ok: faltando.length === 0,
    faltando,
    obrigatorias,
    opcionais: estado(OPCIONAIS),
    // Este é o erro mais comum aqui: a variável é cadastrada e nada muda,
    // porque o deploy que está servindo foi criado antes dela existir.
    lembrete: faltando.length
      ? 'Variável nova NÃO entra em deploy que já existe. Depois de cadastrar na Vercel, vá em Deployments e use Redeploy.'
      : undefined,
  });
}
