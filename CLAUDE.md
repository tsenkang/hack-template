@AGENTS.md

# hack-template

Starter para hackathons de 48h. Base pronta para sair codando no dia 1 sem perder tempo com setup.

## Stack

- **Next.js 16** — App Router, Server Components por padrão
- **React 19**
- **Tailwind v4** — configurado via `@theme inline` em `app/globals.css` (sem `tailwind.config.ts`)
- **shadcn/ui** (estilo `base-nova`) — componentes em `components/ui/`
- **TypeScript**
- **pnpm** — gerenciador de pacotes do projeto

## Convenções

- **App Router**: rotas e layouts vivem em `app/`, seguindo as convenções de arquivo do Next.js (`page.tsx`, `layout.tsx`, etc).
- **Server Components por padrão**: só adicione `"use client"` no topo do arquivo quando o componente realmente precisar de interatividade (hooks de estado, event handlers, APIs do browser).
- **Idioma do código**: comentários, textos de UI e mensagens ficam em **português**. Nomes de variáveis, funções, componentes e arquivos ficam em **inglês**.
- Este projeto usa uma versão do Next.js com mudanças que podem divergir do que você já conhece — antes de escrever código, confira `node_modules/next/dist/docs/` para as convenções corretas (ver instruções no topo deste arquivo).

## Estrutura de pastas

```
app/                  # rotas, layouts e páginas (App Router)
  api/                # route handlers (API routes)
  layout.tsx          # layout raiz (fontes, ThemeProvider, Toaster)
  page.tsx            # página inicial
  globals.css         # Tailwind v4 + tema shadcn
components/
  ui/                 # componentes shadcn/ui (gerados via CLI, evite editar à mão)
  *.tsx               # componentes custom do projeto
lib/
  utils.ts            # helper cn() usado pelo shadcn
  constants.ts        # constantes globais do app
```

## Comandos

```bash
pnpm install     # instala as dependências
pnpm dev         # sobe o servidor de desenvolvimento
pnpm build       # gera o build de produção
```

## Componentes shadcn já instalados

`button`, `card`, `input`, `dialog`, `tabs`, `badge`, `skeleton`, `separator`, `textarea`, `label`, `dropdown-menu`, `sheet`, `table`, `sonner`.

Para adicionar outro componente:

```bash
pnpm dlx shadcn@latest add [nome]
```
