# Mesa do Bem — Documentação do projeto

## Visão geral
Sistema de gestão de cozinha comunitária para distribuição de quentinhas.
Deploy em Docker Swarm via Portainer em `cozinha.simplisoft.com.br`.
Docker Hub: `vydhal/mesa-do-bem-{frontend|backend|face-service}`.

## Stack
- **Frontend**: React 19 + TanStack Router + TanStack Query + shadcn/ui + Tailwind 4
- **Backend**: Fastify + Prisma + PostgreSQL 16
- **Face service**: Python/OpenCV (serviço separado)
- **Infra**: Docker Swarm, Traefik, Portainer

## Deploy
```powershell
.\build.ps1          # menu interativo
# [1] Frontend apenas
# [2] Backend apenas
# [4] Frontend + Backend
# [5] Tudo
```
Após publicar, atualizar a stack no Portainer com o `stack.yml` atualizado.

## Schema do banco
O projeto usa `prisma db push` (não migrate). O serviço `migrate` no stack.yml
executa `npx prisma db push && npx tsx prisma/seed.ts` na inicialização.

Para aplicar schema manualmente em produção, no container do backend:
```sh
npx prisma db push --accept-data-loss
```

## Variáveis de ambiente (produção)
Definidas como secrets no Portainer:
- `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `ADMIN_PASSWORD`, `NOME_COZINHA`, `LIMITE_DIARIO`
- `SEED_DEMO_DATA` (default: false)
- `INTEGRATION_API_KEY` — chave secreta para o endpoint de integração máquina-a-máquina
- `PUBLIC_URL` — fixo no stack.yml como `https://cozinha.simplisoft.com.br`

---

## Histórico de implementações

### Sessão 1 — Funcionalidades base
- Sistema completo de beneficiários (CRUD, foto, biometria facial)
- Fila virtual com painel público (WebSocket)
- Sistema de retiradas com validação facial
- Relatórios com gráficos (Recharts)
- Gestão de equipe, configurações, superadmin

### Sessão 2 — Melhorias

#### Relatórios (`frontend/src/routes/_app.relatorios.tsx`)
- Coluna **Data** adicionada na tabela "Histórico de retiradas"
- Filtro **Personalizado** com campos "De" e "Até" (além de Hoje/Semana/Mês/Ano)
- CSV e PDF exportados com a coluna Data incluída
- Backend aceita `de` e `ate` como query params em `GET /relatorios`

#### Beneficiário — Família vinculada (`_app.beneficiarios.$id.tsx`)
- Campo `podeRetirar Boolean @default(true)` adicionado ao schema Prisma
- Seção "Membros da família vinculados": busca beneficiários cadastrados, vincula ao mesmo `familiaId`, toggle "Pode retirar" por membro
- Novos endpoints: `GET/POST /beneficiarios/:id/familia-membros`, `DELETE /beneficiarios/:id/familia-membros/:membroId`
- Modo visualização mostra membros com badge "Pode retirar" / "Não retira"

#### CEP auto-fill
- Ao sair do campo CEP (onBlur), consulta ViaCEP (`viacep.com.br`) e preenche Logradouro, Bairro, Cidade e UF
- Implementado em: `novo.tsx`, `$id.tsx`, `cadastro.tsx`

#### CPF com máscara automática
- Função `maskCpf` em `frontend/src/lib/utils.ts`
- Aplicada nos campos CPF de `novo.tsx`, `$id.tsx` e `cadastro.tsx`
- Digitar apenas números aplica a máscara `000.000.000-00` progressivamente

#### Fichas (ex-Fila Virtual) (`_app.fila.tsx`)
- Página de fila transformada em sistema de **geração de fichas numeradas**
- Numeração: `001`, `002`... com zeros à esquerda (padStart 3)
- Validação do limite diário antes de emitir (erro se atingido)
- Busca de beneficiário por nome/CPF + seleção + "Gerar e imprimir"
- Impressão otimizada para bobina térmica 80mm com QR code (api.qrserver.com)
- Cards mostram: Emitidas/Limite, Restantes hoje, Chamados, Concluídas
- Banner de alerta quando limite diário é atingido
- Botão de reimpressão por ficha na lista

#### Auto-cadastro público
- Schema: `cadastroPublicoAtivo Boolean @default(false)` e `cadastroPublicoToken String?` em `Configuracao`
- Superadmin gera/ativa link em `/admin` → card "Link de auto-cadastro"
- Rota pública `/cadastro?token=xxx` (sem autenticação): formulário completo exceto biometria
- Submissões chegam como status **Pendente** para aprovação
- Endpoints: `GET/POST /configuracoes/cadastro-publico/status`, `GET/PUT /configuracoes/cadastro-publico`

#### Biometria salva como foto de perfil
- Ao registrar biometria, o frame capturado é salvo automaticamente como `fotoUrl` do beneficiário
- Função `saveBase64Image` adicionada em `shared/utils/upload.ts`
- Avatar exibido na tela de retirada (lista e card de confirmação)

#### Busca na retirada (accent-insensitive)
- `GET /retiradas/buscar` usa `unaccent()` do PostgreSQL para busca sem sensibilidade a acentos
- Ex: "Tomas", "Tómas" e "Tomás" todos encontram o mesmo cadastro
- Fallback para `ILIKE` se extensão não disponível
- Removido filtro `status: 'ATIVO'` — exibe todos os status na busca

#### Documentos do beneficiário
- Schema: enum `DocStatus` (PENDENTE/APROVADO/REJEITADO) + campos `status`, `aprovadoPorId`, `aprovadoEm`, `rejeitadoMotivo` na tabela `documentos`
- Tipos de documento: `RG_FRENTE`, `RG_VERSO`, `COMPROVANTE`, `OUTRO`
- Card "Documentos" na sidebar do perfil (modo edição e visualização)
- Upload por slot (identidade frente, identidade verso, comprovante de residência)
- Preview via Dialog com suporte a imagem e PDF
- Aprovação/rejeição (Admin/Superadmin) com motivo inline
- No formulário Novo: seleção antecipada dos arquivos, enviados automaticamente após o cadastro salvar
- Novos endpoints: `GET/POST /beneficiarios/:id/documentos`, `PATCH /beneficiarios/documentos/:id/avaliar`, `DELETE /beneficiarios/documentos/:id`

### Sessão 4 — Exportação PDF de beneficiários + filtro de biometria

#### Exportação em PDF na lista de beneficiários (`_app.beneficiarios.index.tsx`)
- Botão **PDF** ao lado do **CSV** (botão antigo "Exportar" virou "CSV")
- Reaproveita o mesmo padrão visual de Relatórios: cabeçalho com logo (`useSettings()`), rodapé institucional (`/rodape.png`), impressão automática via `window.print()` — sem dependência de lib de PDF
- Respeita os filtros ativos (busca, status, biometria) e mostra resumo (Total, Ativos, Pendentes, Bloqueados, Com biometria, Sem biometria)
- Não gera código de autenticação (`REL-*`) — é só uma listagem, diferente do relatório de retiradas

#### Ficha individual em PDF (`_app.beneficiarios.$id.tsx`)
- Botão **PDF** na barra de ações do perfil (entre "Excluir" e "Editar"), visível apenas no modo visualização
- Documento inclui: foto do beneficiário em círculo (placeholder se sem foto), badges de status e biometria com cores indicativas, dados pessoais, endereço, família/autorização, perfil social, situação socioeconômica, observações e histórico de retiradas (últimas 15)
- Biometria "Pendente" ou "Indisponível" aparece em âmbar/cinza no badge — deixa claro o cadastro incompleto
- Mesmo padrão de cabeçalho (logo + `nomeCozinha`) e rodapé (`/rodape.png`) dos demais PDFs do sistema
- Não requer chamada extra ao backend — usa os dados já carregados pela query `getById`

#### Filtro por status de biometria (cadastros incompletos)
- Motivação: o dashboard mostra "Cadastros incompletos" (sem biometria) mas não havia como ver quem são
- Backend: `listBeneficiariosSchema` e `BeneficiariosRepository.findMany` aceitam `biometriaStatus` (`VERIFICADA`/`PENDENTE`/`INDISPONIVEL`) em `GET /beneficiarios`
- Frontend: novo Select "Biometria" na lista de beneficiários + badge de biometria em cada card
- Cards do dashboard "Cadastros completos"/"Cadastros incompletos" (`_app.index.tsx`) agora são links para `/beneficiarios?biometria=verificada` / `?biometria=pendente`, já filtrado
- Rota `/beneficiarios` ganhou `validateSearch` com `biometria?: string` opcional (TanStack Router) para suportar o deep-link

#### Correção: campos faltando no select de beneficiários
- `BeneficiariosRepository.findMany` não retornava `nascimento`, `endereco`, `numero`, `cidade`, `cep` — por isso essas colunas já saíam vazias na exportação CSV antiga. Campos adicionados ao `select`.

#### Registro retroativo de retiradas (`_app.retirada.tsx`)
- Seletor de data no topo da tela de retirada: abre ao hoje por padrão, exibindo dia por extenso
- Ao selecionar data passada, abre AlertDialog pedindo confirmação explícita ("Registro retroativo")
- Banner de alerta laranja (warning) enquanto data retroativa está ativa; verde (primary) quando é hoje
- Enquanto data retroativa está ativa, o texto do botão muda: "Registrar em DD/MM/AAAA"
- Botão "Voltar para hoje" no Calendário quando data retroativa está selecionada
- Backend: `validarBeneficiario(id, data?)` e `confirmar(input)` aceitam `data` opcional (`YYYY-MM-DD`); checagens de duplicata e limite diário são feitas para a data informada, não para `today`
- API client: `validar(id, data?)` e `confirmar(id, unidadeId?, metodo?, data?)` repassam a data
- Calendário usa `react-day-picker` (shadcn/ui Calendar) com locale `pt-BR` (date-fns) e desabilita datas futuras

### Sessão 3 — PDF autenticado + Integração entre sistemas

#### Relatório PDF autenticado
- PDF com cabeçalho (logo da cozinha via `useSettings()`) e rodapé (`frontend/public/rodape.png` — ARCCiD, Sana Sorte, Lotep)
- Coluna **Método** na tabela (Facial / Manual) + ID curto (8 chars UUID) para retiradas faciais
- Botão PDF gera código `REL-YYYYMMDD-XXXXX` gravado em `documentos_relatorios` antes de abrir janela
- URL de validação impressa no documento: `/validar?codigo=REL-...`
- Schema: enum `MetodoRetirada` (FACIAL/MANUAL) em `Retirada`; modelo `DocumentoRelatorio`
- `POST /api/relatorios/documento` (Admin+) — cria e retorna código
- `GET /api/validar/:codigo` (público) — código `REL-*` retorna info do documento; UUID retorna info da retirada individual
- Frontend: rota pública `/validar` (`frontend/src/routes/validar.tsx`)
- Backend: plugin sem auth `backend/src/modules/relatorios/validar.routes.ts`

#### Integração entre sistemas (rede de atendimento social)
- Endpoint público-protegido por API key: `GET /api/integracao/pessoa/:cpf`
- Auth: header `X-Integration-Key` validado contra env `INTEGRATION_API_KEY`
- Retorna: `{ sistema, sistemaLabel, pessoaEncontrada, pessoa, resumo, eventos[] }`
- Arquivo: `backend/src/modules/integracao/integracao.routes.ts`
- **Testado e funcionando em produção** (2026-06-10)
- `INTEGRACAO_PROMPT.md` na raiz — prompt para implementar o mesmo contrato em outros sistemas
- `TWENTY_AGENT_PROMPT.md` na raiz — prompt para configurar TwentyCRM como hub de integração
- Próximo passo: implementar o contrato no sistema de saúde, depois configurar TwentyCRM

---

## Arquivos-chave

### Frontend (`frontend/src/`)
| Arquivo | Descrição |
|---|---|
| `routes/_app.fila.tsx` | Geração e gestão de fichas |
| `routes/_app.retirada.tsx` | Retirada de quentinhas |
| `routes/_app.relatorios.tsx` | Relatórios e exportação |
| `routes/_app.beneficiarios.$id.tsx` | Perfil + edição + família vinculada |
| `routes/_app.beneficiarios.novo.tsx` | Cadastro de novo beneficiário |
| `routes/_app.admin.tsx` | Superadmin: bairros, link de cadastro, unidades |
| `routes/cadastro.tsx` | Auto-cadastro público (sem auth) |
| `routes/painel.tsx` | Painel público de senhas (TV) |
| `lib/api/beneficiarios.api.ts` | API: beneficiários + família |
| `lib/api/fila.api.ts` | API: fichas/fila |
| `lib/api/relatorios.api.ts` | API: relatórios |
| `lib/api/configuracoes.api.ts` | API: configurações + cadastro público |
| `lib/utils.ts` | `cn()`, `maskCpf()` |

### Backend (`backend/src/modules/`)
| Módulo | Descrição |
|---|---|
| `beneficiarios/` | CRUD, família, biometria, importação CSV |
| `fila/` | Fichas/fila, painel público, WebSocket |
| `retiradas/` | Busca, validação, confirmação, reconhecimento facial |
| `relatorios/` | Dashboard, evolução, bairros, relatório geral, documento autenticado |
| `relatorios/validar.routes.ts` | Rota pública de validação (sem auth JWT) |
| `integracao/` | Endpoint máquina-a-máquina por API key |
| `configuracoes/` | Config, bairros, logo, cadastro público |
| `equipe/` | Usuários e permissões |
| `admin/` | Stats globais, unidades |

### Prisma (`backend/prisma/schema.prisma`)
Modelos principais:
- `Beneficiario`: `podeRetirar Boolean @default(true)`
- `Configuracao`: `cadastroPublicoAtivo Boolean`, `cadastroPublicoToken String?`
- `FilaEntrada`: fichas do dia com senha zero-padded
- `Familia`: agrupa beneficiários por endereço
- `Retirada`: `metodoRetirada MetodoRetirada @default(MANUAL)`
- `DocumentoRelatorio`: código `REL-YYYYMMDD-XXXXX`, período, totais, geradoPorId

---

## Impressora térmica
O sistema usa `window.print()` com HTML otimizado para bobina 80mm.
Configurar no Windows: definir a impressora como padrão, papel 80mm, sem margens,
sem cabeçalhos/rodapés. Não requer driver especial no sistema.

## Extensão PostgreSQL
A busca de beneficiários usa `unaccent` para ser insensível a acentos.
A extensão é criada automaticamente na primeira busca via `CREATE EXTENSION IF NOT EXISTS unaccent`.
