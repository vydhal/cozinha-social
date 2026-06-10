# Prompt de Integração — Rede de Atendimento Social

## Contexto

Este arquivo descreve o **contrato de integração** que cada sistema da rede deve implementar para que um hub centralizado (TwentyCRM ou painel próprio) consiga consultar o histórico de atendimentos de uma pessoa em todos os sistemas a partir do seu **CPF**.

Use este prompt para orientar um agente de IA a implementar a integração no sistema de destino.

---

## O que você precisa implementar

Adicione ao sistema um endpoint HTTP **público-protegido por API key**:

```
GET /api/integracao/pessoa/:cpf
Header obrigatório: X-Integration-Key: <valor de INTEGRATION_API_KEY>
```

### Comportamento esperado

1. Valide a header `X-Integration-Key` contra a env var `INTEGRATION_API_KEY`
   - Se a env var não estiver definida → `503 { error: "Integração não configurada" }`
   - Se a chave for inválida → `401 { error: "Chave de integração inválida" }`
2. Normalize o CPF recebido (aceite com ou sem máscara)
3. Busque a pessoa no banco pelo CPF
4. Retorne o JSON no formato abaixo

---

## Formato de resposta obrigatório

### Pessoa não encontrada
```json
{
  "sistema": "slug-do-sistema",
  "sistemaLabel": "Nome Legível do Sistema",
  "cpfConsultado": "070.760.684-51",
  "pessoaEncontrada": false
}
```

### Pessoa encontrada
```json
{
  "sistema": "slug-do-sistema",
  "sistemaLabel": "Nome Legível do Sistema",
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
    "profileUrl": "https://sistema.exemplo.com.br/pessoas/uuid-do-registro"
  },
  "resumo": {
    "totalAtendimentos": 7,
    "ultimoAtendimento": "2026-05-20T14:30:00.000Z",
    "campos_extras": {}
  },
  "eventos": [
    {
      "id": "uuid-do-evento",
      "tipo": "ATENDIMENTO",
      "data": "2026-05-20T14:30:00.000Z",
      "descricao": "Consulta de rotina — Unidade Básica de Saúde",
      "detalhes": {
        "qualquerCampo": "qualquerValor"
      }
    }
  ]
}
```

### Notas sobre o campo `tipo` em `eventos`
Use uma string descritiva para o tipo de evento do seu sistema. Exemplos:
- `"ATENDIMENTO"` — consulta médica, social, jurídica
- `"RETIRADA"` — retirada de quentinha, cesta básica, medicamento
- `"CADASTRO"` — entrada no sistema
- `"ENCAMINHAMENTO"` — encaminhamento para outro serviço
- `"DOCUMENTACAO"` — entrega ou validação de documento

---

## Referência — O que o Mesa do Bem já implementa

O sistema **Mesa do Bem** (cozinha comunitária) já expõe este endpoint em:
```
GET https://cozinha.simplisoft.com.br/api/integracao/pessoa/:cpf
```

Resposta real do Mesa do Bem:
```json
{
  "sistema": "mesa-do-bem",
  "sistemaLabel": "Cozinha Solidária Santa Rosa",
  "cpfConsultado": "070.760.684-51",
  "pessoaEncontrada": true,
  "pessoa": {
    "nome": "Anderson Phelipe Fernandes Cordeiro",
    "cpf": "070.760.684-51",
    "bairro": "Jardim Tavares",
    "cidade": "Campina Grande",
    "status": "ATIVO",
    "fotoUrl": "https://cozinha.simplisoft.com.br/uploads/fotos/xxx.jpg",
    "profileUrl": "https://cozinha.simplisoft.com.br/beneficiarios/uuid"
  },
  "resumo": {
    "totalRetiradas": 12,
    "totalQuentinhas": 24,
    "ultimaRetirada": "2026-06-08",
    "quentinhasAutorizadasPorDia": 2,
    "pessoasCasa": 4,
    "biometriaRegistrada": true,
    "membrosDaFamilia": 3
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

---

## Variáveis de ambiente necessárias

Adicione ao `.env` e ao `stack.yml` (Portainer secrets):

| Variável | Descrição | Exemplo |
|---|---|---|
| `INTEGRATION_API_KEY` | Chave secreta compartilhada entre os sistemas e o hub | `integ_k9x2mPqW7vRn` |
| `PUBLIC_URL` | URL pública do sistema, usada para montar `profileUrl` e `fotoUrl` | `https://saude.simplisoft.com.br` |

> **Importante:** Use a mesma `INTEGRATION_API_KEY` em todos os sistemas. O hub (TwentyCRM ou painel próprio) usará essa chave para consultar todos.

---

## Próximo passo — TwentyCRM como hub

Após cada sistema implementar este endpoint, o TwentyCRM será configurado para:

1. **Objeto `Pessoa`** com CPF como campo único identificador
2. **Webhook/cron por sistema** que chama `GET /api/integracao/pessoa/:cpf` e:
   - Cria ou atualiza o registro `Pessoa` no Twenty
   - Adiciona os `eventos` como atividades na timeline da pessoa
3. **Visão unificada**: cada registro de Pessoa no Twenty mostra a timeline completa cruzando todos os sistemas

### Sistemas previstos na rede
| Sistema | Slug | URL | Status |
|---|---|---|---|
| Cozinha Solidária (quentinhas) | `mesa-do-bem` | `https://cozinha.simplisoft.com.br` | ✅ Implementado |
| Sistema de Saúde | `saude` | — | ⏳ Pendente |
| _(adicionar outros)_ | | | |

---

## Instruções para o agente de IA

Ao receber este prompt, o agente deve:

1. Identificar o framework/linguagem do sistema (Fastify, Express, Django, Laravel, etc.)
2. Criar o módulo de integração seguindo o contrato acima
3. Registrar a rota em `/api/integracao/pessoa/:cpf`
4. Validar a `X-Integration-Key` contra `process.env.INTEGRATION_API_KEY`
5. Buscar a pessoa pelo CPF normalizado (aceitar com e sem máscara)
6. Retornar o JSON no formato especificado, preenchendo `resumo` e `eventos` com os dados relevantes do sistema
7. Adicionar `INTEGRATION_API_KEY` e `PUBLIC_URL` nas variáveis de ambiente do projeto
8. Documentar o endpoint no README do projeto

O endpoint não precisa de autenticação JWT — a API key é suficiente para uso máquina-a-máquina.
