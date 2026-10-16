# FluxoLab

Simulador de circuitos **pneumáticos, hidráulicos, eletropneumáticos e eletro-hidráulicos** que roda direto no navegador, inclusive sem internet. Os símbolos seguem a ISO 1219 (fluídica) e a IEC 60617 (elétrica), com desenho próprio. Feito para alunos de cursos técnicos, professores e técnicos de manutenção.

O plano completo, com fases, decisões e riscos, está em [`PLANO.md`](PLANO.md).

## O que dá para fazer

- **Montar circuitos** arrastando peças da biblioteca (cerca de 150 peças): pneumática, hidráulica, elétrica (IEC) e CLP. As linhas fazem curvas de 90° sozinhas.
- **Simular**:
  - o ar é compressível (ISO 6358) e o óleo quase incompressível;
  - cilindros com massa, atrito e amortecimento;
  - relés, temporizadores, contadores e curto-circuito.
- **Ver o que acontece**:
  - linhas coloridas pela pressão, com o fluxo animado;
  - corrente nos fios;
  - diagrama de fases;
  - gráficos ao vivo de posição, velocidade, pressão, vazão, rotação e tensão.
- **Modo Explique** (lâmpada na barra): clique numa peça para ver como ela funciona e o que está fazendo agora.
- **CLP**: coloque um CLP (Elétrica · CLP) e dê dois cliques para programar em **ladder** ou **GRAFCET**.
- **49 circuitos prontos** com explicação passo a passo e **12 exercícios com correção automática** (painel da esquerda).
- **Modos Aluno e Professor** (seletor na barra): o professor vê as soluções e cria exercícios a partir de um projeto.
- **Ctrl+K**: paleta de comandos para achar qualquer ação, peça, circuito ou exercício.
- **Detector de erros**: conectores soltos, falta de fonte, sinal preso, curto-circuito, sobrepressão e outros, com marcação no desenho.
- **Arquivos**:
  - salvamento automático no navegador;
  - abrir e salvar `.json`;
  - exportar SVG, PNG e **PDF** (uma página por aba + lista de peças).
- **Modo apresentação** (ícone de tela na barra): tela cheia, só o desenho e os controles grandes, para o projetor.
- **Tablet**: toque para acionar botões, pinça para zoom, biblioteca e propriedades como gavetas.
- **App instalável e offline** (PWA): depois do primeiro acesso, abre e simula sem internet. Quando sai uma versão nova, aparece o aviso “Recarregar”.
- **Português, inglês e espanhol** (seletor na barra). Os textos dos circuitos prontos e dos exercícios estão só em português.

### Atalhos

| Tecla | Ação |
|---|---|
| F5 | Iniciar / pausar a simulação |
| Esc | Parar a simulação (ou sair da apresentação) |
| Ctrl+K | Paleta de comandos |
| Ctrl+Z / Ctrl+Y | Desfazer / refazer |
| Ctrl+C / Ctrl+V / Ctrl+D | Copiar / colar / duplicar |
| Ctrl+S / Ctrl+O | Salvar / abrir |
| R / M | Girar / espelhar |
| Setas (Shift = passo maior) | Mover a peça |
| + / − / 0 | Zoom / ver tudo |
| Tab, Enter, Espaço | Percorrer as peças, selecionar e (na simulação) acionar |

## Publicar (Netlify)

O site é estático (`output: 'export'`), então não precisa de servidor.

1. Em [app.netlify.com](https://app.netlify.com), clique em **Add new site → Import an existing project → GitHub** e escolha este repositório.
2. A Netlify lê o [`netlify.toml`](netlify.toml) sozinha: comando `npm run build`, pasta `out`. Clique em **Deploy**.
3. A partir daí, **todo push na `main` publica o site**, e todo Pull Request ganha um link de pré-visualização.
4. Opcional: em *Site configuration → Change site name*, use `fluxolab` para ficar com o endereço `https://fluxolab.netlify.app` (se o nome estiver livre).

**Domínio próprio** (ex.: `fluxolab.seudominio.com.br`):
1. Na Netlify, em *Domain management → Add a domain*, digite o domínio.
2. No painel onde o domínio foi comprado (Registro.br, GoDaddy, Hostinger…), crie o registro DNS que a Netlify mostrar:
   - **subdomínio** (`fluxolab.seudominio.com.br`): um `CNAME` apontando para `seu-site.netlify.app`;
   - **domínio raiz** (`seudominio.com.br`): um registro `A` para o IP que a Netlify indicar, ou use o DNS da própria Netlify.
3. Espere a propagação (minutos a algumas horas). O HTTPS é ativado sozinho.

O app instalável (PWA) funciona no endereço publicado, com HTTPS. O service worker é gerado a cada build (`scripts/build-sw.mjs`), e o `netlify.toml` impede que ele fique preso no cache.

## Desenvolver

Requer Node.js 22.

```bash
npm install
npm run dev        # abre em http://localhost:3000 (sem o service worker)
npm test           # testes do motor, da biblioteca e do editor (Vitest)
npm run build      # gera o site estático em out/ (e o service worker)
npm run test:e2e   # testes de tela (Playwright) usando o build de out/
npm run lint && npm run typecheck
```

O GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda lint, tipos, testes e build em todo PR.

Os testes de tela incluem:
- uma auditoria de acessibilidade (axe, WCAG 2.1 AA, temas claro e escuro);
- o teste offline do PWA;
- o tablet com toque;
- uma medição de quadros por segundo com 150 peças, que roda por último e sozinha.

## Adicionar uma peça nova

1. Crie o arquivo do símbolo em `src/symbols/<domínio>/`, exportando um `ComponentDef` com:
   - tamanho (`width`/`height`, múltiplos de 10);
   - conectores (`ports`, em múltiplos de 10);
   - parâmetros (`params`);
   - o desenho SVG (`Symbol`).

   Para válvulas direcionais e cilindros, use os geradores `makeValveDef` e `makeCylinderDef`: a peça vira só dados.
   Para a peça simular, informe `sim` com um dos comportamentos que o motor já conhece (`SimSpec` em `src/engine/core/sim-types.ts`).
2. Registre a peça em `src/symbols/registry.ts`.
3. Adicione nome, descrição e textos dos parâmetros em `src/i18n/pt-BR.ts`, `en.ts` e `es.ts` (`parts.<tipo>` e `params.<chave>`). O TypeScript acusa se faltar alguma chave num idioma.
4. Rode `npm test`.

## Adicionar um circuito pronto ou um exercício

- **Circuito**: em `src/library/` (`pneumatic.ts`, `electro.ts`, `hydraulic.ts`), monte o circuito com o `Builder` (posições em múltiplos de 10). Escreva título, resumo e passos. Se tiver um `scenario` (botões acionados com hora marcada + sequência esperada), o teste da biblioteca roda o circuito e confere a sequência.
- **Exercício**: em `src/library/exercises.ts`, aponte para um circuito pronto (a solução) e diga quais peças o aluno já recebe.
- **Pelo próprio app**:
  1. No modo Professor, monte a solução.
  2. Simule acionando os botões.
  3. Em *Exercícios*, clique em *Criar exercício*.
  4. Baixe o arquivo `.json` e envie aos alunos, que o importam em *Exercícios*.

## Estrutura

```
src/app          página Next.js (só cliente)
src/components   interface: barra, painéis, gráficos, modo Explique, paleta, CLP, aulas
src/editor       área de desenho: zoom, grade, ímã, seleção, giro, alinhamento, linhas
src/symbols      uma definição por peça (desenho + conectores + parâmetros)
src/engine       motor de simulação em TypeScript puro (sem React), testável sem navegador
  /core /solver  rede nodal implícita (ar e óleo), passo da simulação
  /pneumatic /hydraulic /mechanics /electric   modelos de cada área
  /logic         CLP: condições, ladder e GRAFCET
  /diagnostics   detector de erros
src/worker       Web Worker que roda o motor sem travar a tela
src/store        estado (Zustand): projeto, desfazer, simulação, preferências, aulas
src/persistence  IndexedDB, formato .json versionado, SVG/PNG/PDF, arquivos de exercício
src/library      circuitos prontos, exercícios e o roteiro que corrige os exercícios
src/i18n         textos em pt-BR, en e es
scripts          geração do service worker depois do build
e2e              testes de tela (Playwright)
```
