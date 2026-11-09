# Arquitetura técnica — VPS elobase (`srv1841357`)

> Documento de referência da infraestrutura desta VPS, pra ser usado ao planejar a
> migração de **qualquer projeto** pra cá (não só este). Descreve o que já está
> instalado e rodando, e o padrão de stack a seguir pra novos deploys — incluindo banco
> de dados (subir vazio vs. restaurar dump de um projeto existente).
>
> Confirmado por inspeção direta na VPS em 21/08/2026 (não é suposição). Se algo aqui
> mudar (Traefik reconfigurado, Swarm ativado, etc.), atualize este arquivo.

---

## 1. Modelo de execução: Docker **standalone**, não Swarm

```
docker info | grep -i swarm   →  Swarm: inactive
docker network ls --filter driver=overlay  →  (vazio, nem "ingress" existe)
```

Ou seja: **não há cluster Swarm nessa VPS.** É um host Docker único rodando containers
soltos / stacks via `docker compose`. Isso importa muito na hora de escrever uma stack
nova:

| | Swarm (ex.: VPS `campanha.simplisoft.com.br`) | Esta VPS (elobase) |
| --- | --- | --- |
| Deploy | `docker stack deploy` | `docker compose up` (Portainer roda por trás) |
| Sintaxe de recursos/restart | `deploy.replicas`, `deploy.placement`, `deploy.resources.limits`, `deploy.restart_policy` | `restart:`, `mem_limit:` (chaves de compose comuns) |
| Rede entre serviços | overlay `external: true`, atravessa hosts | bridge local (`portainer_default` ou uma própria da stack), só dentro desta VPS |
| Réplicas/HA | suporta nativamente | 1 container por serviço; sem HA automática |

**Não inicializar Swarm nessa VPS só pra resolver isso** — pra um host único rodando
várias stacks isoladas, compose puro é suficiente e mais simples. Só considerar Swarm
se um dia precisar de múltiplos hosts formando um cluster de verdade.

Ao escrever uma stack nova pra essa VPS: **sempre usar sintaxe de docker-compose comum**
(sem `deploy:` de Swarm), do jeito que está em `stack-elobase.yml` (raiz deste repo) —
use esse arquivo como modelo de partida.

---

## 2. Portainer

- Container: `portainer-portainer-1` (imagem `portainer/portainer-ce:latest`)
- Endpoint local é standalone (não Swarm) — as stacks criadas por ele aparecem como
  tipo **"Compose"** na listagem (Stacks list), não "Swarm".
- Pra subir uma stack nova: Portainer → **Stacks → Add stack** → colar o YAML → definir
  as environment variables da stack (segredos, domínio, etc.) → **Deploy the stack**.
- Controle de acesso da stack "portainer" (a do próprio Portainer) aparece como
  `Limited` — não mexer nela.

## 3. Traefik (reverse proxy / TLS)

- Container: `traefik` (imagem `traefik:latest`), rodando como container comum (não
  serviço Swarm).
- **Rede**: `portainer_default` (bridge, já existe, criada quando a stack do Portainer
  subiu). Qualquer serviço que precisa ser exposto por domínio **tem que estar nessa
  mesma rede** e ter `traefik.docker.network=portainer_default` no label, senão o
  Traefik não enxerga.
- **Configuração real** (extraída de `docker inspect traefik --format {{.Config.Cmd}}`):
  ```
  --entrypoints.web.address=:80
  --entrypoints.websecure.address=:443
  --api.insecure=true
  --api.dashboard=true
  --providers.docker
  --log.level=ERROR
  --certificatesresolvers.leresolver.acme.httpchallenge=true
  --certificatesresolvers.leresolver.acme.email=vydhal@gmail.com
  --certificatesresolvers.leresolver.acme.storage=./acme.json
  --certificatesresolvers.leresolver.acme.httpchallenge.entrypoint=web
  ```
  Pontos que **mudam de VPS pra VPS** — nunca supor, sempre conferir com o comando acima
  antes de escrever labels novos:
  - **Nome do certresolver**: aqui é **`leresolver`** (na VPS simplisoft é
    `letsencryptresolver`).
  - Entrypoints (`web`/`websecure`) coincidem com a outra VPS, mas confirme sempre.
  - `--providers.docker` sem `exposedbydefault=false` explícito → o padrão do Traefik é
    `exposedByDefault=true`, ou seja, **qualquer container na mesma rede sem
    `traefik.enable=false` pode em tese ganhar rota**. Na prática isso não causa
    problema porque só quem tem `traefik.enable=true` + `Host()` rule ganha um router
    de verdade, mas vale ter em mente ao subir um serviço novo nessa rede que você não
    queira expor: adicione `traefik.enable=false` nele explicitamente por segurança.

**Template de labels pra expor um serviço novo por HTTPS nessa VPS:**
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.docker.network=portainer_default"
  - "traefik.http.routers.<nome-unico>.rule=Host(`seu-dominio.tld`)"
  - "traefik.http.routers.<nome-unico>.entrypoints=websecure"
  - "traefik.http.routers.<nome-unico>.tls.certresolver=leresolver"
  - "traefik.http.services.<nome-unico>.loadbalancer.server.port=<porta-interna>"
```
Troque `<nome-unico>` por um prefixo específico do projeto (ex.: `campanha-eb-backend`)
pra não colidir com routers/services de outras stacks que também estão na mesma rede
Traefik.

## 4. Redes Docker existentes

```
bridge            (padrão do Docker)
host              (padrão do Docker)
none              (padrão do Docker)
portainer_default  (bridge — Portainer + Traefik + qualquer stack exposta por domínio)
```

Padrão recomendado pra stack nova: usar `portainer_default` (`external: true`) só nos
serviços que o Traefik precisa alcançar (backend/frontend/o que for exposto por
domínio); criar uma rede própria da stack (`internal`, `driver: bridge`, sem
`external`) pra tráfego interno (ex.: app ↔ banco) que não precisa passar pelo Traefik.

## 5. Banco de dados — padrão adotado

**Não existe um Postgres/MySQL compartilhado nessa VPS.** Cada stack sobe o próprio
banco como serviço dela (container + volume próprios), isolado das demais. Ao migrar um
projeto pra cá, duas situações possíveis:

### 5.1 Projeto novo, banco vazio
Suba o serviço de banco normalmente na própria stack (ver `campanha-db` em
`stack-elobase.yml` como exemplo), sem restaurar nada — o próprio app cria o schema
(migration) e o seed inicial no primeiro boot.

### 5.2 Projeto existente sendo migrado de outro servidor (precisa do dump)
Passo a passo geral (Postgres como exemplo — adaptar se for MySQL/outro):

1. **No servidor de origem**, gerar o dump:
   ```bash
   docker exec <container-do-postgres-origem> pg_dump -U postgres -F c -d <nome_do_banco> -f /tmp/dump.dump
   docker cp <container-do-postgres-origem>:/tmp/dump.dump ./dump.dump
   ```
2. **Copiar o arquivo `dump.dump`** pra esta VPS (via `scp`, ou upload manual).
3. **Subir a stack nova aqui primeiro só com o serviço de banco** (sem app/backend
   ainda), banco vazio, mesmo `POSTGRES_DB`/`POSTGRES_USER` do original.
4. **Copiar o dump pro container** e restaurar:
   ```bash
   docker cp ./dump.dump <container-do-postgres-novo>:/tmp/dump.dump
   docker exec <container-do-postgres-novo> pg_restore -U postgres -d <nome_do_banco> --clean --if-exists /tmp/dump.dump
   ```
5. **Só depois** subir o resto da stack (backend/frontend), com as envs
   apontando pro banco já restaurado.
6. Gerar segredos **novos** pra essa instância (`JWT_SECRET`, senhas de
   admin/superadmin, etc.) — nunca reaproveitar segredo de outro servidor, mesmo
   migrando os dados.

Se o projeto usar volume de storage tipo MinIO/uploads (arquivos, não só banco), o
mesmo raciocínio vale pra pasta de dados: copiar o conteúdo do volume de origem
(`docker cp` ou `tar` do volume) pro volume novo antes de subir o serviço.

## 6. Checklist rápido pra planejar a stack de um novo projeto aqui

1. Confirmar que o modelo é este documento descreve ainda vale (Swarm continua
   inativo? Traefik continua com o mesmo certresolver/rede?) — rodar de novo:
   ```
   docker info | grep -i swarm
   docker inspect traefik --format "{{json .NetworkSettings.Networks}}"
   docker inspect traefik --format "{{range .Config.Cmd}}{{println .}}{{end}}"
   ```
2. Escrever um `docker-compose.yml` (sem chaves de Swarm), com:
   - rede externa `portainer_default` nos serviços expostos por domínio;
   - rede interna própria (`internal`) pra banco/storage não expostos;
   - labels de Traefik seguindo o template da seção 3, com prefixo único do projeto;
   - `restart: unless-stopped` em vez de `deploy.restart_policy`;
   - `mem_limit`/`cpus` em vez de `deploy.resources.limits`.
3. Decidir banco vazio (novo) vs. dump restaurado (migração — seção 5.2).
4. Gerar segredos novos pra essa instância (nunca reaproveitar de outro servidor/projeto).
5. Apontar o DNS do domínio do projeto pro IP desta VPS antes do deploy (senão o
   Let's Encrypt não emite certificado).
6. Deploy pelo Portainer (Stacks → Add stack → colar o compose → definir envs →
   Deploy) e validar com `docker ps` (todos os serviços de longa duração devem ficar
   `Up`; jobs de inicialização tipo "createbuckets" saem `Exited (0)` — normal).

## 7. Exemplo de referência real

O deploy da segunda instância do "Central de Relacionamento Comunitário"
(`campanha.elobase.tech`) nesta mesma VPS segue exatamente este padrão — ver
`stack-elobase.yml` na raiz deste repositório como modelo completo e funcional
(banco novo/vazio, sem dump, já que era um cliente/campanha novo). Pra um próximo
projeto que precise de dump (seção 5.2), adaptar esse mesmo arquivo trocando só
nomes de serviço/domínio/rede e adicionando o passo de `pg_restore` antes do primeiro
boot do app.
