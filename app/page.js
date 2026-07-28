'use client';

import { useEffect, useState } from 'react';

function formatarMoeda(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Badge({ status }) {
  const cores = {
    ativo: '#16a34a',
    pausado: '#ca8a04',
    inativo: '#71717a',
    bloqueado: '#dc2626',
  };
  return (
    <span
      style={{
        background: cores[status] || '#71717a',
        color: '#fff',
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 999,
        fontWeight: 600,
        textTransform: 'uppercase',
      }}
    >
      {status}
    </span>
  );
}

export default function Painel() {
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [disparando, setDisparando] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [diasMinimo, setDiasMinimo] = useState(7);

  async function carregar() {
    setCarregando(true);
    try {
      const res = await fetch(`/api/clientes?diasMinimo=${diasMinimo}`);
      const data = await res.json();
      setClientes(data.clientes || []);
    } catch (e) {
      setFeedback({ tipo: 'erro', texto: 'Erro ao carregar clientes' });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [diasMinimo]);

  async function disparar(clienteId) {
    setDisparando(clienteId);
    setFeedback(null);
    try {
      const res = await fetch('/api/disparar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback({ tipo: 'ok', texto: `Mensagem enviada! Cupom: ${data.cupom.codigo}` });
      carregar();
    } catch (e) {
      setFeedback({ tipo: 'erro', texto: e.message || 'Erro ao disparar' });
    } finally {
      setDisparando(null);
    }
  }

  async function alternarPausa(clienteId, statusAtual) {
    const acao = statusAtual === 'pausado' ? 'reativar' : 'pausar';
    try {
      await fetch('/api/clientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId, acao }),
      });
      carregar();
    } catch (e) {
      setFeedback({ tipo: 'erro', texto: 'Erro ao atualizar cliente' });
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 40px' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>Agente de Recompra</h1>
        <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>Chapelão — clientes elegíveis pra reativação</p>
      </header>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: '#52525b' }}>Dias sem comprar (mín.)</label>
        <input
          type="number"
          value={diasMinimo}
          onChange={(e) => setDiasMinimo(Number(e.target.value) || 0)}
          style={{ width: 60, padding: 6, borderRadius: 8, border: '1px solid #d4d4d8' }}
        />
      </div>

      {feedback && (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            marginBottom: 12,
            fontSize: 13,
            background: feedback.tipo === 'ok' ? '#dcfce7' : '#fee2e2',
            color: feedback.tipo === 'ok' ? '#166534' : '#991b1b',
          }}
        >
          {feedback.texto}
        </div>
      )}

      {carregando && <p style={{ color: '#71717a', fontSize: 14 }}>Carregando...</p>}

      {!carregando && clientes.length === 0 && (
        <p style={{ color: '#71717a', fontSize: 14 }}>Nenhum cliente elegível no momento.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {clientes.map((c) => (
          <div
            key={c.id}
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: 14,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <strong style={{ fontSize: 15 }}>{c.nome}</strong>
                <div style={{ fontSize: 12, color: '#71717a' }}>{c.telefone}</div>
              </div>
              <Badge status={c.status_cadencia} />
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#52525b' }}>
              <span>🗓️ {c.dias_sem_comprar} dias sem comprar</span>
              <span>💰 {formatarMoeda(c.total_gasto)}</span>
              <span>🛒 {c.total_pedidos} pedidos</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => disparar(c.id)}
                disabled={disparando === c.id}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#18181b',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  opacity: disparando === c.id ? 0.6 : 1,
                }}
              >
                {disparando === c.id ? 'Enviando...' : '🚀 Disparar recompra'}
              </button>
              <button
                onClick={() => alternarPausa(c.id, c.status_cadencia)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #d4d4d8',
                  background: '#fff',
                  fontSize: 13,
                }}
              >
                {c.status_cadencia === 'pausado' ? '▶️' : '⏸️'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
