# Como Hospedar na Cloudflare com Wrangler

Este projeto já está 100% preparado para rodar no **Cloudflare Pages** ou **Cloudflare Workers** com suporte a SPA, cache otimizado e PWA.

---

### Opção 1: Publicação Rápida via Cloudflare Pages (Recomendado)

1. Faça login na sua conta Cloudflare no terminal (apenas na 1ª vez):
   ```bash
   npx wrangler login
   ```

2. Gere o build e envie para o Cloudflare Pages:
   ```bash
   npm run pages:deploy
   ```
   *(Ou execute diretamente: `npx wrangler pages deploy dist --project-name=beleza-digital`)*

3. Quando o comando finalizar, o Cloudflare fornecerá uma URL pública gratuita (ex: `https://beleza-digital.pages.dev`).

---

### Opção 2: Testar Localmente com o Emulador do Cloudflare (Preview)

Para simular o comportamento de borda (edge) do Cloudflare no seu computador:
```bash
npm run pages:preview
```

---

### Arquivos já configurados no projeto:
- `wrangler.jsonc` & `wrangler.toml`: Configuração do projeto e diretório de saída (`./dist`).
- `public/_redirects`: Regra de redirecionamento SPA (`/* /index.html 200`) para que rotas funcionem sem erro 404 ao recarregar a página.
- `public/_headers`: Políticas de cache (Service Worker / Manifest sem cache agressivo, assets com cache imutável).
- `package.json`: Scripts prontos (`npm run pages:deploy` e `npm run pages:preview`).

## MapScrape v2 — Worker de prospecção

A descoberta de estabelecimentos é executada exclusivamente pelo serviço central MapScrape v2. O Worker do Beleza Digital não deve instalar nem executar navegador/scraper local.

Configure no Worker `barbearia-yeshua-prospecting-scheduler`:

- Secret `MAPSCRAPE_API_KEY`: chave individual emitida no MapScrape para o consumidor `Beleza Digital` / projeto `beleza-digital`.
- Variable `MAPSCRAPE_API_BASE_URL`: `https://mapscrape-v2.vercel.app`.
- Mantenha `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `PROSPECTING_WORKER_SECRET` como secrets existentes.

A chave `MAPSCRAPE_API_KEY` é exclusiva do Worker e não pode usar prefixo público nem ser exposta no frontend. Emita a credencial no painel administrativo do MapScrape e armazene-a diretamente nos secrets do Worker; nunca registre a chave em commit, log ou documentação.

O fluxo manual usa `/api/prospecting/run` para enfileirar uma tarefa persistente. O Worker inicia a coleta via MapScrape, salva o identificador do job e consulta o mesmo job nas tentativas subsequentes; ele não pode repetir um POST de criação após timeout sem reconciliação, porque a API v1 não implementa idempotency key.
