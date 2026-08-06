import { NextResponse } from 'next/server';

export function middleware(request) {
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

// /api/campanha fica fora da senha do painel porque quem chama é o agendador
// (pg_cron do Supabase), que não tem como fazer login de navegador. Essa rota
// se protege sozinha com CRON_SECRET, exigido de forma estrita lá.
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|api/campanha).*)',
};
