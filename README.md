# FluxoLab

Simulador de circuitos **pneumáticos, hidráulicos, eletropneumáticos e eletro-hidráulicos** que roda direto no navegador. Os símbolos seguem a ISO 1219 (fluídica) e a IEC 60617 (elétrica). Feito para alunos de cursos técnicos, professores e técnicos de manutenção.

O plano completo, com fases, decisões e riscos, está em [`PLANO.md`](PLANO.md).

## Usar

Abra o link do site publicado na Netlify. Não precisa instalar nada. Os projetos ficam salvos no próprio navegador e podem ser exportados como `.json`.

- **Biblioteca** (esquerda): peças, **49 circuitos prontos** com explicação passo a passo e **exercícios** com correção automática.
- **Ctrl+K**: paleta de comandos para achar qualquer ação, peça, circuito ou exercício.
- **Modo Explique** (lâmpada na barra): clique numa peça para ver o que ela faz e o que está acontecendo com ela agora.
- **Aluno / Professor** (seletor na barra): o professor vê as soluções e cria exercícios a partir de um projeto.
- **CLP**: coloque um CLP (Elétrica · CLP) e dê dois cliques para programar em ladder ou GRAFCET.

## Publicar (Netlify)

O site é estático (`output: 'export'`), então não precisa de servidor.

1. Em [app.netlify.com](https://app.netlify.com), clique em **Add new site → Import an existing project → GitHub** e escolha este repositório.
2. A Netlify lê o [`netlify.toml`](netlify.toml) sozinha: comando `npm run build`, pasta `out`. Clique em **Deploy**.
3. A partir daí, **todo push na `main` publica o site**, e todo Pull Request ganha um link de pré-visualização.

**Domínio próprio:** em *Domain management → Add a domain*, digite o domínio. No painel onde o domínio foi comprado, crie o registro DNS que a Netlify mostrar (um `CNAME` para `seu-site.netlify.app`). O HTTPS é ativado sozinho em alguns minutos.

## Desenvolver

Requer Node.js 22.

```bash
npm install
npm run dev        # abre em http://localhost:3000
npm test           # testes do motor e do editor (Vitest)
npm run build      # gera o site estático em out/
npm run test:e2e   # testes de tela (Playwright) usando o build de out/
npm run lint && npm run typecheck
```

O GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda lint, tipos, testes e build em todo PR.

## Adicionar uma peça nova

1. Crie o arquivo do símbolo em `src/symbols/<domínio>/`, exportando um `ComponentDef` com:
   - tamanho (`width`/`height`, múltiplos de 10);
   - conectores (`ports`, em múltiplos de 10);
   - parâmetros (`params`);
   - o desenho SVG (`Symbol`).

   Para válvulas direcionais e cilindros, use os geradores `makeValveDef` e `makeCylinderDef`: a peça vira só dados.
   Para a peça simular, informe `sim` com um dos comportamentos que o motor já conhece (`SimSpec` em `src/engine/core/sim-types.ts`).
2. Registre a peça em `src/symbols/registry.ts`.
3. Adicione nome, descrição e textos dos parâmetros em `src/i18n/pt-BR.ts` (`parts.<tipo>` e `params.<chave>`).
4. Rode `npm test`. O teste da biblioteca confere se a peça está na grade e se tem todos os textos.

## Estrutura

```
src/app          página Next.js (só cliente)
src/components   interface: barra, biblioteca, propriedades, abas, painel de baixo
src/editor       área de desenho: zoom, grade, ímã, seleção, giro, alinhamento
src/symbols      uma definição por peça (desenho + conectores + parâmetros)
src/engine       motor de simulação em TypeScript puro (sem React), testável sem navegador
src/worker       Web Worker que roda o motor sem travar a tela
src/store        estado (Zustand): projeto, histórico de desfazer, seleção, preferências
src/persistence  IndexedDB, formato .json versionado, exportar imagem, arquivos de exercício
src/library      circuitos prontos, exercícios e o roteiro automático que corrige os exercícios
src/i18n         textos (pt-BR; pronto para en/es)
e2e              testes de tela (Playwright)
```
