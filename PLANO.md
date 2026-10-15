# FluxoLab — Plano do projeto

Simulador web de circuitos **pneumáticos, hidráulicos, eletropneumáticos e eletro-hidráulicos**, inspirado no FluidSIM, porém mais moderno e interativo. Símbolos desenhados do zero seguindo **ISO 1219** (fluídica) e **IEC 60617** (elétrica). Público: alunos de cursos técnicos, professores e técnicos de manutenção.

> Status: **Fase 1 — Base** concluída. Aguardando OK para iniciar a Fase 2.

---

## 1. Decisões já tomadas

| Tema | Decisão | Por quê |
|---|---|---|
| Nome | **FluxoLab** | escolhido pelo usuário |
| Hospedagem | **Netlify**, integração nativa com o GitHub (`netlify.toml`) | publica a cada push na `main` e gera um link de *preview* em cada PR, sem tokens nem secrets no GitHub |
| Fluxo git | Trabalho no branch `claude/adoring-bohr-l6mnlc` → **um PR por fase** → merge na `main` → Netlify publica sozinho | o usuário revisa cada fase antes de ir ao ar |
| Repositório | `tsenkang/hack-template` é **público** | sem restrição de plano em nenhuma plataforma |
| Site | Next.js com `output: 'export'` (pasta `out/`), sem API routes, Server Actions ou servidor | roda 100% no navegador |
| Endereço | na raiz do domínio Netlify (`fluxolab.netlify.app` ou parecido) | **não precisa de `basePath` nem de `assetPrefix`** (isso só seria necessário no GitHub Pages) |
| Pacotes | **npm** (`npm run dev`, `npm test`, `npm run build`) | é o que o prompt pede e o que a Netlify usa por padrão |
| CI | `.github/workflows/ci.yml`: lint + typecheck + Vitest + build a cada PR | o deploy fica com a Netlify; o GitHub Actions só garante que nada quebrado chegue na `main` |

### O que o usuário precisa fazer uma única vez (eu não consigo fazer daqui)
1. Entrar em **app.netlify.com** com a conta do GitHub → *Add new site* → *Import from Git* → escolher `tsenkang/hack-template`.
2. A Netlify lê o `netlify.toml` sozinha (comando `npm run build`, pasta `out`). Basta clicar em *Deploy*.
3. Opcional: em *Site configuration → Change site name*, colocar `fluxolab`.

> ⚠️ O repositório já tem como *homepage* `hack-template-chi.vercel.app`, o que indica que ele **ainda está ligado a um projeto na Vercel**. Se continuar ligado, a Vercel também vai tentar publicar a cada push. Recomendo desconectar o projeto na Vercel (ou ignorar os avisos de build dela).

---

## 2. Arquitetura

```
/src
  /app                 -> páginas Next.js (só client-side; uma página principal /)
  /components          -> interface: barra superior, biblioteca, painel de propriedades, painel inferior, gráficos
  /editor              -> área de desenho SVG: zoom/pan, grade, snap, seleção, roteamento de linhas, ferramentas
  /symbols             -> um arquivo por peça: desenho SVG + conectores + parâmetros + modelo de comportamento
  /engine              -> motor de simulação em TypeScript puro (não importa React nem DOM)
      /core            -> tipos do circuito, montagem da rede, relógio da simulação, laço de passos
      /solver          -> solver de rede fluídica (análise nodal + Newton-Raphson)
      /pneumatic       -> modelos do ar: orifício ISO 6358, volumes, escape, reguladores
      /hydraulic       -> modelos do óleo: bomba, alívio, vazão, acumulador
      /mechanics       -> cilindros, motores, molas, fim de curso, amortecimento
      /electric        -> rede elétrica: caminhos fechados, cargas, curto-circuito
      /logic           -> relés, temporizadores, contadores, CLP (ladder), GRAFCET
      /diagnostics     -> detector de erros (conector aberto, sobrepressão, sinal preso…)
  /worker              -> Web Worker que roda o motor e conversa com a tela por mensagens
  /library             -> circuitos prontos e exercícios (.json)
  /i18n                -> textos (pt-BR primeiro; en e es depois)
  /store               -> Zustand (projeto, editor, simulação, preferências)
  /persistence         -> IndexedDB, exportar/importar .json, migrações de versão
/e2e                   -> testes Playwright (tela)
/public                -> manifest, ícones, service worker
```

**Ajustes em relação ao prompt (e por quê):**
- **Testes do motor ficam ao lado do código** (`engine/**/*.test.ts`) em vez de em `/tests`: fica mais fácil achar o teste de cada modelo. Os testes de tela ficam em `/e2e`.
- **`/engine/mechanics`** separado: cilindro e motor são iguais na pneumática e na hidráulica; só muda o fluido que empurra.
- **`/worker` e `/persistence`** separados: a fronteira tela ↔ motor e o formato de arquivo são pontos sensíveis e merecem um lugar próprio.

### 2.1 Peças descritas por dados
Cada peça é um objeto `ComponentDef`:

```ts
{
  id: "pneu.valve.5-2.solenoid-spring",
  domain: "pneumatic",            // pneumatic | hydraulic | electric | logic
  category: "valvulas-direcionais",
  ports: [{ id: "1", x: 20, y: 60, kind: "fluid" }, ...],  // posição em unidades da grade
  params: [{ key: "switchTime", unit: "ms", default: 20, min: 1, max: 500, help: "i18n.key" }],
  symbol: (state, theme) => <svg>…</svg>,   // desenho com base no estado atual
  model: { type: "directional-valve", positions: [...], actuators: { left: "solenoid:Y1", right: "spring" } }
}
```

O motor só conhece **primitivas genéricas** (orifício, retenção, volume, câmara de pistão, mola, bobina, contato, temporizador…). O `model` de cada peça é montado a partir dessas primitivas. **Peça nova = arquivo novo em `/symbols`**, sem mexer no motor, enquanto ela puder ser montada com as primitivas que já existem.

### 2.2 Motor de simulação
- **Passo fixo** (padrão 1 ms, com subpassos automáticos quando o solver pede) e **integração implícita (Euler para trás)**. É estável mesmo com o óleo quase incompressível.
- **Rede fluídica = análise nodal.** Cada trecho de tubo ligado vira um *nó* com volume. As peças viram *ramos* com vazão em função das pressões. A cada passo, o Newton-Raphson resolve as pressões dos nós.
  - **Ar:** gás ideal isotérmico (`p·V = m·R·T`), vazão mássica em orifício pelo modelo **ISO 6358** (C, b), que trata o fluxo crítico/sônico.
  - **Óleo:** compressibilidade pelo módulo de elasticidade (β ≈ 1,4 GPa) e orifício turbulento `Q = Cd·A·√(2Δp/ρ)`, linearizado perto de Δp = 0 para não divergir.
  - **Válvulas:** posição contínua do êmbolo (0…1) com tempo de comutação. A área de cada via varia com a posição.
  - **Alívio, sequência, redutora, contrabalanço:** abertura proporcional à pressão, com pequena histerese para não oscilar.
- **Mecânica:** `m·a = p_A·A_A − p_B·A_B − F_mola − F_atrito − F_carga`, com atrito de Coulomb + viscoso, batentes de fim de curso e amortecimento como estrangulamento no final do curso.
- **Elétrica (CC/CA simples):** grafo de condutores com chaves. A corrente passa só em caminho fechado da fonte até o 0 V **através de uma carga**. Caminho sem carga = **curto-circuito** (o fusível abre e aparece um aviso). A lógica de relés é iterada no mesmo passo até estabilizar; se não estabilizar, aparece o aviso "oscilação".
- **Acoplamentos:** a bobina energizada aciona o solenoide da válvula, a posição do cilindro aciona os sensores, a pressão aciona os pressostatos. Tudo trocado entre os domínios a cada passo.
- **Worker:** o motor roda num Web Worker. A tela recebe "fotografias" do estado (`Float32Array` transferível) a cada quadro e envia comandos (apertar botão, girar regulador) por mensagem. Por isso a tela nunca trava.
- **Determinístico:** mesmo circuito + mesmos comandos = mesmo resultado. Isso permite testes confiáveis e a conferência automática de exercícios.

### 2.3 Tela e desempenho (meta: 150 peças a 60 fps)
- SVG com **uma assinatura do Zustand por peça** (seletores finos): quando muda uma peça, só ela é redesenhada.
- Fluxo animado com `stroke-dasharray` + animação CSS, com a velocidade ligada à vazão: sem JavaScript por quadro.
- Linhas com **roteamento ortogonal automático** (A* numa grade, desviando das caixas das peças).
- Desfazer/refazer por **histórico de comandos** (cada ação guarda como desfazer). Ilimitado e leve.

### 2.4 Arquivos, offline e idiomas
- Arquivo salvo: `{ "format": "fluxolab", "version": 1, "circuits": [...], "meta": {...} }`, com **migrações** entre versões.
- Salvamento automático no **IndexedDB** e exportar/importar `.json`.
- **PWA:** `manifest.webmanifest` + service worker próprio. Um script pós-build lista os arquivos de `out/` e gera o *precache*. Funciona offline e permite instalar.
- **i18n:** dicionário próprio `t("chave")` com `pt-BR.ts`. Os textos ficam todos fora do código. Para adicionar `en` ou `es`, basta copiar o arquivo.

### 2.5 Acessibilidade
- O estado das linhas usa **cor + padrão de traço + rótulo** (ex.: comando = tracejado; escape = pontilhado; pressão = contínua grossa). Assim não depende só de cor.
- Tudo operável pelo teclado (setas movem a peça; Tab percorre as peças; Enter abre as propriedades), paleta de comandos `Ctrl+K` e contraste AA nos dois temas.

---

## 3. Fases

| Fase | Entrega | Pronto quando… |
|---|---|---|
| **0 — Planejamento** | este `PLANO.md` | aprovado pelo usuário |
| **1 — Base** | projeto Next.js + Tailwind + Zustand + Vitest + Playwright; layout das 4 áreas + painel inferior; área de desenho (zoom, pan, grade, snap, seleção múltipla, copiar/colar, girar, espelhar, alinhar); biblioteca com busca (peças "placeholder"); abas de circuitos; desfazer/refazer; salvar no IndexedDB, abrir/exportar `.json`; tema claro/escuro; `netlify.toml` + CI; **primeira publicação** | o site está no ar na Netlify e os testes passam |
| **2 — Pneumática simples** | 15 a 20 peças (fonte de ar, unidade de conservação, silenciador, cilindros SA/DA, 3/2 NF/NA, 5/2 com botão/rolete/piloto/mola/solenoide, retenção, reguladora de vazão unidirecional, manômetro, conexões); ligação arrastando com roteamento 90°; solver pneumático no Worker; cores, legenda e fluxo animado; operar botões durante a simulação; controles iniciar/pausar/parar/passo/velocidade | os testes de cilindro SA, cilindro DA e 5/2 pilotada passam, e o avanço/retorno aparece na tela |
| **3 — Pneumática completa** | o resto da biblioteca pneumática (E, OU, escape rápido, temporizadores, contador, 5/3, sensores, vácuo, garra, motor, sem haste, duas hastes…); diagrama de fases automático; detector de erros com marcação no desenho; inserir peça em cima de uma linha; rastro do sinal | os testes de E, OU, temporizador e A+B+B−A− passam |
| **4 — Elétrica** | fontes, botões, seletoras, emergência, relés, contatores, temporizados, contadores, sensores (fim de curso, indutivo, capacitivo, óptico, reed), pressostato, lâmpada, buzina, fusível, disjuntor, diodo, resistor; corrente animada; diagrama em escada com numeração de linhas e referência cruzada de contatos | os testes de selo e de curto-circuito passam; uma eletropneumática com selo + emergência funciona |
| **5 — Hidráulica** | motor + bomba fixa/variável, tanque, filtro, resfriador, aquecedor, acumulador, instrumentos; cilindros e motores; 2/2…4/3 com todos os centros; alívio, redutora, sequência, contrabalanço; vazão (fixa, ajustável, compensada); retenção pilotada; proporcional/servo básicos; eletro-hidráulica | o teste da válvula de alívio passa (a bomba bloqueada fica limitada na pressão ajustada) |
| **6 — Interatividade avançada** | modo Explique (o que a peça faz + o que está acontecendo agora); medições com gráficos ao vivo; modos Aluno/Professor; exercícios guiados com conferência pelo diagrama de fases; **40+ circuitos prontos** com explicação passo a passo; GRAFCET (editor + execução); CLP simples com ladder; `Ctrl+K` | um exercício de exemplo é corrigido automaticamente |
| **7 — Acabamento** | toque/pinça no tablet; PWA instalável + offline; exportar PNG/SVG/PDF; en/es; teste de desempenho com 150 peças; auditoria de acessibilidade; modo apresentação; README final | Lighthouse PWA OK; 150 peças a 60 fps; testes e2e passando |

No fim de cada fase: testes rodando, app rodando, resumo em 5 linhas, PR aberto e **pedido de OK** antes da fase seguinte.

---

## 4. Riscos e como lidar

| Risco | Impacto | Como reduzir |
|---|---|---|
| **Solver instável** (óleo quase incompressível, válvulas abrindo de repente) | simulação "explode" ou trava | integração implícita, linearização do orifício perto de Δp=0, subpassos automáticos e limite de iterações com aviso; testes de regressão para cada circuito clássico |
| **Precisão física** vs. simplicidade | números diferentes de uma bancada real | objetivo didático: tendências e ordens de grandeza corretas (velocidade ∝ vazão, alívio na pressão certa). Os parâmetros ficam editáveis e documentados |
| **Tamanho do escopo** (≈150 peças, 40 circuitos, GRAFCET, CLP) | muitas sessões de trabalho | entregas por fase, sempre publicadas; as peças são dados, então a biblioteca cresce sem mexer no motor |
| **Fidelidade dos símbolos ISO 1219 / IEC 60617** | símbolo "estranho" para quem conhece a norma | desenho próprio (sem copiar a Festo), com revisão visual em cada fase; o professor pode apontar ajustes |
| **Next.js 16 diverge do que é comum** (Turbopack por padrão, APIs novas) | erros de build ou de PWA | conferir `node_modules/next/dist/docs/` antes de cada parte; service worker próprio, sem plugins que dependam do webpack |
| **Web Worker + export estático** | worker não carrega no site publicado | usar `new Worker(new URL("./sim.worker.ts", import.meta.url))`, que o bundler empacota; testar no preview da Netlify a cada PR |
| **Service worker com cache velho** | o usuário não vê a versão nova | precache com hash de versão + aviso "Nova versão disponível — recarregar" |
| **Desempenho do SVG com 150 peças** | quedas abaixo de 60 fps | seletores finos, animações em CSS, `React.memo`, medição com teste automatizado na Fase 7 |
| **Projeto ainda ligado à Vercel** | builds duplicados ou falhando lá | desconectar na Vercel (seção 1) |

---

## 5. Ideias para deixar mais intuitivo que o FluidSIM (propostas)

1. **Linha do tempo com "voltar no tempo":** o motor guarda os últimos ~60 s de estado e o aluno arrasta um controle para rever o que aconteceu ("por que o cilindro B não avançou?"). Isso é barato porque o motor é determinístico.
2. **Números das vias sempre legíveis:** ao passar o mouse num conector, aparece "1 — alimentação", "2 — utilização", "3 — escape", "12/14 — pilotos". Ajuda muito quem está começando.
3. **Checagem antes de simular:** ao apertar ▶, se houver erro grave (bomba sem tanque, conector aberto), o app mostra a lista e um botão "simular mesmo assim", em vez de falhar em silêncio.
4. **"Mostrar o caminho do ar/óleo":** no modo Explique, destacar passo a passo por onde o fluido passa naquele instante (1 → 4 → câmara traseira → avanço).
5. **Peças rotuladas automaticamente** (1A, 1V1, 1S1, K1, Y1…) pela convenção didática usada no SENAI, com renumeração automática.

---

## 6. Registro das fases

### Fase 1 — Base ✅
- Projeto Next.js 16 (export estático) + React 19 + Tailwind 4 + Zustand + Vitest + Playwright, com `netlify.toml` e CI no GitHub Actions.
- Tela em 4 áreas + painel de baixo: barra de cima, biblioteca com busca (sem depender de acento), área de desenho e painel de propriedades com explicação de cada campo.
- Área de desenho: grade com ímã, zoom na roda do mouse/pinça, mover a tela (espaço + arrastar, botão do meio ou um dedo), seleção por clique, Shift e retângulo, mover arrastando, copiar/colar/duplicar, girar, espelhar, alinhar, mover com as setas.
- **29 peças com símbolo próprio** (pneumáticas, hidráulicas e elétricas), ainda sem simulação. As válvulas e os cilindros são gerados a partir de dados.
- Abas de circuitos, desfazer/refazer (um arraste = 1 passo), salvamento automático no IndexedDB, abrir projetos salvos, importar/exportar `.json` versionado, exportar SVG/PNG, tema claro/escuro, lista de peças.
- Testes: 79 unitários (geometria, editor, formato de arquivo, biblioteca) + 9 de tela.
- Antecipados de outras fases, porque saíram baratos: exportar SVG/PNG (Fase 7) e pinça/arraste no toque (Fase 7, versão básica).
- Ficou para a Fase 2: ligar linhas entre conectores (o modelo `Connection` já existe) e os controles da simulação, que já aparecem na barra mas estão desativados.

## 7. Próximo passo
Com o OK do usuário: **Fase 2 — Pneumática simples**.
