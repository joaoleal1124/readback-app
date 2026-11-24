# Readback

App web de treino de comunicações rádio aeronáuticas para alunos PPL e ATPL.
Simulações de voo completas, ATC de vários países e sotaques, e três níveis por simulação:
escolha múltipla, resposta escrita e resposta por voz.

## Como está organizado

| Pasta | O que tem |
| --- | --- |
| `src/lib/engine` | Motor de treino: normalização e correção dos readbacks, pronúncia ICAO, indicativos. Com testes. |
| `src/server/content/sims.json` | As 10 simulações (79 passos). Só é servido a alunos com sessão iniciada, através de `/api/sims`. |
| `src/components/trainer` | Interface de treino: níveis, voz do ATC (síntese do navegador) e reconhecimento de voz. |
| `src/lib/supabase`, `src/proxy.ts`, `src/app/auth` | Contas com login por link no email (Supabase) e proteção da área de treino. |
| `supabase/migrations` | Tabela de progresso por aluno, com Row Level Security. |
| `src/lib/i18n` | Textos da interface em português e inglês. |

## Correr em desenvolvimento

```bash
npm install
cp .env.example .env.local   # opcional: sem Supabase corre em modo de demonstração
npm run dev                  # http://localhost:3000
```

Verificações: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. O CI corre as quatro em cada pull request.

## Servidor de testes (Docker)

Num servidor Ubuntu/Debian acabado de instalar, um só comando instala o Docker, descarrega o código e arranca a app:

```bash
curl -fsSL https://raw.githubusercontent.com/joaoleal1124/readback-app/main/scripts/server-setup.sh | bash
```

Corre o mesmo comando outra vez para atualizar. À mão, numa máquina que já tenha Docker:

```bash
cp .env.example .env         # preencher com os dados do Supabase
docker compose up -d --build # http://IP-DO-SERVIDOR:3000
```

## Ligar o Supabase

1. Criar um projeto em supabase.com e copiar o URL e a chave pública (publishable key) para `.env.local` / `.env`.
2. Correr `supabase/migrations/*.sql` por ordem no SQL Editor (ou `supabase db push`).
3. Em Authentication → URL Configuration, acrescentar `http://localhost:3000/auth/callback` e o endereço do servidor.

## Segurança

- Login por link no email (sem palavras-passe); a sessão fica em cookies geridos pelo `@supabase/ssr`.
- O conteúdo (`/api/sims`) só é servido com sessão iniciada e com limite de pedidos.
- O progresso só é gravado pelo servidor (`/api/progress`), que valida a simulação, o nível e os erros;
  o navegador só pode ler as suas próprias linhas (RLS).
- Content-Security-Policy e outros cabeçalhos de segurança em `next.config.ts` (`src/lib/security/csp.ts`).
- Rate limiting em memória (`src/lib/security/rateLimit.ts`), pensado para um só servidor.
- No Supabase, em Authentication → Rate Limits, manter um limite baixo de emails de login por hora.
  Se houver abuso, ligar o CAPTCHA (Cloudflare Turnstile, grátis) em Authentication → Attack Protection.

## Legal

Política de Privacidade (`/privacidade`) e Termos (`/termos`) em português e inglês, em
`src/components/legal/content.ts`. **São rascunhos:** antes de cobrar, preencher o responsável e o
contacto e pedir revisão jurídica.

## Alojamento

Ver [docs/alojamento.md](docs/alojamento.md). Resumo: o plano grátis da Vercel não permite uso comercial;
começamos no servidor caseiro com Cloudflare Tunnel.

## Escolas e instrutores

Em `/escola`, um instrutor cria turmas (cada uma recebe um código de 6 caracteres) e os alunos entram com o código. O instrutor vê os níveis feitos por licença, os exames (número, melhor nota e última nota) e a última atividade de cada aluno. Tudo passa por funções da base de dados (`create_class`, `join_class`, `record_exam`, `class_report`), e o RLS garante que cada instrutor só vê as suas turmas e que os alunos não se veem uns aos outros.

Para testar as migrações num Postgres local, sem Supabase:

```bash
psql -d teste -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql -d teste -v ON_ERROR_STOP=1 -f "$f"; done
psql -d teste -f supabase/tests/classes_rls.sql   # as linhas ERROR são recusas esperadas
```

## Próximos passos

- Pagamentos (Stripe) e verificação da subscrição em `/api/sims`.
- Indicativo de companhia inventado em vez de "Air Portugal" antes de vender (`src/lib/engine/callsign.ts`).
- Mais línguas na interface e traduções do conteúdo.
