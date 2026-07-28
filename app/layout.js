export const metadata = {
  title: 'Agente de Recompra — Chapelão',
  description: 'Painel de reativação de clientes via WhatsApp',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: '#f4f4f5',
          color: '#18181b',
        }}
      >
        {children}
      </body>
    </html>
  );
}
