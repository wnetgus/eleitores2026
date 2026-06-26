# PC1 — Operação do Piloto Controlado

## Objetivo

Validar a plataforma ELEITORES2026 em uso real antes de escalar para múltiplos gabinetes.

O PC1 não é fase de desenvolvimento. É fase de observação, aprendizado e correção cirúrgica.

**Critério de encerramento do PC1:** plataforma operada por usuários reais durante 30 dias sem P0 ou P1 recorrente.

---

## Papéis

| Papel | Responsável | Função |
|---|---|---|
| **CTO** | Weyne | Observa o uso real, abre registros PC1, decide o que implementar |
| **Engineering Manager** | Claude | Analisa registros, prioriza, define solução, orienta execução |
| **QA Executor** | Codex | Executa testes automatizados, valida correções, reporta resultados |
| **Usuário Piloto** | Equipe real | Opera a plataforma no dia a dia do gabinete |

---

## Fluxo Operacional: CTO → Claude → Codex

```
1. CTO observa atrito, bug ou dúvida em uso real
         ↓
2. CTO abre registro PC1-NNN no docs/PC1_LOG.md
   com: perfil, contexto, o que aconteceu, impacto
         ↓
3. Claude analisa o registro
   → Classifica: P0 / P1 / P2 / P3
   → Define se vira correção ou aguarda confirmação
   → Se correção: descreve a solução
         ↓
4. Claude implementa (bugs simples) ou
   Codex executa (testes + correções complexas)
         ↓
5. Entrega: commit + build + TS + arquivos + risco de regressão
         ↓
6. CTO valida em produção
   → PASS: fecha registro no PC1_LOG.md
   → FAIL: volta para Claude com evidência
```

---

## Como Abrir um Registro PC1

Adicionar em `docs/PC1_LOG.md` com o próximo número sequencial:

```markdown
## PC1-NNN — Título curto

**Data:** YYYY-MM-DD
**Observado por:** [CTO / usuário piloto / Codex]
**Perfil:** [Deputado / AE / Assessor / Coordenador / Colaborador]
**Status:** Observação | Análise | Em correção | Resolvido | Descartado

**Contexto:** O que o usuário estava fazendo.
**O que aconteceu:** Descrição objetiva do problema ou atrito.
**Impacto:** Bloqueante / Degradante / Cosmético / Dúvida
**Decisão:** [aguardando confirmação / vira correção / descartado]
```

---

## Critérios de Prioridade

| Nível | Definição | Prazo |
|---|---|---|
| **P0** | Plataforma inoperável — login quebrado, dados perdidos, crash total | Imediato (< 2h) |
| **P1** | Fluxo crítico bloqueado — determinação, prestação de contas, cadastro de eleitor | Mesmo dia |
| **P2** | Funcionalidade degradada mas com contorno — feedback fraco, loading lento, filtro errado | Próxima janela |
| **P3** | Cosmético, UX menor, texto confuso — não bloqueia operação | Acumula para lote |

---

## Critérios para Virar Implementação

Uma observação **vira correção** quando:
- É P0 ou P1 (automático)
- É confirmada por 2+ usuários ou sessões diferentes
- Tem reprodução clara (contexto + passos + resultado)
- O impacto na operação é mensurável

Uma observação **não vira implementação** quando:
- É hipótese sem evidência real
- É preferência estética sem impacto funcional
- Contradiz outra evidência do piloto
- Resolveria apenas 1 caso isolado

---

## O que NÃO fazer durante o PC1

- Não abrir Sprint por iniciativa própria
- Não refatorar código sem evidência
- Não adicionar feature por antecipação
- Não alterar arquitetura por preferência
