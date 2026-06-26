# Operação do Gabinete — Rotinas por Perfil

Guia de uso diário da plataforma ELEITORES2026 para cada perfil operacional.

---

## Deputado / Político

**Acesso:** `/dashboard` → `/sala-situacao` → `/relatorios` → `/notificacoes`

### Rotina diária (manhã)
1. Abrir `/sala-situacao` — verificar IRT (Índice de Risco Territorial) e cidades em alerta
2. Verificar notificações — prestações de contas do AE, alertas de missão
3. Se houver cidade em risco → clicar "Determinar Providência" → enviar determinação ao AE
4. Revisar `/dashboard` — pendências, agenda executiva, memória do mandato

### Rotina semanal
1. Acessar `/relatorios` → análise estratégica por cidade e grau de apoio
2. Verificar crescimento territorial na Sala de Situação
3. Revisar determinações em andamento → cobrar prestação de contas

### Pontos de atenção
- A Sala de Situação é o painel de comando principal — abrir antes do Dashboard
- Determinações sem prazo ficam visíveis indefinidamente — definir sempre um prazo
- Badge de notificações indica prestações de contas pendentes de revisão

---

## Assessor Executivo (AE)

**Acesso:** `/dashboard` (painel executivo) → `/missoes` → `/notificacoes`

### Rotina diária (manhã)
1. Verificar `/notificacoes` — novas determinações do Deputado
2. Abrir `/dashboard` — ver determinações recebidas com status "Pendente"
3. Para cada determinação pendente: clicar "Aceitar" → status muda para "Em andamento"
4. Verificar missões em andamento → distribuir para assessores regionais

### Rotina de prestação de contas
1. Quando missão estiver concluída: clicar "Prestar Contas" na determinação
2. Preencher resultado objetivo (o que foi feito, números alcançados)
3. Enviar — Deputado recebe notificação automaticamente

### Pontos de atenção
- Aceitar determinação imediatamente sinaliza ao Deputado que a mensagem foi recebida
- Prestação de contas sem resultado descritivo gera dúvida — sempre detalhar
- Missões com prazo vencido aparecem em vermelho na Sala de Situação do Deputado

---

## Assessor Regional

**Acesso:** `/dashboard` → `/eleitores` → `/colaboradores` → `/relatorios`

### Rotina diária
1. Verificar `/dashboard` — crescimento de eleitores na sua região
2. Checar `/colaboradores` — produtividade da equipe, últimos cadastros
3. Acompanhar metas em `/metas` — ritmo de cadastro vs meta semanal

### Rotina semanal
1. `/relatorios` → filtrar por cidade e bairro da sua região
2. Verificar distribuição por grau de apoio (forte / médio / fraco / indeciso)
3. Identificar bairros com cadastro fraco → orientar coordenadores

### Pontos de atenção
- Eleitores sem grau de apoio definido comprometem os relatórios — cobrar preenchimento
- Ranking de colaboradores em `/colaboradores` é atualizado em tempo real
- Exportar base periodicamente como backup local (Excel Executivo Premium)

---

## Coordenador

**Acesso:** `/dashboard` → `/colaboradores` → `/eleitores` → `/metas`

### Rotina diária
1. Verificar `/dashboard` — total de eleitores cadastrados pelo seu bairro/região
2. Checar `/colaboradores` — quem cadastrou nos últimos dias
3. Acompanhar colaboradores inativos (sem cadastro nos últimos 7 dias)

### Rotina de acompanhamento
1. `/metas` → verificar percentual atingido da meta semanal
2. Contatar colaboradores com baixa produção fora da plataforma (WhatsApp/ligação)
3. `/eleitores` → filtrar por bairro e verificar qualidade dos cadastros

### Pontos de atenção
- Colaboradores veem apenas seus próprios eleitores — coordenador vê todos do seu bairro
- Qualidade importa mais que quantidade — eleitor sem telefone ou bairro dificulta ativação
- Metas são individuais por colaborador — acompanhar cada um separadamente

---

## Colaborador / Mobilizador

**Acesso:** `/cadastro-rapido` (mobile) → `/eleitores` (consulta)

### Rotina de campo
1. Abrir `/cadastro-rapido` no celular (funciona como PWA instalado)
2. Preencher: nome completo, telefone, cidade, bairro, grau de apoio
3. Salvar — eleitor aparece imediatamente na lista do coordenador
4. Repetir para cada contato abordado

### Boas práticas de cadastro
- Sempre preencher telefone — essencial para ativação futura
- Grau de apoio: "forte" = confirma voto, "médio" = favorável, "fraco" = resistente, "indeciso" = não definido
- Bairro exato (não só cidade) — coordenador filtra por bairro
- Nunca cadastrar a mesma pessoa duas vezes — verificar antes pelo nome

### Pontos de atenção
- O app pode ser instalado na tela inicial do celular (PWA) — funciona offline para visualização, mas cadastro requer conexão
- Em campo sem sinal: anotar no papel e cadastrar quando voltar à conexão
- Dúvidas sobre grau de apoio: usar "indeciso" em vez de deixar em branco

---

## Fluxo Completo de uma Semana Típica

```
Segunda (manhã)
  Deputado → Sala de Situação → identifica risco em cidade X → Determina providência ao AE

Segunda (tarde)
  AE → Aceita determinação → Distribui missão para Assessor Regional X

Terça-Quarta
  Colaboradores → campo → cadastram eleitores via /cadastro-rapido
  Coordenadores → acompanham produtividade em tempo real

Quinta
  AE → Presta contas ao Deputado com resultado da ação em cidade X

Sexta
  Deputado → Revisa relatórios → Avalia crescimento semanal → Fecha ciclo
```
