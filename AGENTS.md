<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ELEITORES 2026 — Guia do Projeto

## Stack
- Next.js 16 (App Router) + React + TypeScript + TailwindCSS
- Firebase Auth + Firestore
- Recharts (gráficos) + Lucide React (ícones)
- xlsx + jspdf + exceljs (exportação)
- react-hot-toast (notificações)

## Roles (8 níveis)
| Role | Tipo | Acesso |
|---|---|---|
| super_admin | Admin | Total |
| admin_master | Admin | Total |
| politico | Política | Visão executiva regional |
| prefeito | Política | Visão municipal |
| vereador | Política | Visão local |
| assessor | Operação | Gestão do gabinete |
| coordenador | Operação | Gestão de equipe |
| colaborador | Operação | Cadastro de rua |

## Comandos Úteis
```bash
npm run dev          # Iniciar dev server
npm run build        # Build de produção
npm run clean:auth   # Limpar contas de teste (Auth)
npm run clean:firestore  # Limpar dados de teste (Firestore)
npm run clean:all    # Limpar tudo
```

## Estrutura de Pastas
```
src/
  app/
    (protected)/      # Layout protegido (sidebar)
    admins/           # Gerenciar Admin Masters
    assessores/       # Gerenciar Assessores
    campanhas/        # Gerenciar Gabinetes
    candidatos/       # Gerenciar Candidatos + importação planilha
    colaboradores/    # Gerenciar Colaboradores
    configuracoes/    # Configurações + reset
    coordenadores/    # Gerenciar Coordenadores
    dashboard/        # Dashboard principal (filtros por role)
    eleitores/        # Cadastro de eleitores
    exportacoes/      # Exportação premium
    gabinete/[id]/    # Painel do gabinete
    login/            # Login
    logs/             # Auditoria
    mapa-politico/    # Mapa Político (árvore hierárquica)
    metas/            # Metas e produtividade
    relatorios/       # Relatórios
  components/
    ui/               # Input, Select, Button, Badge, GlassCard, Modal
    layout/           # Sidebar (menus dinâmicos por role)
    dashboard/        # StatCard
    charts/           # Gráficos Recharts
    forms/            # EditarEleitorModal
  contexts/
    AuthContext.tsx   # Contexto de autenticação
  lib/
    firebase.ts       # Config Firebase
    firestore.ts      # Funções Firestore
    permissions.ts    # Funções de permissão
    reports.ts        # Exportação premium (Excel/PDF)
    utils.ts          # Máscaras, formatação
    estados-cidades.ts
  types/
    index.ts          # Tipos + ROLE_CONFIG
```

## Regras de Desenvolvimento
1. Sempre verificar permissões antes de criar novas páginas
2. Usar `isSuperOrMaster()` para acesso administrativo global
3. Usar `isPolitico()`, `isPrefeito()`, `isVereador()` para acesso político
4. Usar `isAssessor()`, `isCoordenador()`, `isColaborador()` para acesso operacional
5. Dados de teste: senha `111111`
6. Evitar `undefined` no Firestore — usar `if (valor) dados.chave = valor`
7. Mapa Político: árvore sempre desce, nunca sobe, sem loops
8. Dashboard: filtros por cidade (deputado) e bairro (prefeito)
