# ELEITORES2026 - QA RC

Este documento registra os seletores estaveis de QA adicionados para os testes de Release Candidate.

Regra operacional: sempre testar o Preview Branch. Nunca testar Production diretamente.

## Logins de Teste

Senha para todos: `111111`

| Perfil | Email |
| --- | --- |
| Deputado | `deputado@teste.com` |
| Assessor Executivo | `assessor.executivo@mail.com` |
| Coordenador | `coord.recife.boaviagem@mail.com` |
| Colaborador | `mob.recife.boaviagem.1@mail.com` |

## Fluxos Criticos

1. Deputado cria determinacao.
2. Assessor Executivo aceita e presta contas.
3. Colaborador cadastra eleitor no mobile.
4. Export XLSX.

## Test IDs por Arquivo

### `src/components/layout/Sidebar.tsx`

- `sidebar`
- `sidebar-item-dashboard`
- `sidebar-item-sala-situacao`
- `sidebar-item-notificacoes`
- `sidebar-item-eleitores`
- `sidebar-item-relatorios`
- `sidebar-item-cadastro-rapido`
- `sidebar-badge-notificacoes`

### `src/app/dashboard/page.tsx`

- `btn-abrir-determinacao`
- `modal-determinacao`
- `input-assunto-determinacao`
- `textarea-descricao-determinacao`
- `select-prioridade-determinacao`
- `btn-enviar-determinacao`
- `badge-ae-nao-encontrado`

### `src/app/dashboard/DashboardExecutivo.tsx`

- `card-determinacao`
- `btn-aceitar-determinacao`
- `btn-abrir-missao`
- `btn-prestar-contas`
- `badge-em-andamento`
- `modal-prestacao`
- `textarea-resultado-prestacao`
- `btn-enviar-prestacao`

### `src/app/notificacoes/page.tsx`

- `pagina-notificacoes`
- `card-notificacao`
- `btn-marcar-lida`
- `btn-arquivar-notificacao`
- `btn-abrir-origem`

### `src/app/eleitores/page.tsx`

- `pagina-eleitores`
- `lista-eleitores`
- `card-eleitor`
- `btn-ver-mais-eleitores`

### `src/app/exportacoes/page.tsx`

- `btn-exportar-xlsx`
- `btn-exportar-pdf`
- `aviso-limite-500`

### `src/app/cadastro-rapido/page.tsx`

- `pagina-cadastro-rapido`
- `input-nome-eleitor`
- `input-telefone-eleitor`
- `input-cidade-eleitor`
- `input-bairro-eleitor`
- `btn-salvar-eleitor`
- `feedback-salvo-eleitor`

### `src/app/sala-situacao/page.tsx`

- `pagina-sala-situacao`
- `kpi-irt`
- `card-territorio-risco`
- `btn-determinar-territorio`
- `modal-determinacao-sala`
- `btn-enviar-determinacao-sala`

## Usuarios RC Propostos

Documentacao apenas. Nao criar agora.

- `deputado.rc@teste.com`
- `ae.rc@teste.com`
- `assessor.rc@teste.com`
- `coordenador.rc@teste.com`
- `colaborador.rc@teste.com`
