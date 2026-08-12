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
- `FACE_MATCH_THRESHOLD` (backend + face-service, default `0.5`) — distância máxima para
  aceitar um match facial. Menor = mais rígido, menos falso positivo. Ver Sessão 7.
- `FACE_MATCH_MARGIN` (face-service, default `0.06`) — separação mínima entre o melhor e o
  2º melhor match; abaixo disso o reconhecimento é rejeitado como ambíguo (anti-sósia).
- `FACE_QUERY_JITTERS` / `FACE_REGISTER_JITTERS` (face-service, default `3` / `5`) — amostras
  de encoding na consulta e no cadastro.

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
- **Fix timezone**: `toIsoDate()` usa `getFullYear/getMonth/getDate` (local) em vez de `toISOString()` (UTC) para evitar virar dia anterior em Brasil (UTC-3)
- **Fix `horario` retroativo**: `confirmar()` no backend agora seta `horario` explicitamente como data retroativa + hora atual quando `input.data` é fornecido; sem o fix, `horario` ficava com `now()` (data de hoje) mesmo para registros de datas passadas

### Sessão 5 — Exclusão de retiradas (Superadmin) + correções de exibição

#### Exclusão de retiradas no relatório (`_app.relatorios.tsx`)
- Motivação: registros retroativos com data errada precisavam ser apagados pelo operador responsável
- Backend: `DELETE /retiradas/:id` com guard `requireSuperAdmin()` + audit log `DELETAR_RETIRADA`
- Service: `RetiradasService.deletarRetirada(id)` — hard delete (sem soft-delete no modelo Retirada)
- Frontend API: `relatoriosApi.deletarRetirada(id)` via `api.delete`
- UI: coluna extra com botão 🗑 visível **apenas para SUPERADMIN** (`user?.role === "SUPERADMIN"`)
- AlertDialog de confirmação com aviso de ação permanente antes de executar
- Após exclusão: `queryClient.invalidateQueries(["relatorio"])` recarrega a tabela automaticamente

#### Correção: coluna DATA no relatório usava `horario` em vez de `data`
- Problema: a coluna DATA na tabela, CSV e PDF lia `r.horario` (DateTime de quando foi digitado) em vez de `r.data` (Date correto do registro)
- Para registros retroativos lançados antes do fix do `horario`, `data=2026-06-01` mas `horario=2026-07-02T13:XX` → coluna mostrava julho
- Fix: funções `fmtData(data)` e `fmtHora(horario)` separadas; DATA usa `r.data` com `{ timeZone: "UTC" }` para evitar virar dia anterior em Brasil (UTC-3), HORÁRIO continua usando `r.horario`
- Fix aplicado em: tabela da tela, exportação CSV e geração de PDF
- O filtro do backend já usava `data: dateRange` corretamente — apenas a exibição estava errada

### Sessão 6 — Compatibilidade com tablets + escolha de câmera

#### Problema: aplicação abria totalmente sem estilo em tablet Android
- Sintoma: em tablet com Chrome antigo a página renderizava como HTML puro (fonte serifada,
  inputs nativos, logo em tamanho natural). Desktop e celular OK.
- **Não era layout/responsividade** — o React carregava e buscava dados normalmente
  (o logo vinha da API); apenas o CSS inteiro era descartado.
- Causa raiz: o Tailwind v4 mira Chrome 111+ / Safari 16.4+ e envolve **toda** a folha
  em `@layer theme/base/components/utilities`. Navegador sem suporte a cascade layers
  (Chrome < 99, Safari < 15.4) ignora o at-rule e descarta tudo que está dentro.

#### Solução: pipeline de downlevel do CSS
- Tailwind passou a rodar via **PostCSS** (`postcss.config.mjs`) em vez do plugin
  `@tailwindcss/vite` — necessário para pós-processar o CSS já gerado.
  `@tailwindcss/vite` foi desinstalado; `vite.config.ts` não tem mais o plugin.
- `postcss-legacy-compat.mjs` (plugin local) faz três coisas:
  1. **Achata as cascade layers** — o fix crítico. Seguro aqui porque o Tailwind emite as
     layers na mesma ordem em que as declara e as utilities são classes únicas no fim.
  2. Remove `in oklab` de `--tw-gradient-position` (senão o gradiente do `/painel` some
     e sobra texto branco em fundo transparente).
  3. Adiciona fallback em `vh` antes de `svh`/`dvh`/`lvh` (`h-dvh` do AppShell,
     `min-h-svh` do login) — unidades só existem a partir do Chrome 108.
- `postcss-preset-env` com `stage: false` e apenas `oklab-function: { preserve: false }`:
  converte `oklch()` → `rgb()`. Necessário porque as cores do tema vivem em custom
  properties (`--primary: oklch(...)`), onde fallback por dupla declaração **não** funciona.
- Alvo de navegadores no campo `browserslist` do `package.json` (Chrome/Android ≥ 87).

#### Armadilhas encontradas (não repetir)
- `@csstools/postcss-cascade-layers` (feature `cascade-layers` do preset-env) **trava o
  build** (>10 min sem terminar) no volume de CSS deste projeto — por isso o plugin local.
- A feature `gradient-interpolation-method` do preset-env **também trava o build**.
- `postcss-selector-parser` precisa ser instalado explicitamente (peer dep faltante).
- Não é preciso mexer em `color-mix()`: o Tailwind v4.2 já emite fallback em `@supports`
  para todo modificador de opacidade (`bg-primary/10`). Verificado: 0 ocorrências
  desprotegidas no CSS final.
- Media queries já saem como `(min-width: 40rem)`, não em range syntax — sem problema.

#### Como validar após mudanças no CSS
No `dist/client/assets/*.css` gerado, o esperado é `@layer` = 0 e `oklch` = 0.

#### Seleção de câmera no reconhecimento facial (`_app.reconhecimento.tsx`)
- Motivação: celulares e tablets têm câmera frontal e traseira, e o código fixava
  `facingMode: "user"` — o operador não conseguia usar a traseira.
- Select aparece **apenas quando há mais de uma câmera** (`cameras.length > 1`),
  então em desktop com uma webcam a tela fica inalterada.
- A escolha é persistida em `localStorage` na chave `mdb-camera-id`.
- `startCamera(preferredId?)` chama `stopStream()` antes de abrir a nova: vários
  Androids recusam abrir a segunda câmera com a primeira ainda ativa.
- Se o `deviceId` salvo não existir mais (troca de aparelho, ids rotacionados),
  o `getUserMedia` falha → limpa a preferência e reabre com `facingMode: "user"`.
- `enumerateDevices()` roda **depois** do `getUserMedia`: antes da permissão os
  rótulos vêm vazios. Sem rótulo, exibe "Câmera 1/2".
- Dispositivos com `deviceId` vazio são filtrados (Radix Select quebra com value "").

#### Ainda usam `facingMode: "user"` fixo (sem seletor)
Captura de biometria em `_app.beneficiarios.$id.tsx` (linhas ~701 e ~1253).
Se for necessário, vale extrair um hook compartilhado a partir do reconhecimento.

#### Fix: preview de câmera desalinhado no tablet (`_app.beneficiarios.$id.tsx`)
- Sintoma: nos dialogs "Foto do beneficiário" (`FotoCaptura`) e "Captura facial"
  (`BiometriaCard`), o vídeo aparecia pequeno e fora do centro no tablet.
- Causa: o container do vídeo (`aspect-square`) não tinha `w-full`. Dentro do
  `DialogContent` (que é `grid`), sem largura explícita o box encolhia para o
  tamanho do conteúdo em vez de ocupar a largura toda. A tela de reconhecimento,
  que já funcionava, tinha `w-full` — era a diferença.
- Fix nos dois dialogs: `mx-auto aspect-square w-full max-w-[20rem]` no box do vídeo
  + `max-h-[90vh] overflow-y-auto` no `DialogContent` (rola se passar da tela).

#### Cor primária é injetada em runtime
`_app.tsx` sobrescreve `--primary`/`--ring`/`--sidebar-primary`/`--chart-1` via
`style.setProperty()` a partir de `corPrimaria` das configurações. Ou seja, a cor
que aparece na tela **não** é a do `styles.css` — não confunda com regressão de tema.

### Sessão 7 — Vínculo de família opcional + retirada por procuração + acurácia facial

#### Vínculo de família deixou de ser automático (opt-in manual)
- Motivação: o auto-vínculo por endereço somava as quentinhas de todos os membros numa
  entrega só e bloqueava o resto da família no dia → divergência nos relatórios
  (1 entrega = N quentinhas; headcount ≠ quentinhas).
- `Familia` **não é mais única por endereço** — removida a constraint
  `@@unique([endereco,numero,bairro,cep])`. Família virou um **grupo explícito**, não a
  identidade do endereço.
- `create`/`update`/`importCsv`/auto-cadastro público: cada pessoa nasce **independente**
  (`familiaId` nulo). A retirada já trata nulo como indivíduo (cota própria, sem bloqueio).
- `vincularMembro`: cria a família **sob demanda** no 1º vínculo. `desvincularMembro`: volta
  `familiaId = null` (antes recriava pelo endereço e devolvia a MESMA família → não dava para
  separar quem morava junto).
- Escopo aplicado: **só daqui pra frente** — dados existentes não foram alterados em massa; o
  operador separa casos antigos pelo desvincular (que agora funciona).
- Repo: `findOrCreateFamilia` (upsert por endereço) virou `createFamilia` (create simples).

#### Retirada por procuração (substitui o "soma família + bloqueia família")
- Cada pessoa retira **a sua** quentinha (1). O vínculo serve para A retirar a quentinha de
  um vinculado **ausente** (a facial não lê quem não está lá).
- Fluxo: A retira → o sistema oferece retirar também a quentinha dos vinculados **com o toggle
  "Pode retirar" ligado** que ainda não retiraram hoje → operador seleciona (checkboxes) →
  cada selecionado vira **uma linha própria** (1 quentinha), com `retiradoPorNome = A`.
- O toggle `podeRetirar` **agora é enforçado** (gate da elegibilidade da procuração) — antes
  era cosmético.
- Backend: `Retirada.retiradoPorNome String?` (denormalizado); `validarBeneficiario` retorna
  `validacoes.vinculados[]` (elegíveis, com `jaRetirou`), `quantidade` individual e
  `podeRetirar = !jaRetirou` (sumiram `familiaJaRetirou`/`quantidadeFamilia`/`membrosFamilia`);
  `confirmar` aceita `retiradoPorNome`, cota individual, só trava duplicata **por pessoa**.
- Frontend: dialog de procuração (checkboxes) em `_app.retirada.tsx` e `_app.reconhecimento.tsx`;
  "retirado por X" exibido em `_app.relatorios.tsx` e `_app.lista-diaria.tsx` (tela, CSV e PDF).
- Relatórios: contagem de "domicílios/famílias atendidas" passou a usar `familiaId ?? beneficiarioId`
  como chave (senão os independentes de `familiaId` nulo colapsavam num só).

#### Acurácia do reconhecimento facial (anti falso-positivo)
- Problema: pessoa parecida (sósia) às vezes era reconhecida como outra.
- **Threshold 0.6 → 0.5** (distância dlib; menor = mais rígido). O backend envia o threshold de
  `FACE_MATCH_THRESHOLD` ao `/face/compare` em vez de 0.6 fixo.
- **Teste de ambiguidade:** se o 2º melhor match está a menos de `FACE_MATCH_MARGIN` (0.06) do
  melhor, rejeita como `motivo: "ambiguo"` — guard específico contra sósias.
- **Jitters:** query `FACE_QUERY_JITTERS` (3) e cadastro `FACE_REGISTER_JITTERS` (5) — embeddings
  mais estáveis.
- Threshold e margin valem para embeddings **existentes** (sem re-cadastro); o bump de jitters no
  cadastro só melhora cadastros **novos**. O `model` do `face_encodings` seguiu 'small' de
  propósito (mudar exigiria re-cadastrar todo mundo).
- Arquivo: `face-service/main.py` (`/face/compare`, `/face/validate`, `/face/register`).
- Trade-off: mais rígido troca falso-positivo por eventual falso-negativo (pessoa legítima às
  vezes não reconhecida → tenta de novo ou busca por CPF). Tudo tunável por env, sem rebuild.

#### Deploy desta sessão
Backend + frontend + face-service (`.\build.ps1` → **[5] Tudo**) e **redeploy da stack completa**
no Portainer (o serviço `migrate` roda o `prisma db push` — remove a constraint e adiciona
`retiradoPorNome`).

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
- `Beneficiario`: `podeRetirar Boolean @default(true)` — gate da retirada por procuração (Sessão 7)
- `Configuracao`: `cadastroPublicoAtivo Boolean`, `cadastroPublicoToken String?`
- `FilaEntrada`: fichas do dia com senha zero-padded
- `Familia`: **grupo explícito** (opt-in), não mais único por endereço (Sessão 7)
- `Retirada`: `metodoRetirada MetodoRetirada @default(MANUAL)`, `retiradoPorNome String?` (procuração)
- `DocumentoRelatorio`: código `REL-YYYYMMDD-XXXXX`, período, totais, geradoPorId

---

## Impressora térmica
O sistema usa `window.print()` com HTML otimizado para bobina 80mm.
Configurar no Windows: definir a impressora como padrão, papel 80mm, sem margens,
sem cabeçalhos/rodapés. Não requer driver especial no sistema.

## Extensão PostgreSQL
A busca de beneficiários usa `unaccent` para ser insensível a acentos.
A extensão é criada automaticamente na primeira busca via `CREATE EXTENSION IF NOT EXISTS unaccent`.
