# Prompt para agente — Análise e configuração do TwentyCRM como hub de integração

## Contexto geral

Este repositório é um **fork do TwentyCRM** (https://github.com/twentyhq/twenty), um CRM open-source moderno com interface tipo Notion/Linear. Ele será usado como **hub centralizado** de uma rede de atendimento social, consumindo dados de múltiplos sistemas via API.

Você foi acionado para:
1. **Analisar a estrutura** do repositório e entender o que já está pronto
2. **Identificar como rodá-lo** localmente e via Docker
3. **Planejar e implementar** a integração com os sistemas da rede

---

## Parte 1 — Análise do repositório (faça primeiro)

### 1.1 Estrutura geral
Explore o repositório e responda:
- Quais são os principais diretórios e o que cada um faz? (`packages/`, `apps/`, `infra/`, `docker/`, etc.)
- Qual é o stack tecnológico? (framework frontend, backend, banco de dados, ORM)
- Existe um `docker-compose.yml` ou `docker-compose.dev.yml` funcional?
- Existe documentação de setup? (`README.md`, `docs/`, `CONTRIBUTING.md`)

### 1.2 Como rodar localmente
Identifique e documente o procedimento mínimo para:
- Instalar dependências
- Configurar variáveis de ambiente (`.env.example` ou similar)
- Subir o banco de dados
- Rodar o projeto em modo desenvolvimento

### 1.3 Modelo de dados existente
O Twenty tem um sistema de objetos customizáveis ("Custom Objects"). Verifique:
- Existe uma entidade `Person` (Pessoa) nativa?
- É possível adicionar campos customizados via interface ou código?
- Como funcionam as **Activities/Timeline** — existe uma forma de registrar eventos associados a uma pessoa?
- Existe suporte a **Webhooks** ou **API REST/GraphQL** para criação/atualização de registros programaticamente?

### 1.4 API do Twenty
- O Twenty expõe uma API GraphQL ou REST?
- Como criar um registro de `Person` via API?
- Como adicionar uma Activity/Note/Timeline event a uma pessoa via API?
- Existe autenticação por API key ou apenas OAuth/JWT?

---

## Parte 2 — Contexto da integração (leia com atenção)

### Os sistemas da rede

A rede de atendimento social tem múltiplos sistemas isolados. Cada um já implementa (ou vai implementar) o seguinte endpoint:

```
GET /api/integracao/pessoa/:cpf
Header obrigatório: X-Integration-Key: <INTEGRATION_API_KEY>
```

**Sistemas da rede:**
| Sistema | Slug | URL | Status |
|---|---|---|---|
| Cozinha Solidária (quentinhas) | `mesa-do-bem` | `https://cozinha.simplisoft.com.br` | ✅ Implementado |
| Sistema de Saúde | `saude` | *(a definir)* | ⏳ Pendente |
| *(outros)* | | | |

### Formato de resposta dos sistemas

```json
{
  "sistema": "mesa-do-bem",
  "sistemaLabel": "Cozinha Solidária Santa Rosa",
  "cpfConsultado": "070.760.684-51",
  "pessoaEncontrada": true,
  "pessoa": {
    "nome": "João da Silva",
    "cpf": "070.760.684-51",
    "nascimento": "1985-04-12T00:00:00.000Z",
    "telefone": "(83) 99999-9999",
    "bairro": "Jardim Tavares",
    "cidade": "Campina Grande",
    "status": "ATIVO",
    "fotoUrl": "https://sistema.exemplo.com.br/uploads/foto.jpg",
    "profileUrl": "https://sistema.exemplo.com.br/beneficiarios/uuid"
  },
  "resumo": {
    "totalRetiradas": 12,
    "totalQuentinhas": 24,
    "ultimaRetirada": "2026-06-08",
    "biometriaRegistrada": true
  },
  "eventos": [
    {
      "id": "uuid",
      "tipo": "RETIRADA",
      "data": "2026-06-08T20:55:00.000Z",
      "descricao": "Retirada de 2 quentinhas — Facial",
      "detalhes": {
        "quantidade": 2,
        "metodo": "FACIAL",
        "operador": "Maria da Silva"
      }
    }
  ]
}
```

### Objetivo da integração no Twenty

Para cada pessoa da rede, o Twenty deve:
1. Ter um registro de **Pessoa** com CPF como campo único identificador
2. Mostrar na timeline da pessoa os **eventos de todos os sistemas** (quentinhas retiradas, atendimentos de saúde, etc.)
3. Permitir busca por CPF para ver o histórico unificado

---

## Parte 3 — O que implementar

### 3.1 Objeto customizado "Pessoa"
Crie (via API, seed, ou migration) um objeto `Pessoa` com os campos:
- `cpf` (string, único — identificador de integração)
- `nome` (string)
- `nascimento` (date, opcional)
- `telefone` (string, opcional)
- `bairro` (string, opcional)
- `cidade` (string, opcional)
- `fotoUrl` (string, opcional)

Se o Twenty já tiver um objeto `Person` nativo, avalie se é melhor estender ele ou criar um objeto separado para pessoas atendidas.

### 3.2 Serviço de sincronização
Crie um serviço (pode ser um worker, cron job, ou script standalone) que:

1. Recebe um CPF
2. Consulta todos os sistemas da rede:
   ```
   GET https://cozinha.simplisoft.com.br/api/integracao/pessoa/CPF
   Header: X-Integration-Key: <INTEGRATION_API_KEY>
   ```
3. Para cada sistema que retornar `pessoaEncontrada: true`:
   - Faz upsert da Pessoa no Twenty (cria ou atualiza pelo CPF)
   - Adiciona os `eventos` como activities/notes na timeline da pessoa
   - Não duplica eventos (use o campo `id` do evento como referência)
4. Retorna um resumo: quais sistemas encontraram a pessoa, quantos eventos foram sincronizados

### 3.3 API de sincronização
Exponha um endpoint interno:
```
POST /integracao/sincronizar
Body: { "cpf": "070.760.684-51" }
```
Que dispara a sincronização para aquele CPF e retorna o resultado.

### 3.4 Variáveis de ambiente necessárias
```env
INTEGRATION_API_KEY=<mesma chave usada em todos os sistemas>
INTEGRACAO_SISTEMAS=https://cozinha.simplisoft.com.br,https://saude.simplisoft.com.br
```
`INTEGRACAO_SISTEMAS` é uma lista separada por vírgula das URLs base dos sistemas. O serviço itera sobre elas chamando `/api/integracao/pessoa/:cpf` em cada uma.

---

## Parte 4 — Entregáveis esperados

Ao concluir, documente:

1. **Como rodar o projeto** — passo a passo mínimo (desenvolvimento e Docker)
2. **Como o objeto Pessoa foi criado** — via API, seed, migration?
3. **Como chamar a sincronização** — endpoint, autenticação, exemplo de curl
4. **O que fazer quando adicionar um novo sistema** à rede (ex: sistema jurídico) — basta adicionar a URL em `INTEGRACAO_SISTEMAS`?
5. **Limitações encontradas** — o que o Twenty não suporta nativamente que precisou de workaround?

---

## Observações importantes

- O CPF é o **único identificador comum** entre todos os sistemas. Não há sincronização de IDs internos.
- A mesma `INTEGRATION_API_KEY` é usada em todos os sistemas. Guarde-a como segredo (Portainer secret, .env não commitado).
- Eventos não devem ser duplicados. Ao sincronizar um CPF pela segunda vez, apenas novos eventos devem ser inseridos.
- Se um sistema retornar `pessoaEncontrada: false`, ignore-o silenciosamente (a pessoa pode não estar cadastrada em todos os sistemas).
- Este fork pode ter divergido do upstream. Se encontrar conflitos ou partes incompletas, documente antes de implementar.
