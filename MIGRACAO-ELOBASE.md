# Migração — Mesa do Bem → VPS elobase (`cozinha.elobase.tech`)

Migra o projeto **e os dados atuais** (banco + fotos/documentos) do servidor Swarm
(`cozinha.simplisoft.com.br`) para a VPS elobase, seguindo `ARQUITETURA-SERVIDOR-ELOBASE.md`.

Arquivos desta migração:
- `stack-cozinha-elobase.yml` — a stack (compose, sem Swarm) para o Portainer do elobase.
- `.env.cozinha-elobase.example` — variáveis a definir no Portainer (gerar **segredos novos**).

O que é resgatado: **banco `mesadobem`** + **volume `mesa_uploads`** (fotos e documentos dos
beneficiários — sem ele, as imagens quebram).

> Nomes de container variam. Sempre descubra com `docker ps` / `docker volume ls` em vez de supor.
> No servidor Swarm de origem, rode no nó **manager** (onde o banco está fixado).

---

## 0. Pré-requisitos (antes de tudo)

1. **DNS**: apontar `cozinha.elobase.tech` (registro A) para o IP da VPS elobase.
   Sem isso o Let's Encrypt não emite o certificado. Confirme a propagação:
   `nslookup cozinha.elobase.tech`
2. **Imagens no Docker Hub**: confirmar que existem as três tags que a stack usa
   (`vydhal/mesa-do-bem-{backend,frontend,face-service}:1.1.0`). O backend e o frontend
   já estão em `1.1.0`. Se o **face-service** ainda não estiver, gere e publique:
   `.\build.ps1 1.1.0` → opção **[3] Apenas Face Service**.
   (Ou ajuste `FACE_TAG` no `.env` para a tag que existir.)
3. **Segredos novos**: gerar `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
   `INTEGRATION_API_KEY` — `openssl rand -hex 32` para cada.

---

## 1. Resgatar os dados (no servidor de ORIGEM — Swarm simplisoft)

### 1a. Dump do banco

```bash
# achar o container do Postgres (roda no nó manager)
docker ps --filter name=mesa-db --format '{{.Names}}'

# dump em formato custom (comprimido, restaurável seletivamente)
docker exec <container-postgres> pg_dump -U mesadobem -Fc -d mesadobem -f /tmp/mesadobem.dump
docker cp <container-postgres>:/tmp/mesadobem.dump ./mesadobem.dump
```

### 1b. Backup do volume de uploads (fotos/documentos)

```bash
# achar o nome real do volume (costuma ter prefixo da stack, ex.: mesa_mesa_uploads)
docker volume ls | grep uploads

# empacotar o conteúdo do volume num .tar.gz
docker run --rm -v <volume-uploads>:/data -v "$PWD":/backup alpine \
  tar czf /backup/mesa_uploads.tar.gz -C /data .
```

Agora você tem `mesadobem.dump` e `mesa_uploads.tar.gz` na origem.

### 1c. Transferir para a VPS elobase

```bash
scp ./mesadobem.dump ./mesa_uploads.tar.gz <usuario>@<IP_ELOBASE>:/root/
```

---

## 2. Subir a stack no elobase (Portainer)

1. Portainer → **Stacks → Add stack**.
2. Colar o conteúdo de `stack-cozinha-elobase.yml`.
3. Em **Environment variables**, preencher conforme `.env.cozinha-elobase.example`
   (com os segredos novos).
4. **Deploy the stack.**

Nesse primeiro boot o banco sobe **vazio** e o serviço `migrate` cria o schema + o superadmin
provisório. Isso é esperado — no passo 3 o dump de produção é restaurado **por cima**, trazendo
os dados e o superadmin reais (com a senha atual de produção).

> Ninguém está usando `cozinha.elobase.tech` ainda, então essa janela de "banco vazio" é inofensiva.

Confira que os containers subiram: `docker ps` (backend, frontend, face-service, mesa-db `Up`;
`migrate` sai como `Exited (0)` — normal, é job de uma vez).

---

## 3. Restaurar o banco (no elobase)

```bash
# achar os containers (nomes no padrão compose, ex.: cozinha_mesa-db_1 / cozinha_backend_1)
docker ps --filter name=mesa-db --format '{{.Names}}'
docker ps --filter name=backend --format '{{.Names}}'

# PARAR o backend antes do restore: senão a conexão dele segura locks e o --clean
# (que precisa dropar as tabelas) trava.
docker stop <container-backend>

# copiar o dump para dentro do container do banco
docker cp /root/mesadobem.dump <container-postgres-novo>:/tmp/mesadobem.dump

# restaurar — --clean --if-exists derruba o schema provisório e recria com os dados reais
docker exec <container-postgres-novo> \
  pg_restore -U mesadobem -d mesadobem --clean --if-exists --no-owner /tmp/mesadobem.dump

# religar o backend
docker start <container-backend>
```

Avisos "does not exist, skipping" são **normais** (efeito do `--if-exists` sobre o schema vazio).

### 3a. Reconciliar o schema com a versão das imagens

Garante que o banco restaurado tem exatamente o schema que o backend 1.1.0 espera
(evita 500 por coluna faltando):

```bash
docker exec <container-backend> npx prisma db push
```

---

## 4. Restaurar os uploads (no elobase)

```bash
# achar o novo volume de uploads (ex.: cozinha_mesa_uploads)
docker volume ls | grep uploads

# extrair o backup dentro do volume novo
docker run --rm -v <volume-uploads-novo>:/data -v /root:/backup alpine \
  sh -c "cd /data && tar xzf /backup/mesa_uploads.tar.gz"
```

---

## 5. Reiniciar app e validar

```bash
docker restart <container-backend> <container-frontend>
```

- `curl -I https://cozinha.elobase.tech` → deve responder 200/301 com TLS válido.
- Abrir a aplicação, **logar com o superadmin de produção** (mesma senha de antes — veio no dump).
- Conferir: lista de beneficiários com as **fotos** aparecendo, relatórios com o histórico,
  biometria funcionando.

---

## 6. Corte final (cut-over)

- Só depois de validar tudo no elobase, comunicar a equipe para usar `cozinha.elobase.tech`.
- Manter o servidor antigo **de pé e intacto** por alguns dias como rollback, até ter certeza.
- Se registrarem retiradas no servidor antigo durante a validação, refazer o dump/restore
  (passos 1a e 3) para não perder esses lançamentos — por isso o corte deve ser rápido e combinado.

---

## Alternativa (mais estrita): restaurar antes do app subir

Se preferir seguir à risca a seção 5.2 da arquitetura (restaurar **antes** de qualquer boot do
app), em vez do Portainer use o shell do elobase com o próprio compose:

```bash
# com o stack-cozinha-elobase.yml e o .env no diretório atual
docker compose -f stack-cozinha-elobase.yml up -d mesa-db     # só o banco
# ... restaurar o dump (passo 3, sem o --clean, pois o banco está limpo) ...
docker compose -f stack-cozinha-elobase.yml up -d             # sobe o resto
```

Funciona igual; é só uma questão de preferência (Portainer vs. shell). Para a maioria dos casos,
o fluxo dos passos 2→5 (Portainer + restore por cima) é mais simples e igualmente seguro.
