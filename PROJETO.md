# Eleitores 2026 - Plataforma de Gestão Política SaaS

## Stack
- Next.js 16 (App Router)
- React + TypeScript
- TailwindCSS
- Firebase Authentication
- Firebase Firestore
- Recharts (gráficos)
- Lucide React (ícones)
- xlsx, jspdf (exportação)
- react-hot-toast (notificações)
- Deploy: Vercel

## Estrutura de Pastas
```
src/
  app/                    # Páginas (App Router)
    login/                # Login
    dashboard/            # Dashboard (varia por role)
    eleitores/            # CRUD de eleitores
    coordenadores/        # Gerenciar coordenadores
    colaboradores/        # Gerenciar colaboradores
    campanhas/            # Super Admin - gerenciar campanhas
    relatorios/           # Relatórios com filtros
    exportacoes/          # Exportação Excel/CSV/PDF/JSON
    metas/                # Metas e produtividade
    logs/                 # Auditoria de atividades
    configuracoes/        # Configurações do sistema
    (protected)/layout.tsx # Layout protegido
  components/
    ui/                   # GlassCard, Input, Select, Button, Badge, Modal
    layout/               # Sidebar (menus dinâmicos por role)
    dashboard/            # StatCard animado
    charts/               # ApoiadoresPorCidade, CrescimentoDiario, etc.
    forms/                # EditarEleitorModal
  contexts/
    AuthContext.tsx        # Contexto de autenticação + role
  lib/
    firebase.ts           # Config Firebase
    firestore.ts          # Funções Firestore (CRUD + campanhaId)
    permissions.ts        # Verificações de permissão por role
    utils.ts              # formatDate, parseDate, etc.
    estados-cidades.ts    # Estados e cidades do Brasil
  types/
    index.ts              # Tipos + ROLE_CONFIG
```

## Hierarquia de Roles (5 níveis)
| Role    | Acesso | Ícone | Cor   |
|---------|--------|-------|-------|
| super_admin | Controle total global | 🔱 | Rosa |
| admin       | Admin de campanha | 👑 | Roxo |
| politico    | Dono da campanha | 🏛️ | Âmbar |
| coordenador | Gerencia equipe | 🎯 | Azul |
| colaborador | Cadastro rápido | ⚡ | Verde |

## Rotas por Role
### Super Admin
- Dashboard Global, Campanhas, Eleitores, Coordenadores, Colaboradores, Relatórios, Exportações, Metas, Logs, Configurações

### Admin / Político
- Dashboard, Eleitores, Coordenadores, Colaboradores, Relatórios, Exportações, Metas, Configurações

### Coordenador
- Dashboard Equipe, Eleitores, Colaboradores, Relatórios, Metas

### Colaborador
- Novo Cadastro, Meus Cadastros, Minha Meta

## Funcionalidades Implementadas
- Autenticação Firebase com 5 níveis de acesso
- Multi-tenant (campanhaId isola dados entre campanhas)
- Cadastro rápido de eleitores com estados/cidades dinâmicos
- Detecção de títulos duplicados
- CRUD completo de eleitores (editar/excluir)
- CRUD de coordenadores (editar/ativar/desativar)
- CRUD de colaboradores (criar/editar)
- Gerenciamento de campanhas (Super Admin)
- Dashboard com gráficos Recharts
- Ranking de produtividade (top 3)
- Exportação Excel, CSV, PDF, JSON
- Logs de auditoria (quem editou/excluiu)
- Metas e evolução diária
- Tema escuro com glassmorphism
- Mobile-first, responsivo
- Sidebar retrátil com menus dinâmicos
- Firestore Rules configuradas
- Pronto para deploy na Vercel

## Usuário Super Admin
- Email: wnetgus@gmail.com
- Hardcoded no AuthContext como super_admin
- Pode criar campanhas que geram automaticamente contas de políticos

## Config Firebase
- Project: eleitores2026-b4493
- Config em .env.local

## Próximos Passos Possíveis
- Recuperação de senha (email reset)
- Upload de foto do eleitor
- Notificações push
- Chat interno
- Mapa de calor por região
- Versão PWA para mobile
