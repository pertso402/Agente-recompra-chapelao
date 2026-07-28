require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPA_URL, process.env.SUPA_SERVICE_KEY);

async function main() {
  const telefone = process.argv[2];
  const nome = process.argv[3] || 'Cliente Demo';
  if (!telefone) {
    console.error('Uso: node scripts/seed-demo.js 5544999999999 "Nome do Cliente"');
    process.exit(1);
  }

  const { data: produto } = await supabase
    .from('produtos')
    .select('id, nome, categoria, preco')
    .or('video_url.not.is.null,imagem_url.not.is.null')
    .eq('disponivel', true)
    .limit(1)
    .maybeSingle();

  if (!produto) {
    console.error('Nenhum produto com imagem/vídeo cadastrado — não dá pra testar a mídia.');
    process.exit(1);
  }
  const produtoDemo = produto;

  const doze_dias_atras = new Date(Date.now() - 12 * 86400000).toISOString();

  const { data: cliente, error: errCliente } = await supabase
    .from('clientes')
    .upsert(
      {
        nome,
        telefone,
        total_pedidos: 3,
        total_gasto: produtoDemo.preco * 3,
        primeiro_pedido: new Date(Date.now() - 60 * 86400000).toISOString(),
        ultimo_pedido: doze_dias_atras,
        status_cadencia: 'ativo',
      },
      { onConflict: 'telefone' }
    )
    .select()
    .single();
  if (errCliente) throw errCliente;

  const { data: pedido, error: errPedido } = await supabase
    .from('pedidos')
    .insert({
      cliente_id: cliente.id,
      status: 'entregue',
      tipo_entrega: 'delivery',
      subtotal: produtoDemo.preco,
      total: produtoDemo.preco,
      canal: 'whatsapp',
      created_at: doze_dias_atras,
    })
    .select()
    .single();
  if (errPedido) throw errPedido;

  const { error: errItem } = await supabase.from('itens_pedido').insert({
    pedido_id: pedido.id,
    produto_id: produtoDemo.id,
    nome_produto: produtoDemo.nome,
    quantidade: 1,
    preco_unitario: produtoDemo.preco,
    total: produtoDemo.preco,
  });
  if (errItem) throw errItem;

  console.log(`Cliente demo pronto: ${cliente.nome} (${telefone})`);
  console.log(`Último pedido: ${produtoDemo.nome}, há 12 dias`);
  console.log(`clienteId: ${cliente.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
