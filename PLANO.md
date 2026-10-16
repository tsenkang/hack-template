# FluxoLab — Plano do projeto

Simulador web de circuitos **pneumáticos, hidráulicos, eletropneumáticos e eletro-hidráulicos**, inspirado no FluidSIM, porém mais moderno e interativo. Símbolos desenhados do zero seguindo **ISO 1219** (fluídica) e **IEC 60617** (elétrica). Público: alunos de cursos técnicos, professores e técnicos de manutenção.

> Status: **Fase 7 — Acabamento** concluída. Todas as fases do plano foram entregues; falta o merge e a conexão na Netlify.

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

### Fase 2 — Pneumática simples ✅
- **Ligar linhas arrastando** de um conector até outro. O app "gruda" no conector compatível mais próximo e traça o tubo sozinho, só com linhas a 90°, desviando das peças (busca A* com penalidade por curva). Conectores soltos aparecem como anéis vazados, e um ponto cheio marca onde as linhas se juntam. Linhas podem ser selecionadas e apagadas, e copiar/colar leva junto as linhas entre as peças copiadas.
- **19 peças pneumáticas simuladas**: fonte de ar, unidade de conservação (regulador com alívio), manômetro com ponteiro, silenciador, ponto de ligação (T), cilindros de simples e dupla ação, válvulas 3/2 NF/NA (botão, alavanca, rolete, piloto), 5/2 (duplo piloto, piloto/mola, solenoide/mola, duplo solenoide), retenção e reguladora de vazão unidirecional.
- **Motor de simulação** (`src/engine`, sem React), rodando num Web Worker:
  - ar compressível com vazão pelo modelo ISO 6358;
  - redes resolvidas por análise nodal implícita com Newton + busca linear;
  - câmaras dos cilindros com volume variável (isotérmico) e mecânica da haste com atrito, em 8 subpassos;
  - êmbolo das válvulas com tempo de comutação e recobrimento;
  - pilotagem a partir de 1,5 bar;
  - roletes acionados pela posição da haste (rótulo do cilindro + % do curso);
  - conectores soltos escapam para a atmosfera.
- **Na tela**:
  - controles iniciar/pausar/parar, avançar 10 ms e velocidade de 0,1× a 10×, com atalhos F5 e Esc;
  - linhas coloridas pela pressão (também mais grossas, para não depender só da cor), legenda recolhível e traços animados no sentido do fluxo;
  - corpo das válvulas desliza como no FluidSIM;
  - clicar e segurar botões, alavancas, roletes e o acionamento manual dos solenoides;
  - parâmetros (ex.: pressão do regulador, abertura da reguladora de vazão) mudam com a simulação rodando;
  - edição travada enquanto simula.
- **Testes**: 105 unitários (inclui cilindro SA, cilindro DA, 5/2 pilotada com memória e sinal preso, retorno automático por rolete, controle de velocidade, retenção, regulador e roteamento) + 12 de tela (inclui montar o circuito com o mouse e simular).
- **Desempenho medido**: um circuito com 121 peças (201 redes) simula 2× mais rápido que o tempo real; os circuitos de aula, bem mais rápido.

**Decisões da Fase 2**
- O corpo inteiro da válvula desliza ao comutar (como no FluidSIM). O conector de piloto fica fixo, e a linha de comando estica até o acionamento.
- O solver usa matriz densa, que é simples e suficiente para circuitos de aula. Se um circuito muito grande ficar lento em 10×, a troca por um solver esparso entra na Fase 7, sem mudar o resto do motor.
- Peças elétricas e hidráulicas ainda não simulam (Fases 4 e 5). Por enquanto, o clique no solenoide funciona como o acionamento manual de emergência que as válvulas reais têm.

### Fase 3 — Pneumática completa ✅
- **Biblioteca pneumática: 46 peças.**
  - Fonte e alimentação: compressor (vazão limitada) e reservatório de ar.
  - Atuadores: cilindros com amortecimento, de haste dupla e sem haste; garra; motor pneumático (com rpm na tela); gerador de vácuo e ventosa.
  - Válvulas direcionais: 2/2; 3/2 com pedal; 4/2 e 5/2 com alavanca e trava; 5/3 de centro fechado, aberto (escape) e pressurizado.
  - Bloqueio, lógica e vazão: simultaneidade (E), alternadora (OU), escape rápido, reguladora de vazão bidirecional.
  - Pressão: regulador, alívio e válvula de sequência.
  - Sinal: sensor de proximidade, rolete escamoteável (gatilho), temporizadores com retardo na ligação e no desligamento, contador com reset.
- **Motor**:
  - novos acionamentos (pedal, trava, rolete escamoteável que só aciona num sentido, proximidade);
  - válvulas de 3 posições centradas por molas e pressão de comutação ajustável;
  - amortecimento de fim de curso, tratado de forma implícita (estável);
  - redes internas para peças com volume próprio (reservatório do temporizador).
  - Os temporizadores são pneumáticos de verdade (agulha + reservatório), calibrados para o tempo ajustado com erro abaixo de ±20% nos testes.
- **Detector de erros**:
  - no desenho: sem fonte de ar, conector solto (escapes 3 e 5 são permitidos), piloto sem sinal, rolete apontando para cilindro inexistente, rótulo repetido;
  - na simulação: sobrepressão, sinal preso e ar escapando por conector solto.

  Os avisos aparecem na aba "Avisos" (com contador), como selos "!" nas peças e, ao clicar, a tela leva até a peça. Ao iniciar uma simulação com erro grave, o app pergunta antes.
- **Diagrama de fases** (trajeto-tempo) desenhado durante a simulação: uma faixa por cilindro, passos numerados automaticamente e tooltip com tempo e posição.
- **Inserir peça sobre uma linha**: soltar uma peça da biblioteca em cima de um tubo encaixa a peça no meio, girando se precisar e respeitando o sentido (ex.: entrada da retenção do lado de onde vem o ar).
- **Rastro do sinal**: selecionar uma linha destaca todas as linhas ligadas a ela.
- **Testes**: 188 unitários, incluindo:
  - E, OU, escape rápido, temporizadores, contador, 5/3 parando no meio, trava, sequência, gatilho, haste dupla, amortecimento, motor, vácuo e avisos;
  - a sequência **A+ B+ B− A−**: com roletes escamoteáveis ela completa os quatro passos; com roletes comuns ela trava por sinal preso e gera o aviso.

  E 16 de tela (incluindo detector de erros, inserir sobre linha e diagrama de fases).

**Decisões da Fase 3**
- O diagrama é **trajeto-tempo** com os passos marcados por cima (um passo começa quando algum cilindro sai do repouso). Assim ele mostra ao mesmo tempo a ordem dos passos e a duração de cada um.
- O **pressostato** foi para a Fase 4, porque ele gera um sinal elétrico. A válvula de sequência cobre o caso pneumático.
- **Cruzamento sem ligação** não virou peça: linhas que se cruzam não se ligam, e o ponto cheio só aparece onde as linhas realmente se juntam (num conector ou no ponto de ligação T).

### Fase 4 — Elétrica ✅
- **33 peças elétricas** (IEC 60617):
  - fontes: +24 V / 0 V e fase / neutro (220 V);
  - comandos: botões NA e NF, botão com trava, emergência (cogumelo com trava), seletoras de 2 e 3 posições;
  - contatos de relé: NA, NF e reversor;
  - fins de curso mecânicos NA e NF; sensores indutivo, capacitivo, óptico e magnético (reed); pressostato com conector pneumático;
  - bobinas: relé, contator, solenoide de válvula, relés temporizados (retardo na ligação e no desligamento), contador e reset do contador;
  - saídas: lâmpada (4 cores) e buzina;
  - proteção e componentes: fusível, disjuntor, diodo e resistor.
- **Motor elétrico** (`src/engine/electric`): tensões e correntes por análise nodal.
  - Cada carga tem sua resistência nominal; contato fechado vale 0,01 Ω; diodos e fusíveis são resolvidos por iteração.
  - O relé atraca no passo seguinte, como na realidade; assim, selo e intertravamento funcionam sem laços infinitos.
  - Temporizadores, contadores e solenoides são ligados pelo rótulo (K1, C1, Y1).
  - **Curto-circuito**: o fusível no caminho queima (clique para trocar); sem fusível, a fonte desliga e aparece o aviso.
  - Aviso de **sobretensão** (ex.: lâmpada de 24 V ligada em 220 V).
- **Eletropneumática**:
  - a válvula com solenoide ganha o rótulo Y1, Y2… (numerado sozinho);
  - a bobina elétrica com o mesmo rótulo aciona a válvula;
  - sensores e fins de curso leem a posição da haste;
  - o pressostato lê a pressão da rede de ar.
- **Na tela**:
  - contatos abrem e fecham no desenho, bobinas energizadas ficam laranja e lâmpadas acendem na cor escolhida;
  - fios com corrente ficam vermelhos com traços andando; fios só com tensão ficam vermelho-claro.
  - **Esquema em escada**: as colunas de corrente são numeradas sozinhas, e cada bobina de relé mostra ao lado a tabela das colunas onde estão os contatos NA e NF dela.
  - A legenda da simulação virou uma faixa fixa abaixo das abas: continua sempre visível e não cobre mais o circuito, o que o teste de tela mostrou ser um problema em telas menores.
- **Detector de erros**: circuito elétrico sem fonte, contato sem bobina correspondente, solenoide sem válvula, válvula com solenoide sem bobina (dica) e rótulo de bobina repetido.
- **Testes**: 253 unitários, incluindo:
  - lâmpada, **selo**, **intertravamento**, relé temporizado (±5%), contador com reset;
  - **curto-circuito** com e sem fusível, emergência, diodo, sobretensão;
  - circuito eletropneumático completo (botão → Y1 → válvula → cilindro → sensor reed → lâmpada; pressostato).

  E 17 de tela, incluindo selo + solenoide + sensor num projeto de exemplo (`e2e/fixtures/electro-seal.json`).

**Decisões da Fase 4**
- **Sensores com dois fios**: indutivo, capacitivo e óptico foram modelados como um contato NA, em vez de 3 fios (+, 0, sinal). Fica mais simples para o aluno e o comportamento lógico é o mesmo. Se a escola quiser treinar a ligação de 3 fios (PNP/NPN), dá para acrescentar depois.
- **Corrente alternada**: 220 V CA é tratada pelo valor eficaz, o que basta para o comando: liga/desliga, sobretensão e curto.
- **Um clique rápido nunca se perde**: um botão apertado e solto entre dois passos fica apertado por pelo menos um passo da simulação.

### Fase 5 — Hidráulica ✅
- **37 peças hidráulicas**:
  - alimentação: motobomba fixa e variável com compensador de pressão, tanque;
  - condicionamento e medição: filtro, resfriador, aquecedor, acumulador a gás, manômetro, medidor de vazão, termômetro, ponto de ligação;
  - atuadores: cilindros de simples ação, dupla ação, com amortecimento e de haste dupla; motor hidráulico;
  - direcionais: 2/2, 3/2, 4/2 (solenoide e alavanca com trava), 4/3 de centro fechado, aberto, tandem e flutuante, 4/3 com alavanca;
  - pressão: alívio, redutora, sequência, contrabalanço;
  - vazão: estrangulador fixo, ajustável e unidirecional, reguladora compensada;
  - bloqueio: retenção e retenção pilotada;
  - controle contínuo: válvula proporcional e servoválvula (comando de −100% a 100%, ajustável com a simulação rodando).
- **Motor**:
  - a rede de fluido virou genérica (`FluidNetwork` + "meio" ar/óleo): o mesmo solver implícito resolve o ar e o óleo, só muda a física de cada nó (ar como gás ideal; óleo com módulo de compressibilidade de 1 GPa) e a lei de vazão (turbulenta, Q ∝ √Δp);
  - os subpassos da mecânica se ajustam sozinhos à "mola" de óleo, que é muito mais dura que a de ar;
  - bomba como fonte de vazão; acumulador com gás (p·V constante); motor hidráulico com torque de carga;
  - válvulas de pressão abrindo numa faixa estreita em torno do ajuste.
- **Eletro-hidráulica**: os solenoides Y1/Y2 das válvulas hidráulicas são comandados pelo esquema elétrico, igual à eletropneumática.
- **Na tela**: óleo com pressão em laranja (mais forte = mais pressão), retorno ao tanque em azul-esverdeado, óleo parado em tom claro, com fluxo animado e legenda própria. Linhas de piloto/dreno ficam tracejadas.
- **Detector de erros**: circuito sem bomba, sucção da bomba fora do tanque, conector de óleo solto (fica tampado no simulador).
  - **Correção**: projetos só elétricos ou só hidráulicos não acusam mais "falta fonte de ar" (defeito que vinha da Fase 4).
- **Testes**: 327 unitários. Os de hidráulica:
  - **alívio limitando a pressão** em 100 bar (±8%);
  - velocidade do cilindro = vazão ÷ área (±25%);
  - centro tandem descarregando a bomba e centro fechado segurando o cilindro;
  - reguladora compensada com a mesma velocidade sem carga e com 6 kN (diferença abaixo de 10% e valor absoluto ±15%);
  - acumulador (≈50% de carga a 100 bar com pré-carga de 50 bar);
  - motor (rpm = vazão ÷ deslocamento);
  - retenção pilotada segurando a carga;
  - eletro-hidráulica.

  E 18 de tela, incluindo o exemplo `e2e/fixtures/electro-hydraulic.json`.

**Decisões da Fase 5**
- **Conector de óleo solto fica tampado** no simulador (em vez de "derramar"). Assim a simulação continua estável, e o detector de erros avisa.
- **Trepidação em baixa velocidade**: um teste mostrou que, em velocidade baixa, o cilindro hidráulico trepidava (*stick-slip*). A trepidação existe na prática, mas aqui estava exagerada. Por isso o cilindro hidráulico usa amortecimento viscoso de 10 000 N·s/m e atrito de partida de 1% da força a 100 bar, valores típicos de vedações em óleo. O pneumático continua com os valores anteriores.
- **Temperatura do óleo** não é simulada: o termômetro mostra o valor ajustado, e o motor usa as propriedades do óleo a 40 °C.

### Fase 6 — Interatividade avançada ✅
- **CLP com ladder e GRAFCET** (peça nova *Elétrica · CLP*): 8 entradas I0…I7 (ligam com 24 V), 8 saídas Q0…Q7 (ligam o L+ na saída), alimentação L+/M.
  - O programa fica dentro do projeto e é editado numa janela própria (dois cliques no CLP ou “Editar programa”).
  - **Ladder**: cada degrau é uma condição em texto (`(I0 | Q0) & !I1`) desenhada como contatos em série/paralelo, com bobina de saída, SET, RESET, temporizadores TON/TOF e contador CTU com reset. Na simulação, contatos fechados e bobinas ligadas ficam coloridos.
  - **GRAFCET**: etapas com ações, transições com condição, divergência/convergência em E e temporização `3s/X2`. O diagrama é desenhado ao lado, com as etapas ativas coloridas ao vivo.
  - Os dois podem ser usados juntos (o GRAFCET roda antes do ladder, como num ciclo de varredura). Programas com erro aparecem nos avisos.
- **Gráficos ao vivo** (aba Gráficos): posição e velocidade dos cilindros, pressão dos manômetros, vazão, rotação de motores e tensão nas bobinas. Uma faixa por grandeza, mesmo eixo de tempo, cursor com os valores. Escolha automática (cilindros e manômetros) ou manual.
- **Modo Explique** (botão na barra de cima): o painel da direita mostra o princípio da categoria da peça e, durante a simulação, frases sobre o que ela está fazendo agora (“a válvula está acionada: 1→4, 2→3”, “a haste avança a 0,25 m/s”) e a pressão em cada conector.
- **Modos Aluno e Professor** (seletor na barra): o aluno não vê as soluções; o professor vê, e pode **criar exercícios**: monta a solução, simula acionando os botões, e o roteiro gravado vira a correção automática. O exercício é baixado em `.json` (com ou sem solução) e o aluno importa.
- **Exercícios guiados** (aba Exercícios): 12 exercícios do básico ao avançado (comando direto até GRAFCET no CLP e hidráulica), com enunciado, rótulos obrigatórios e dicas uma a uma. O botão **Conferir** roda o circuito do aluno sozinho, aciona os botões do roteiro na hora certa e compara a ordem dos movimentos (a mesma do diagrama de fases).
- **49 circuitos prontos** (aba Circuitos), com busca, nível e explicação passo a passo: 21 de pneumática (comandos direto/indireto, E/OU, memória, temporizador, contador, A+B+A−B−, A+B+B−A− com escamoteável e cascata, vácuo, regulador…), 11 de eletropneumática (selo, fim de curso, ciclo contínuo, relé de tempo, contador, 5/3 com emergência, pressostato, bimanual), 4 de CLP, 11 de hidráulica (alívio, meter-out, compensada, motor, acumulador, retenção pilotada, sequência, redutora, contrabalanço, proporcional) e 2 de eletro-hidráulica.
  - **Todos são testados**: cada circuito monta sem erros, e os que têm roteiro precisam fazer exatamente a sequência esperada (ex.: `A+ B+ B− A−`).
- **Paleta Ctrl+K**: uma busca para ações (simular, salvar, exportar, tema, modo Explique…), inserir peças, abrir circuitos prontos e exercícios.
- Peça nova: **3/2 NF com alavanca e trava** (chave liga/desliga pneumática, para ciclo contínuo).
- **Testes**: 442 unitários (incluindo os 49 circuitos e os 12 exercícios, cuja solução precisa passar na correção e cujo projeto inicial não pode passar) e 23 de tela. O critério da fase, **um exercício corrigido automaticamente**, é testado na tela: errado sem ligações e “Correto” depois de montar.

**Decisões da Fase 6**
- **Ladder escrito como condição em texto, desenhado automaticamente**, em vez de um editor de arrastar contatos. É mais rápido de editar no teclado, não tem como ficar “meio ligado”, e o desenho sai sempre certo. A sintaxe é a mesma das transições do GRAFCET.
- **Correção dos exercícios pela sequência dos cilindros**, rodando o circuito do aluno sem o Worker. Assim qualquer solução correta passa (ex.: o A+B+B−A− aceita escamoteável, cascata ou CLP), sem exigir uma montagem igual à do gabarito.
- **Exercícios do professor ficam no navegador e circulam como arquivo**, já que o site não tem servidor. O projeto inicial do aluno é gerado sozinho (só cilindros e fontes).
- **Duplo clique no CLP**: a área de desenho captura o ponteiro para arrastar, então o duplo clique é contado “na mão”.

### Fase 7 — Acabamento ✅
- **PWA instalável e offline**:
  - `manifest.webmanifest` e ícones (192, 512 e “maskable”);
  - service worker próprio, gerado depois do build por `scripts/build-sw.mjs`, que guarda todos os arquivos do site com uma versão calculada pelo conteúdo;
  - depois do primeiro acesso o app abre e **simula sem internet** (o Web Worker também sai do cache);
  - versão nova → aviso “Nova versão disponível — Recarregar”;
  - o `netlify.toml` deixa `sw.js` e o manifest sem cache.
- **Exportar PDF**: uma página A4 deitada por aba (desenho em alta resolução + título e data) e a lista de peças no fim. O PDF é gerado no próprio navegador, sem biblioteca. As imagens exportadas (SVG/PNG/PDF) ganharam os estilos de linhas e do esquema em escada, que antes saíam pretos.
- **Tablet**:
  - abaixo de 1024 px de largura, biblioteca e propriedades viram gavetas (botões nos cantos da barra);
  - botões e conectores maiores em telas de toque;
  - toque segura e aciona válvulas e botões;
  - pinça para zoom (já existia).
- **Modo apresentação**: tela cheia, sem painéis, barra com controles grandes e linhas mais grossas. Sai com Esc ou com o botão.
- **Acessibilidade**:
  - auditoria automática com axe (WCAG 2.1 A/AA) nos temas claro e escuro, **sem violações graves**: as abas foram reestruturadas e a área rolável do painel de baixo recebe foco;
  - as peças do desenho entram no Tab, Enter seleciona e Espaço/Enter aciona durante a simulação.
- **Idiomas**: português, **inglês e espanhol**.
  - O seletor fica na barra; na primeira vez vale o idioma do navegador, e a escolha fica salva.
  - O `<html lang>` acompanha o idioma, e números e datas usam o formato de cada idioma.
  - Um teste confere que os três dicionários têm as mesmas chaves e as mesmas variáveis.
- **Desempenho** com 150 peças (30 cilindros em ciclo contínuo):
  - cada peça e cada linha leem só o próprio estado da simulação, e uma linha só é redesenhada quando a aparência dela muda (cor ou velocidade da animação);
  - os estados que chegam do Worker são juntados num por quadro da tela;
  - a pressão de cada conector vai só a cada 6 quadros;
  - peças fora da tela não acompanham a simulação;
  - textos ilegíveis (zoom abaixo de 42%) são escondidos;
  - os textos do dicionário ficam em cache.
- **README final** com tudo o que o app faz, atalhos, publicação, domínio próprio e como acrescentar peças, circuitos e exercícios.
- **Testes**: 445 unitários e 32 de tela. Os de tela incluem:
  - PWA offline;
  - PDF;
  - tablet com toque;
  - apresentação;
  - acessibilidade nos dois temas;
  - teclado;
  - troca de idioma;
  - medição de quadros por segundo.

**Decisões e limites da Fase 7**
- **60 quadros por segundo com 150 peças: meta não comprovada.** Na máquina de testes (servidor sem placa de vídeo, 4 núcleos), a medição com 150 peças simulando ao mesmo tempo dá:
  - **45 a 57 quadros/s** na vista de trabalho (zoom normal);
  - **33 a 42 quadros/s** com as 150 peças na tela (zoom 30%).

  Antes das otimizações eram 24. Com a simulação pausada e o fluxo animando, ficam 60 quadros/s. O custo que sobra é o navegador redesenhar o SVG a cada estado novo. Num computador com placa de vídeo deve ficar mais perto de 60, mas isso não foi medido. O teste automático exige pelo menos 40 e 25 quadros/s, para não falhar na máquina de CI.
- **Textos dos circuitos prontos e dos exercícios só em português.** A interface inteira está nos três idiomas. Os roteiros (49 circuitos, 12 exercícios) são conteúdo didático longo e ficam marcados como `lang="pt-BR"`, com um aviso quando outro idioma está escolhido.
- **PDF com o desenho como imagem** (JPEG em alta resolução), e não vetorial: assim não entra nenhuma biblioteca de PDF no site.
- **Lighthouse** não roda nesta máquina. Em vez dele, o teste de tela confere o que o Lighthouse olha para PWA: manifest, ícones e service worker, abrindo e simulando com a rede desligada.

## 7. Próximo passo
1. Revisar e fazer o merge do PR na `main`.
2. Conectar o repositório na Netlify (seção 1); o link do site sai na hora (`https://<nome>.netlify.app`).
3. Desconectar o projeto antigo na Vercel.
4. Opcional: domínio próprio (passos no README).
