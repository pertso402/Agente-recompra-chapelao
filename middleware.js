import { NextResponse } from 'next/server';

// A demo de prospecção fica fora da senha: ela é aberta na frente do lead,
// normalmente no celular, e parar pra digitar senha mata o efeito dos "30
// segundos". Pode ser pública porque a /demo não lê o banco — todo dado que
// ela usa é digitado na hora, então não há cliente real exposto ali.
// Comparação exata de propósito: um prefixo solto liberaria /demografia,
// /demo-interno e qualquer rota futura que comece com "demo".
const ROTAS_PUBLICAS = ['/demo', '/api/disparar-demo'];

export function middleware(request) {
  if (ROTAS_PUBLICAS.includes(request.nextUrl.pathname)) return NextResponse.next();

  const senha = process.env.PANEL_PASSWORD;
  if (!senha) return NextResponse.next();

  const auth = request.headers.get('authorization');
  if (auth) {
    const [, base64] = auth.split(' ');
    const [, pass] = Buffer.from(base64, 'base64').toString().split(':');
    if (pass === senha) return NextResponse.next();
  }

  return new NextResponse('Acesso restrito', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Painel"' },
  });
}

// /api/campanha e /api/notificar-status ficam fora da senha do painel porque
// quem chama é o banco (pg_cron/pg_net), que não faz login de navegador.
// Essas rotas se protegem sozinhas com CRON_SECRET, exigido de forma estrita
// dentro de cada uma.
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|api/campanha|api/notificar-status).*)',
};
