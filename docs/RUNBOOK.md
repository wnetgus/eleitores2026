# RUNBOOK — Procedimentos Operacionais ELEITORES2026

## Referências rápidas

| Recurso | URL / Comando |
|---|---|
| Produção | https://eleitores2026.vercel.app |
| GitHub | https://github.com/wnetgus/eleitores2026 |
| Vercel Dashboard | https://vercel.com/wnetgus-3028s-projects/eleitores2026 |
| Firebase Console | https://console.firebase.google.com (projeto: eleitores2026) |
| Main commit | `67f8dd2` |

---

## Deploy

### Deploy automático (padrão)
Todo push para `main` dispara deploy automático na Vercel. Nenhuma ação manual necessária.

```bash
git push origin main   # deploy automático para produção
```

### Verificar status do deploy
```bash
npx vercel ls          # lista deployments recentes
```

### Verificar build localmente antes de push
```bash
npm run build          # deve completar sem erro
npx tsc --noEmit       # deve completar sem erro
```

### Rollback de emergência
No Vercel Dashboard → Deployments → selecionar deploy anterior → "Promote to Production".

---

## Firebase / Blaze

### Plano atual
Firebase Blaze (pay-as-you-go) — ativo.

### Verificar uso e custos
Firebase Console → Usage and billing → ver leituras/escritas Firestore e usuários Auth.

### Regras Firestore
Arquivo: `firestore.rules` na raiz do projeto.

Para publicar regras após alteração:
```bash
npx firebase-tools deploy --only firestore:rules
```

### Índices Firestore
Arquivo: `firestore.indexes.json` na raiz do projeto.

Para publicar índices:
```bash
npx firebase-tools deploy --only firestore:indexes
```

### Backup manual de dados
Não existe backup automático configurado. Para exportar dados:
Firebase Console → Firestore → Import/Export → Export.

---

## Vercel

### Variáveis de ambiente (produção)
Configuradas no Vercel Dashboard → Settings → Environment Variables:
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `NEXT_PUBLIC_FIREBASE_*` (configuração cliente)

**Nunca commitar variáveis de ambiente no repositório.**

### Preview vs Production
- `main` → Production (https://eleitores2026.vercel.app)
- Outros branches → Preview (URL única por deploy, pode exigir autenticação Vercel)

### Share de Preview para Codex
Usar a URL de produção (`eleitores2026.vercel.app`) para testes do Codex — previews podem exigir autenticação Vercel.

---

## PWA

### Verificar service worker
Chrome DevTools → Application → Service Workers → confirmar:
- Status: `activated`
- Controller: `true`

### Limpar cache do service worker (usuário)
Chrome DevTools → Application → Service Workers → Unregister → recarregar página.

### Arquivo do service worker
`public/sw.js` — gerado automaticamente pelo Next.js PWA config.

---

## Exportações

### Excel Executivo Premium
Gerado client-side com `xlsx`. Não depende do servidor.
4 abas: Resumo Geral, Municípios, Assessorias, Eleitores.

### Exportação Base (server-side)
Rota: `POST /api/exportar-excel`
Requer: `FIREBASE_ADMIN_*` nas variáveis de ambiente.
Timeout configurado: 12s.
Limite rate: 3 exportações por IP por janela.

### Se exportação retornar 503
Causa: `FIREBASE_ADMIN_*` não configurado no ambiente.
Solução: verificar variáveis no Vercel Dashboard.

### Se exportação retornar 429
Causa: rate limit atingido.
Solução: aguardar ~1 minuto.

---

## Firestore — Problemas Comuns

### Warning `WebChannelConnection RPC 'Listen' transport errored`
Causa: intermitente, reset de conexão WebSocket do SDK Firestore.
Impacto: nenhum — a conexão se reconecta automaticamente.
Ação: nenhuma necessária.

### Listener real-time parou de atualizar
1. Recarregar a página — listeners são recriados.
2. Verificar Firebase Console → Firestore → aba "Usage" para confirmar que o banco está respondendo.

### Quota RESOURCE_EXHAUSTED (cota Firestore)
Retorna 503 na exportação.
Causa: muitas leituras em curto período (plano Blaze tem limites por segundo).
Ação: aguardar alguns segundos e tentar novamente.

---

## Logs e Monitoramento

### Logs de produção
Vercel Dashboard → Deployments → selecionar deploy → Functions → ver logs das rotas de API.

### Logs de auditoria internos
Página `/logs` (acesso restrito a super_admin e admin_master).

### Erros de autenticação
Firebase Console → Authentication → Users → verificar status do usuário.

---

## Procedimento P0 (plataforma inoperável)

1. Identificar se é deploy, Firebase ou código.
2. Se deploy: rollback imediato no Vercel Dashboard.
3. Se Firebase: verificar console, verificar regras Firestore.
4. Se código: abrir registro PC1 com P0, corrigir, testar localmente, push.
5. Confirmar resolução em produção.
6. Fechar registro PC1.

---

## Limpeza do cenário fake (pré-produção real)

```bash
npm run clean:fake     # remove dados do cenário v3/v4 (usa manifesto _seed_manifest)
npm run clean:auth     # remove contas de teste do Firebase Auth
```

**Nunca executar em produção com usuários reais ativos.**
**`wnetgus@gmail.com` é preservado em todos os resets.**
