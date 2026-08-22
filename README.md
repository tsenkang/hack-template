# hack-template

Template Next.js pronto para hackathons de 48h.

## Como usar

```bash
git clone <url-do-repositorio>
cd hack-template
pnpm install
cp .env.example .env.local
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000) para ver o resultado.

## Stack

- **Next.js 16** — framework React com App Router e Server Components.
- **React 19** — biblioteca de UI.
- **Tailwind v4** — estilização utilitária, configurada via `@theme` no CSS.
- **shadcn/ui** (`base-nova`) — componentes acessíveis copiados para o repositório.
- **TypeScript** — tipagem estática em todo o projeto.
- **pnpm** — gerenciador de pacotes.

## Estrutura de pastas

```
app/                  # rotas, layouts e páginas (App Router)
  api/                # route handlers (API routes)
  layout.tsx          # layout raiz (fontes, ThemeProvider, Toaster)
  page.tsx            # página inicial
  globals.css         # Tailwind v4 + tema shadcn
components/
  ui/                 # componentes shadcn/ui
  *.tsx               # componentes custom do projeto
lib/
  utils.ts            # helper cn() usado pelo shadcn
  constants.ts        # constantes globais do app
```

## Adicionando componentes shadcn

Para adicionar um novo componente shadcn/ui ao projeto, rode:

```bash
pnpm dlx shadcn@latest add [nome]
```

Substitua `[nome]` pelo componente desejado (ex: `avatar`, `select`, `dropdown-menu`). O arquivo é criado em `components/ui/`.
