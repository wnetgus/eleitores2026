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
    ui/               # Input, Select, Button, Badge, GlassCard, Modal, BuscaGlobal, BuscaOperacional
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

## Sistema de Busca (Fase 1 — Implementado)

### 1. Busca Global (`BuscaGlobal.tsx`)
- **Atalho:** Ctrl+K
- **Função:** Navegação rápida entre páginas (overlay modal)
- **Placeholder dinâmico** por role via `getSearchPlaceholder(role)`
- **Escopo hierárquico** via `filtrarPorRole()`
  - super/admin: busca total
  - assessor/politico/pref/vereador: própria coalizão
  - coordenador: seus colaboradores
  - colaborador: não vê (componente retorna null)
- **Onde aparece:** No cabeçalho de cada página (eleitores, colaboradores, coordenadores, assessores)

### 2. Busca Operacional (`BuscaOperacional.tsx`)
- **Função:** Filtrar/manipular a lista da página atual
- **Navegação hierárquica contextual** — selects dependentes em cadeia
- **Cadeia completa:** Gabinete → Assessor → Coordenador → Colaborador → input textual
- **Regras por role:**
  | Role | Níveis visíveis |
  |---|---|
  | super_admin / admin_master | Gabinete → Assessor → Coordenador → Colaborador |
  | politico / prefeito / vereador | Assessor → Coordenador → Colaborador |
  | assessor | Coordenador → Colaborador |
  | coordenador | Colaborador |
  | colaborador | nada |
- **Comportamento:** cada select depende do anterior; mudar um nível superior reseta os inferiores
- **Onde aparece:** Abaixo do título, antes da lista de cada página

### 3. Interface `FiltrosOperacionais`
```ts
interface FiltrosOperacionais {
  texto: string;
  gabineteId?: string;
  assessorId?: string;
  coordenadorId?: string;
  colaboradorId?: string;
}
```
- Cada página aplica `useMemo` para filtrar sua lista local com base nos filtros recebidos via `onFilter`
- Props do BuscaOperacional: `pagina`, `userData`, `gabinetes`, `assessores`, `coordenadores`, `colaboradores`, `onFilter`

## Próximos Passos (Fase 2 — Central Operacional)
- Visão Estratégica: hierarquia, contexto, expansão/recolhimento, coalizão
- Visão Operacional: tabela unificada, exportação, ações rápidas, manutenção
- Mapa Político escopado por role
- Dashboard com filtros territoriais

---

## Cenário de Teste v3.0 — ATIVO (criado 2026-05-22)

Cenário controlado, determinístico e rastreável para validação hierárquica territorial.
Script: `scripts/seed-cenario-v3.mjs`

```bash
npm run seed:v3          # criar
npm run seed:v3:reset    # apagar e recriar
npm run clean:fake       # limpar (usa manifesto _seed_manifest/cenario_01)
```

### Estrutura
| Nível | Qtd | Todos têm Auth |
|---|---|---|
| Deputado Federal | 1 | ✅ |
| Assessores | 3 | ✅ |
| Coordenadores | 6 | ✅ |
| Mobilizadores | 14 | ✅ |
| Eleitores | 141 | — |

**Território:** Pernambuco — Recife · Caruaru · Petrolina
**Gabinete:** "Ricardo Alves — Pernambuco 2026"
**Senha padrão:** `111111`

### Logins completos

| Role | Email | Nome | Território |
|---|---|---|---|
| **Deputado** | `dep.federal@mail.com` | Ricardo Alves | PE (geral) |
| Assessor | `assessor.recife@mail.com` | Carlos Menezes | Recife · dominante |
| Assessor | `assessor.caruaru@mail.com` | Ana Ferreira | Caruaru · equilibrado |
| Assessor | `assessor.petrolina@mail.com` | Pedro Santos | Petrolina · crescendo |
| Coord | `coord.recife.boaviagem@mail.com` | Marcos Lima | Boa Viagem/Recife |
| Coord | `coord.recife.imbiribeira@mail.com` | Juliana Costa | Imbiribeira/Recife |
| Coord | `coord.caruaru.centro@mail.com` | Roberto Silva | Centro/Caruaru |
| Coord | `coord.caruaru.indianopolis@mail.com` | Fernanda Luz | Indianópolis/Caruaru |
| Coord | `coord.petrolina.centro@mail.com` | Diego Campos | Centro/Petrolina |
| Coord | `coord.petrolina.areia@mail.com` | Patrícia Neves | Areia/Petrolina |
| Mob | `mob.recife.boaviagem.1@mail.com` | Tânia Silva | Boa Viagem/Recife |
| Mob | `mob.recife.boaviagem.2@mail.com` | Lucas Ramos | Boa Viagem/Recife |
| Mob | `mob.recife.boaviagem.3@mail.com` | Beatriz Moura | Boa Viagem/Recife |
| Mob | `mob.recife.imbiribeira.1@mail.com` | Rafael Cruz | Imbiribeira/Recife |
| Mob | `mob.recife.imbiribeira.2@mail.com` | Camila Pinto | Imbiribeira/Recife |
| Mob | `mob.caruaru.centro.1@mail.com` | Anderson Dias | Centro/Caruaru |
| Mob | `mob.caruaru.centro.2@mail.com` | Sandra Barros | Centro/Caruaru |
| Mob | `mob.caruaru.centro.3@mail.com` | Felipe Torres | Centro/Caruaru |
| Mob | `mob.caruaru.indianopolis.1@mail.com` | Vanessa Rocha | Indianópolis/Caruaru |
| Mob | `mob.caruaru.indianopolis.2@mail.com` | Eduardo Melo | Indianópolis/Caruaru |
| Mob | `mob.petrolina.centro.1@mail.com` | Simone Araújo | Centro/Petrolina |
| Mob | `mob.petrolina.centro.2@mail.com` | Henrique Lima | Centro/Petrolina |
| Mob | `mob.petrolina.areia.1@mail.com` | Letícia Souza | Areia/Petrolina |
| Mob | `mob.petrolina.areia.2@mail.com` | Rodrigo Fonseca | Areia/Petrolina |

### Cadeia de teste recomendada (Recife · dominante)
```
dep.federal@mail.com          (Ricardo Alves — Deputado)
  └─ assessor.recife@mail.com         (Carlos Menezes — Assessor)
       └─ coord.recife.boaviagem@mail.com  (Marcos Lima — Coord)
            └─ mob.recife.boaviagem.1@mail.com (Tânia Silva — Mob)
                 └─ 15 eleitores vinculados · Boa Viagem/Recife
```

### Distribuição de eleitores por território
| Território | Eleitores | Perfil |
|---|---|---|
| Recife — Boa Viagem | 45 | dominante |
| Recife — Imbiribeira | 24 | dominante |
| Caruaru — Centro | 30 | equilibrado |
| Caruaru — Indianópolis | 16 | equilibrado |
| Petrolina — Centro | 14 | crescendo |
| Petrolina — Areia | 12 | crescendo |
| **Total** | **141** | |

### Super Admin preservado
`wnetgus@gmail.com` — não pertence ao cenário fake, não é removido em nenhum reset.
