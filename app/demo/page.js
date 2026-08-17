'use client';

import { useState } from 'react';

// videoUrl fica vazio até você colar o link de cada vídeo aqui — depois disso,
// escolher o nicho já preenche o vídeo certo automaticamente (dá pra sobrescrever
// manualmente no campo abaixo, se precisar de outro vídeo pontual).
const NICHOS = {
  marmitaria: { label: 'Marmitaria', produtoExemplo: 'Marmitex de Frango', videoUrl: '' },
  restaurante: { label: 'Restaurante (buffet)', produtoExemplo: 'Buffet do dia', videoUrl: '' },
  pizzaria: { label: 'Pizzaria', produtoExemplo: 'Pizza de Calabresa', videoUrl: 'https://mhonpvgdklrapcdfovmv.supabase.co/storage/v1/object/public/video%20burguer/food%20porn.mp4' },
  hamburgueria: { label: 'Hamburgueria', produtoExemplo: 'X-Bacon Artesanal', videoUrl: 'https://mhonpvgdklrapcdfovmv.supabase.co/storage/v1/object/public/video%20burguer/food%20porn.mp4' },
};

export default function Demo() {
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [demo, setDemo] = useState({
    telefone: '',
    nome: '',
    nicho: 'pizzaria',
    nomeProduto: NICHOS.pizzaria.produtoExemplo,
    mediaUrl: NICHOS.pizzaria.videoUrl,
    tipoMidia: 'video',
  });

  async function disparar() {
    if (!demo.telefone || !demo.nomeProduto) {
      setFeedback({ tipo: 'erro', texto: 'Preencha ao menos telefone e nome do produto' });
      return;
    }
    setEnviando(true);
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
      setEnviando(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '16px 12px 40px' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>Agente de Recompra</h1>
        <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>Demo de prospecção — nenhum dado real é exibido aqui</p>
      </header>

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

      <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>🎯 Disparar demo</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            onChange={(e) => setDemo({
              ...demo,
              nicho: e.target.value,
              nomeProduto: NICHOS[e.target.value].produtoExemplo,
              mediaUrl: NICHOS[e.target.value].videoUrl,
            })}
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
            onClick={disparar}
            disabled={enviando}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: 'none',
              background: '#18181b',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              opacity: enviando ? 0.6 : 1,
            }}
          >
            {enviando ? 'Enviando...' : '🚀 Disparar demo'}
          </button>
        </div>
      </div>
    </main>
  );
}
