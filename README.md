# Mesa do Bem — Plataforma de Gestão de Cozinha Comunitária

Sistema completo para gerenciar a distribuição de quentinhas em cozinhas comunitárias. Permite cadastrar beneficiários, controlar retiradas diárias, gerenciar fila virtual com painel de TV, gerar relatórios e administrar a equipe — tudo com suporte a reconhecimento facial.

Acesso em produção: **https://cozinha.simplisoft.com.br**

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | TanStack Start (SSR) + React 19 + TanStack Router + Vite |
| Estilização | Tailwind CSS v4 + shadcn/ui |
| Estado | Zustand (persist) + TanStack Query |
| Backend | Node.js + Fastify + Prisma ORM |
| Banco de dados | PostgreSQL 16 |
| Face Service | Python + FastAPI + MediaPipe + face_recognition (dlib/HOG) |
| Mobile/PWA | Layout `h-dvh` com scroll interno — bottom nav sempre fixo |
| Compatibilidade | CSS com downlevel via PostCSS — funciona em tablets/navegadores antigos |
| Infraestrutura | Docker Swarm via Portainer + Traefik (SSL automático) |
| Imagens | Docker Hub — `vydhal/mesa-do-bem-*` (versão vigente no `stack.yml`) |

---

## Funcionalidades

### Autenticação e Controle de Acesso
- Login com email e senha (JWT 15min + Refresh Token 7 dias)
- Email case-insensitive (normalizado para minúsculo)
- Logout automático por inatividade após 30 minutos
- Três perfis de acesso: **Colaborador**, **Admin**, **Superadmin**
- Menus e rotas filtrados dinamicamente por perfil
- **Impersonation**: Superadmin pode simular o acesso de qualquer outro usuário com banner de identificação e botão "Sair da simulação"

### Dashboard
- KPIs em tempo real (9 cards): quentinhas disponíveis, entregues, fila virtual, famílias atendidas, média semanal, comparecimento, tentativas duplicadas, **cadastros completos** (com biometria), cadastros incompletos
- Barra de progresso da cota diária com alerta ao atingir 85%
- Gráficos: distribuição da semana, horários de pico, evolução mensal
- Tabela de famílias mais frequentes e frequência por bairro
- Painel de alertas
- Tabela das últimas 8 retiradas do dia
- Atualização automática a cada 30 segundos

### Beneficiários
- Listagem com busca por nome/CPF, filtros de status e paginação
- Cadastro completo com validação em português:
  - Dados pessoais: nome, CPF, RG, data de nascimento, telefone
  - Endereço: CEP, logradouro, número, bairro, cidade, UF
  - Dados familiares: pessoas na casa, nomes dos moradores, quentinhas autorizadas
  - **Perfil social** (11 campos): gênero, raça/cor, naturalidade, estado civil, renda familiar, Bolsa Família, NIS, deficiência, tipo de deficiência, nome da mãe, nome do pai
- Foto de perfil via upload ou câmera (webcam)
- Registro e visualização de biometria facial
- **Exportação CSV** da listagem atual (respeita filtros de busca e status ativos)
- **Importação em lote via CSV** com 26 campos suportados e dialog de progresso animado
- Download de modelo CSV com todos os campos e valores aceitos
- Máscara automática nos campos CPF (`000.000.000-00`) e CEP (`00000-000`)
- Soft delete com confirmação

### Retiradas
- Busca de beneficiário por nome ou CPF
- Validação automática: cota do dia, duplicidade, status
- Confirmação de retirada com quantidade de quentinhas
- Bloqueio automático de duplicadas no mesmo dia

### Reconhecimento Facial
- Câmera ao vivo via `getUserMedia`
- **Escolha da câmera** (frontal/traseira) em celulares e tablets — o seletor só
  aparece quando há mais de uma, e a preferência do operador fica salva no aparelho
- Captura de frame e identificação entre todos os beneficiários cadastrados
- Detector primário: **MediaPipe** (tolerante a ângulos, baixa luz, distâncias variadas)
- Fallback automático para **HOG** (dlib) se MediaPipe não detectar
- Embeddings gerados via `face_recognition` (dlib)
- Exibe resultado: encontrado / já retirou / não reconhecido / erro
- Confirmação direta da retirada após identificação

### Fila Virtual
- Entrada na fila pelo operador
- Painel de TV (`/painel`) com exibição em tempo real via WebSocket
- Ações: chamar próximo, concluir atendimento
- Atualização automática sem reload

### Lista Diária
- Visão completa das retiradas do dia com filtros
- Cards de stats: entregues, ausentes, quentinhas, disponíveis
- Barra de progresso da cota com alerta visual ao atingir 90%
- Admin e Superadmin podem editar o limite diário inline (sem reload)

### Relatórios
- Filtros por período, operador e bairro
- Tabela de retiradas com totalizadores
- Exportação **CSV** (UTF-8 com BOM, compatível com Excel)
- Exportação **PDF** (HTML estilizado, impressão automática)
- Impressão direta da página

### Equipe
- Listagem de usuários com avatar, cargo e status
- Criar, editar e remover membros (Superadmin)
- Toggle de acesso ativo/inativo por usuário
- **Simular acesso**: botão "Simular" em cada card para impersonation
- Tabela de permissões por perfil
- Log de atividade em tempo real (últimas 20 ações)

### Configurações *(Admin / Superadmin)*
- Nome da cozinha, cor primária, mensagem de boas-vindas
- Upload de logo e favicon (exibidos na tela de login e interface)
- Limite diário de quentinhas
- Gerenciamento de bairros atendidos
- Alteração de senha

### Superadmin
- Estatísticas globais (beneficiários, retiradas, usuários, unidades)
- Gerenciamento de bairros
- Multiunidades (estrutura preparada)
- Impersonation de usuários

---

## Roles e Permissões

| Funcionalidade | Colaborador | Admin | Superadmin |
|---|:---:|:---:|:---:|
| Confirmar retirada | ✓ | ✓ | ✓ |
| Cadastrar beneficiários | ✓ | ✓ | ✓ |
| Reconhecimento facial | ✓ | ✓ | ✓ |
| Fila virtual | ✓ | ✓ | ✓ |
| Lista diária | ✓ | ✓ | ✓ |
| Excluir beneficiários | — | ✓ | ✓ |
| Ver relatórios | — | ✓ | ✓ |
| Editar limite diário | — | ✓ | ✓ |
| Gerenciar equipe | — | — | ✓ |
| Configurar plataforma | — | — | ✓ |
| Impersonation | — | — | ✓ |
| Gestão de unidades | — | — | ✓ |

---

## Estrutura do Projeto

```
cozinha/
├── backend/                  # Fastify + Prisma + PostgreSQL
│   ├── src/
│   │   ├── modules/          # auth, beneficiarios, retiradas, fila, relatorios, equipe, configuracoes, admin
│   │   ├── middlewares/      # authenticate, rbac
│   │   └── shared/           # prisma, errors, utils (hash, upload, audit)
│   └── prisma/
│       ├── schema.prisma
│       └── seed.ts
├── frontend/                 # TanStack Start + React
│   ├── postcss.config.mjs            # Tailwind + downlevel p/ navegadores antigos
│   ├── postcss-legacy-compat.mjs     # Achata @layer, ajusta gradientes e svh/dvh
│   └── src/
│       ├── routes/           # _app.*.tsx (autenticadas), login.tsx, painel.tsx
│       ├── components/       # AppShell, StatCard, FotoCaptura, BiometriaCard...
│       └── lib/
│           ├── api/          # auth, beneficiarios, retiradas, fila, relatorios, equipe, configuracoes, admin
│           └── store.ts      # Zustand: auth (com impersonation) + settings
├── face-service/             # Python FastAPI — register/validate/compare/detect
├── build.ps1                 # Script PowerShell de build & push para Docker Hub
└── stack.yml                 # Docker Swarm — Traefik + 5 serviços
```

---

## Deploy em Produção (Docker Swarm / Portainer)

### Variáveis de ambiente obrigatórias

| Variável | Descrição |
|---|---|
| `POSTGRES_PASSWORD` | Senha do PostgreSQL |
| `JWT_SECRET` | Chave de assinatura JWT (mín. 32 chars) |
| `JWT_REFRESH_SECRET` | Chave para refresh tokens |
| `ADMIN_PASSWORD` | Senha do superadmin (`vydhal@gmail.com`) |
| `NOME_COZINHA` | Nome exibido na interface (padrão: `Cozinha Solidária`) |
| `LIMITE_DIARIO` | Cota inicial de quentinhas (padrão: `100`) |
| `SEED_DEMO_DATA` | `true` para criar beneficiários e usuários de demo |

### Procedimento

1. Configurar variáveis no Portainer
2. Colar o conteúdo de `stack.yml` no editor de Stack
3. Fazer deploy — o serviço `migrate` roda `prisma db push` + `seed.ts` automaticamente
4. Superadmin inicial: `vydhal@gmail.com` / valor de `ADMIN_PASSWORD`

### Publicar imagens (build.ps1)

Use o script PowerShell na raiz do projeto:

```powershell
.\build.ps1 1.0.1
```

O menu interativo permite escolher o que publicar:

| Opção | O que publica |
|---|---|
| `1` | Apenas Frontend |
| `2` | Apenas Backend |
| `3` | Apenas Face Service |
| `4` | Frontend + Backend |
| `5` | Tudo (Frontend + Backend + Face Service) |

Após o build, o script oferece atualizar as versões no `stack.yml` automaticamente.

### O que atualizar no Portainer após cada publicação

| Alteração | Ação no Portainer |
|---|---|
| Frontend | Force Update no serviço `mesa_frontend` |
| Backend | Redeploy da stack completa (roda migrate/seed) |
| Face Service | Force Update no serviço `mesa_face_service` |
| Só `stack.yml` | Redeploy da stack (sem rebuild) |

### Roteamento Traefik

| Path | Serviço | Porta |
|---|---|---|
| `/api/*` | backend | 3001 |
| `/uploads/*` | backend (arquivos estáticos) | 3001 |
| `/*` (demais) | frontend | 3000 |

---

## Desenvolvimento Local

### Backend
```bash
cd backend
cp .env.example .env   # configurar DATABASE_URL, JWT_SECRET, etc.
npm install
npm run db:migrate
npm run db:seed
npm run dev            # http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

### Face Service
```bash
cd face-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## API — Principais Endpoints

| Método | Endpoint | Descrição | Auth |
|---|---|---|---|
| POST | `/api/auth/login` | Login | Público |
| POST | `/api/auth/refresh` | Renovar token | Público |
| GET | `/api/auth/me` | Usuário logado | JWT |
| POST | `/api/auth/impersonate/:userId` | Impersonar usuário | Superadmin |
| GET | `/api/configuracoes/public` | Config pública (login) | Público |
| GET | `/api/beneficiarios` | Listar com filtros | JWT |
| POST | `/api/beneficiarios` | Criar | JWT |
| PUT | `/api/beneficiarios/:id` | Editar | JWT |
| DELETE | `/api/beneficiarios/:id` | Excluir (soft) | Admin |
| POST | `/api/beneficiarios/importar` | Importar CSV (26 campos) | JWT |
| POST | `/api/beneficiarios/:id/biometria` | Registrar face | JWT |
| POST | `/api/retiradas/reconhecer` | Identificar por face | JWT |
| GET | `/api/retiradas/lista-diaria` | Lista do dia | JWT |
| POST | `/api/retiradas/confirmar` | Confirmar retirada | JWT |
| GET | `/api/fila` | Estado da fila | JWT |
| WS | `/api/fila/ws` | WebSocket tempo real | Público |
| GET | `/api/relatorios/dashboard` | KPIs | JWT |
| GET | `/api/relatorios` | Relatório completo | Admin |
| GET | `/api/equipe` | Listar equipe | Admin |
| POST | `/api/equipe` | Criar usuário | Superadmin |
| GET | `/api/configuracoes` | Ler configurações | JWT |
| PUT | `/api/configuracoes` | Atualizar configurações | Superadmin |
| PATCH | `/api/configuracoes/limite-diario` | Editar cota | Admin |
| POST | `/api/relatorios/documento` | Gerar documento autenticado | Admin |
| GET | `/api/validar/:codigo` | Validar documento ou retirada | Público |

---

## Face Service — Endpoints

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/health` | Status do serviço |
| POST | `/face/register` | Registrar embedding de uma face |
| POST | `/face/validate` | Validar face contra embedding salvo |
| POST | `/face/compare` | Comparar face contra lista de embeddings |
| POST | `/face/detect` | Detectar faces em imagem (multipart) |

**Pipeline de detecção:** MediaPipe (primário, tolerante a ângulos) → HOG/dlib (fallback)

---

## Histórico de Correções Relevantes

| Bug | Causa | Correção |
|---|---|---|
| 404 em todas as chamadas de API | Label `priority=10` no serviço frontend em vez do backend | Movida para o serviço backend no `stack.yml` |
| Imagens (logo/avatar) retornando 404 | Traefik não roteava `/uploads/*` para o backend | Adicionado `PathPrefix('/uploads')` na regra do backend |
| Logout ao atualizar página (F5) | Redirect SSR no `beforeLoad` antes de checar `window` | Revertido para verificação client-only |
| Senha do superadmin não atualizava | `prisma upsert` sem `senha` no bloco `update` | Adicionado `senha: senhaAdmin` no update |
| Login falhava com email maiúsculo | Lookup sem normalização | `.toLowerCase()` no auth e equipe service |
| Face service caía com OOM | `model="cnn"` carregava ~500 MB na primeira chamada | Substituído por MediaPipe + HOG fallback |
| Face service não iniciava (`libGL.so.1`) | Lib ausente na imagem Docker | Adicionado `libgl1` no `apt-get` do Dockerfile |
| Exportar beneficiários retornava 422 | Schema Zod limitava `limit` a máx 100 | Aumentado para 9999 em `beneficiarios.schema.ts` |
| Exportar CSV quebrava (`cannot read replace`) | Campos do banco podiam ser `null` | `?? ""` em todos os campos antes de processar |
| Bottom nav scrollava junto no mobile/PWA | `min-h-svh` permitia scroll da página inteira | `h-dvh` + `overflow-y-auto` no `main` + `MobileBottomNav` fora da área scrollável |
| CEP aceitava dígitos ilimitados | Campo sem restrição no onChange | Função `maskCep` em `utils.ts`, aplicada em `novo.tsx`, `$id.tsx` e `cadastro.tsx` |
| Aplicação abria **sem nenhum estilo** em tablet Android | Tailwind v4 envolve toda a folha em `@layer`; navegador antigo (Chrome < 99) ignora o at-rule e descarta tudo dentro dele | Tailwind movido para PostCSS + plugin local que achata as cascade layers |
| Cores sumiam em navegador antigo | Cores do tema em `oklch()` dentro de custom properties, onde fallback por dupla declaração não funciona | `postcss-preset-env` converte `oklch()` → `rgb()` |
| Fundo do `/painel` sumia (texto branco em fundo branco) | `linear-gradient(... in oklab, ...)` inválido em navegador antigo descartava a declaração | `in oklab` removido do `--tw-gradient-position` no build |
| Reconhecimento facial só usava a câmera frontal | `facingMode: "user"` fixo no `getUserMedia` | Seletor de câmera com preferência salva em `localStorage` |
| Preview de câmera pequeno/descentralizado no tablet (cadastro e biometria) | Container do vídeo sem `w-full` encolhia dentro do `grid` do `DialogContent` | `mx-auto aspect-square w-full max-w-[20rem]` no box + dialog com scroll |

---

## Sessão 3 — Relatório autenticado + Validação pública

### PDF do relatório personalizado
- **Cabeçalho**: logo configurada pelo superadmin + nome da cozinha
- **Rodapé**: imagem institucional `rodape.png` (ARCCiD / Sana Sorte / Lotep) fixada no fundo de cada página
- **Coluna "Método"** na tabela: badge "Facial" (verde) ou "Manual" (cinza)
- Retiradas faciais exibem ID curto individual no PDF (primeiros 8 chars do UUID)
- Botão PDF agora gera um **código de autenticação** (`REL-YYYYMMDD-XXXXX`) antes de abrir a janela de impressão
- URL de validação impressa no documento: `https://cozinha.simplisoft.com.br/validar?codigo=REL-…`

### Rastreabilidade de método de retirada
- Schema: enum `MetodoRetirada` (`FACIAL | MANUAL`) + campo `metodoRetirada` em `Retirada`
- Retirada manual (rota `/retirada`) → grava `MANUAL`
- Retirada por reconhecimento facial (`/reconhecimento`) → grava `FACIAL`

### Documentos autenticados — `DocumentoRelatorio`
- Novo modelo no banco: `codigo`, `periodo`, `dataInicio`, `dataFim`, `totalRetiradas`, `totalQuentinhas`, `bairro`, `geradoPor`, `geradoEm`
- `POST /api/relatorios/documento` (Admin+) — cria o registro e retorna o código
- Endpoint público `GET /api/validar/:codigo` (sem auth):
  - Código `REL-*` → resumo do relatório (período, totais, quem gerou)
  - UUID → detalhes da retirada individual (nome, CPF, bairro, data, quantidade, operador)

### Página pública `/validar`
- Rota sem autenticação, acessível por qualquer pessoa
- Campo de entrada para o código; aceita URL com `?codigo=...` para pré-preencher
- Exibe resultado: **documento** (stats do relatório) ou **retirada individual** (dados da pessoa)
- Destinada ao uso pelo Ministério Público e órgãos de fiscalização

---

## Sessão 6 — Suporte a tablets + escolha de câmera

### Aplicação abria sem estilo em tablets

**Sintoma:** em tablet Android a página renderizava como HTML puro — fonte serifada,
campos nativos, logo em tamanho original. Desktop e celular funcionavam normalmente.

**Diagnóstico:** não era responsividade. O React carregava e buscava dados sem erro
(a logo vinha da API); o que acontecia é que **a folha de estilo inteira era descartada**.
O Tailwind v4 mira Chrome 111+ / Safari 16.4+ e envolve todo o CSS em
`@layer theme/base/components/utilities`. Navegador sem suporte a cascade layers
(Chrome < 99, Safari < 15.4) ignora o at-rule e joga fora tudo que está dentro.

**Solução:** o Tailwind passou a rodar via **PostCSS** em vez do plugin do Vite,
permitindo pós-processar o CSS gerado:

| Arquivo | Papel |
|---|---|
| `frontend/postcss.config.mjs` | Pipeline: Tailwind → compat → `postcss-preset-env` |
| `frontend/postcss-legacy-compat.mjs` | Achata `@layer`, remove `in oklab` dos gradientes, adiciona fallback `vh` para `svh`/`dvh` |
| `frontend/package.json` → `browserslist` | Alvo de navegadores (Chrome/Android ≥ 87) |

**Como validar após qualquer mudança de CSS** — no `dist/client/assets/*.css` gerado,
tanto `@layer` quanto `oklch` devem aparecer **zero** vezes.

> **Atenção ao mexer no pipeline:** a feature `cascade-layers` do `postcss-preset-env`
> (e o `@csstools/postcss-cascade-layers`) **travam o build** — mais de 10 minutos sem
> concluir no volume de CSS deste projeto. A feature `gradient-interpolation-method`
> tem o mesmo problema. Por isso o plugin local enxuto em vez das soluções prontas.

Não foi preciso tratar `color-mix()`: o Tailwind 4.2 já emite fallback em `@supports`
para todo modificador de opacidade (`bg-primary/10`).

### Escolha de câmera no reconhecimento facial

Celulares e tablets têm câmera frontal e traseira, mas o código fixava a frontal.

- Seletor aparece **apenas quando há mais de uma câmera** — desktop com uma webcam
  fica inalterado
- Preferência do operador salva no aparelho (`localStorage`, chave `mdb-camera-id`)
- A câmera atual é liberada antes de abrir a nova: vários Androids recusam abrir a
  segunda enquanto a primeira estiver ativa
- Se a câmera salva não existir mais no aparelho, volta para a frontal em vez de travar
- Os nomes das câmeras só ficam legíveis após a permissão ser concedida; sem rótulo,
  exibe "Câmera 1/2"

**Ainda sem seletor:** a captura de biometria em `_app.beneficiarios.$id.tsx` continua
fixada na câmera frontal (proposital — a pessoa se posiciona olhando para a tela).

### Preview de câmera desalinhado no tablet (cadastro)

Nos dialogs de foto do beneficiário e de captura facial, o vídeo aparecia pequeno e
fora do centro no tablet. O container do vídeo não tinha `w-full`; dentro do
`DialogContent` (que é um `grid`), sem largura explícita o box encolhia para o tamanho
do conteúdo em vez de ocupar a largura toda — a tela de reconhecimento, que já
funcionava, tinha esse `w-full`. Corrigido nos dois dialogs com
`mx-auto aspect-square w-full max-w-[20rem]` no box do vídeo, e `max-h-[90vh]
overflow-y-auto` no dialog para rolar caso ultrapasse a altura da tela.

### Observação sobre a cor da interface

A cor primária vista na tela **não** é a do `styles.css` — `_app.tsx` sobrescreve
`--primary` em runtime a partir da `corPrimaria` definida em Configurações. Ao investigar
suspeita de problema de tema, verifique a configuração da unidade antes do CSS.
