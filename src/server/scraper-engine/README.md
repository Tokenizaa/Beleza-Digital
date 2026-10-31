# Motor independente de captura Google Maps

Este diretório contém a implementação do motor de captura copiada do repositório funcional `Tokenizaa/mais-clientes-v2`, com apenas o isolamento de dependências necessário para executá-la sem os módulos de banco e aplicação daquele projeto.

## Origem do código

- `extractor.ts`: cópia de `src/server/scraper/extractor.ts`
- `normalizer.ts`: cópia de `src/server/scraper/normalizer.ts`
- `selectors.ts`: cópia de `src/server/scraper/selectors.ts`
- `types.ts`: contrato de dados copiado de `src/shared/types.ts`, acrescido somente dos tipos de entrada/saída do executor isolado
- `browserless-endpoint.ts`: cópia de `src/server/browserless-endpoint.ts`
- `runner.ts`: executor isolado que reutiliza o extrator e seletores de origem, sem persistência, fila, tenant, CRM ou qualificação

## Uso

O motor roda exclusivamente no servidor Node.js e requer um Chromium remoto compatível com Puppeteer.

Configure `BROWSER_WS_ENDPOINT` no ambiente server-side. Não use prefixo `VITE_` e não exponha essa variável ao navegador.

```ts
import { scrapeGoogleMaps } from "./src/server/scraper-engine";

const result = await scrapeGoogleMaps({
  query: "salões de beleza",
  location: "Porto Alegre, RS",
  limit: 5,
});

console.log(JSON.stringify(result, null, 2));
```

A saída é um objeto JSON com os registros coletados, contagens, erros e timestamps. O motor não grava dados em banco e não executa deduplicação ou qualificação.
