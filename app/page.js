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

const NICHOS = {
  marmitaria: { label: 'Marmitaria', produtoExemplo: 'Marmitex de Frango' },
  pizzaria: { label: 'Pizzaria', produtoExemplo: 'Pizza de Calabresa' },
  hamburgueria: { label: 'Hamburgueria', produtoExemplo: 'X-Bacon Artesanal' },
};

export default function Painel() {
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [disparando, setDisparando] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [diasMinimo, setDiasMinimo] = useState(7);

  const [midia, setMidia] = useState(null);
  const [subindo, setSubindo] = useState(false);

  const [demoAberto, setDemoAberto] = useState(false);
  const [demoEnviando, setDemoEnviando] = useState(false);
  const [demo, setDemo] = useState({
    telefone: '',
    nome: '',
    nicho: 'pizzaria',
    nomeProduto: '',
    mediaUrl: '',
    tipoMidia: 'video',
  });

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

  async function carregarMidia() {
    try {
      const res = await fetch('/api/buffet');
      const data = await res.json();
      setMidia(data.midia || null);
    } catch (e) {
      /* status da mídia é informativo — não bloqueia o resto do painel */
    }
  }

  useEffect(() => {
    carregar();
  }, [diasMinimo]);

  useEffect(() => {
    carregarMidia();
  }, []);

  async function subirBuffet(arquivo) {
    if (!arquivo) return;
    setSubindo(true);
    setFeedback(null);
    try {
      const body = new FormData();
      body.append('arquivo', arquivo);
      const res = await fetch('/api/buffet', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMidia(data.midia);
      setFeedback({ tipo: 'ok', texto: 'Vídeo do buffet de hoje enviado! A campanha já pode rodar.' });
    } catch (e) {
      setFeedback({ tipo: 'erro', texto: e.message || 'Erro ao subir o vídeo' });
    } finally {
      setSubindo(false);
    }
  }

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

  async function dispararDemo() {
    if (!demo.telefone || !demo.nomeProduto) {
      setFeedback({ tipo: 'erro', texto: 'Preencha ao menos telefone e nome do produto' });
      return;
    }
    setDemoEnviando(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/disparar-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demo),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback({ tipo: 'ok', texto: `Demo enviada! Cupom: ${data.cupom.codigo}` });
    } catch (e) {
      setFeedback({ tipo: 'erro', texto: e.message || 'Erro ao disparar demo' });
    } finally {
      setDemoEnviando(false);
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

      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          borderLeft: `4px solid ${midia ? '#16a34a' : '#dc2626'}`,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🍽️ Buffet de hoje</div>
        <div style={{ fontSize: 12, color: midia ? '#166534' : '#991b1b', marginBottom: 10 }}>
          {midia
            ? 'Vídeo enviado — a campanha das 11h às 14h vai usar ele.'
            : 'Nenhum vídeo hoje. Sem ele a campanha não dispara.'}
        </div>

        {midia && (
          <video
            src={midia.video_url}
            controls
            playsInline
            style={{ width: '100%', borderRadius: 10, marginBottom: 10, background: '#000' }}
          />
        )}

        <label
          style={{
            display: 'block',
            padding: '10px 12px',
            borderRadius: 10,
            background: subindo ? '#a1a1aa' : '#18181b',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            textAlign: 'center',
            cursor: subindo ? 'default' : 'pointer',
          }}
        >
          {subindo ? 'Enviando...' : midia ? '🔄 Trocar vídeo de hoje' : '📹 Enviar vídeo do buffet'}
          <input
            type="file"
            accept="video/*,image/*"
            capture="environment"
            disabled={subindo}
            onChange={(e) => subirBuffet(e.target.files?.[0])}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <button
          onClick={() => setDemoAberto((v) => !v)}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          {demoAberto ? '▾' : '▸'} 🎯 Demo por nicho (prospecção)
        </button>

        {demoAberto && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <input
              placeholder="Telefone com DDD (44 99708-8509)"
              inputMode="tel"
              value={demo.telefone}
              onChange={(e) => setDemo({ ...demo, telefone: e.target.value })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #d4d4d8', fontSize: 13 }}
            />
            <input
              placeholder="Nome do prospect/cliente"
              value={demo.nome}
              onChange={(e) => setDemo({ ...demo, nome: e.target.value })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #d4d4d8', fontSize: 13 }}
            />
            <select
              value={demo.nicho}
              onChange={(e) => setDemo({ ...demo, nicho: e.target.value, nomeProduto: NICHOS[e.target.value].produtoExemplo })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #d4d4d8', fontSize: 13 }}
            >
              {Object.entries(NICHOS).map(([key, v]) => (
                <option key={key} value={key}>{v.label}</option>
              ))}
            </select>
            <input
              placeholder="Nome do produto (ex: Pizza de Calabresa)"
              value={demo.nomeProduto}
              onChange={(e) => setDemo({ ...demo, nomeProduto: e.target.value })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #d4d4d8', fontSize: 13 }}
            />
            <input
              placeholder="URL da mídia (vídeo ou imagem)"
              value={demo.mediaUrl}
              onChange={(e) => setDemo({ ...demo, mediaUrl: e.target.value })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #d4d4d8', fontSize: 13 }}
            />
            <select
              value={demo.tipoMidia}
              onChange={(e) => setDemo({ ...demo, tipoMidia: e.target.value })}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #d4d4d8', fontSize: 13 }}
            >
              <option value="video">Vídeo</option>
              <option value="image">Imagem</option>
            </select>
            <button
              onClick={dispararDemo}
              disabled={demoEnviando}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: '#18181b',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                opacity: demoEnviando ? 0.6 : 1,
              }}
            >
              {demoEnviando ? 'Enviando...' : '🚀 Disparar demo'}
            </button>
          </div>
        )}
      </div>

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
