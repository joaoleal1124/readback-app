# Alojamento: onde pôr a app a funcionar (grátis e com uso comercial)

O Readback vai ser vendido, por isso o alojamento tem de **permitir uso comercial**.
O plano grátis da Vercel (Hobby) **não permite**: é só para projetos pessoais e não comerciais.

## Recomendação agora: servidor caseiro + Cloudflare Tunnel (0 €)

1. A app corre no servidor caseiro com Docker (`scripts/server-setup.sh`, já existe).
2. O **Cloudflare Tunnel** (grátis) liga esse servidor à internet com HTTPS, sem abrir portas no router
   e sem expor o IP de casa. Precisa de um domínio (cerca de 10 €/ano; é o único custo, e só quando
   for para ter clientes).
3. A Cloudflare passa o IP real do visitante no cabeçalho `cf-connecting-ip`, que a app já usa para o
   rate limiting.

Porquê: custo zero, sem limites de pedidos, uso comercial permitido, e o rate limiting em memória
funciona bem porque há um só servidor.

Limite: se a luz ou a internet de casa falharem, a app fica em baixo. Serve para o início e testes com alunos.

## Quando houver clientes pagantes

| Opção | Uso comercial no grátis | Notas |
| --- | --- | --- |
| Cloudflare Workers (com OpenNext) | Sim | 100 000 pedidos/dia grátis. O tamanho máximo da app no plano grátis é pequeno (3 MB comprimido); confirmar no build. O rate limiting passa a usar o rate limiting da Cloudflare. |
| VPS barato (Hetzner, etc.) | Sim (pago, ~4–5 €/mês) | O mesmo Docker do servidor caseiro, mas sempre ligado. |
| Vercel Pro | Sim (pago, 20 USD/mês) | O mais simples para Next.js, mas é o mais caro. |

## Outros serviços

- **Supabase** (base de dados e login): o plano grátis permite uso comercial. Fica em pausa depois de
  uma semana sem atividade; com alunos a usar não acontece.
- **Stripe** (pagamentos): sem mensalidade, só comissão por venda.
