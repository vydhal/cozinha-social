import { PrismaClient, UserRole, BeneficiarioStatus, BiometriaStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Em produção, cria apenas config essencial + superadmin.
// Para incluir dados de demonstração, defina SEED_DEMO_DATA=true.
const isDemoMode = process.env.SEED_DEMO_DATA === 'true'

async function main() {
  console.log('🌱 Iniciando seed...')
  if (!isDemoMode) console.log('   (modo produção: apenas config essencial)')

  // Configuração global — sempre atualiza nome e limite se enviados via env
  await prisma.configuracao.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      nomeCozinha: process.env.NOME_COZINHA ?? 'Cozinha Solidária',
      corPrimaria: '#2f9d6b',
      mensagemBoasVindas: 'Bem-vindo! Aqui há lugar para todos.',
      limiteDiario: parseInt(process.env.LIMITE_DIARIO ?? '100'),
      tempoEsperaMin: 5,
    },
    update: {},
  })
  console.log('✅ Configuração global')

  // Bairros — sempre criados (dados de referência, não demo)
  const bairros = ['Centro', 'Jardim União', 'Vila Nova', 'Bela Vista', 'Morumbi', 'Ipiranga', 'Santo André', 'Lapa']
  for (const nome of bairros) {
    await prisma.bairro.upsert({ where: { nome }, create: { nome }, update: {} })
  }
  console.log('✅ Bairros criados')

  // Superadmin principal — sempre garante que existe
  const senhaAdmin = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'admin@123', 12)
  await prisma.user.upsert({
    where: { email: 'vydhal@gmail.com' },
    create: {
      nome: 'Administrador',
      email: 'vydhal@gmail.com',
      senha: senhaAdmin,
      role: UserRole.SUPERADMIN,
      cargo: 'Superadmin',
      status: 'ATIVO',
    },
    update: { role: UserRole.SUPERADMIN, status: 'ATIVO', senha: senhaAdmin },
  })
  console.log('✅ Superadmin criado')

  if (!isDemoMode) {
    console.log('\n🎉 Seed de produção concluído!')
    return
  }

  // ── DADOS DE DEMONSTRAÇÃO (apenas com SEED_DEMO_DATA=true) ───────────────
  const senha = await bcrypt.hash('123456', 12)

  const demoUsers = [
    { nome: 'Joana Administradora', email: 'joana@mesadobem.org', role: UserRole.SUPERADMIN, cargo: 'Diretora' },
    { nome: 'Camila Rodrigues',     email: 'camila@mesadobem.org', role: UserRole.ADMIN,      cargo: 'Coordenadora' },
    { nome: 'Bruno Henrique',       email: 'bruno@mesadobem.org',  role: UserRole.COLABORADOR, cargo: 'Operador' },
    { nome: 'Maria Silva',          email: 'maria@mesadobem.org',  role: UserRole.COLABORADOR, cargo: 'Voluntária' },
  ]
  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, senha, status: 'ATIVO' },
      update: {},
    })
  }
  console.log('✅ Usuários de demo (senha: 123456)')

  const familiasSeed = [
    { endereco: 'Rua das Flores',      numero: '12',  bairro: 'Centro',       cidade: 'São Paulo', cep: '01001-000' },
    { endereco: 'Av. Principal',       numero: '45',  bairro: 'Jardim União',  cidade: 'São Paulo', cep: '02002-000' },
    { endereco: 'Rua do Bem',          numero: '78',  bairro: 'Vila Nova',     cidade: 'São Paulo', cep: '03003-000' },
    { endereco: 'Travessa Esperança',  numero: '3',   bairro: 'Bela Vista',    cidade: 'São Paulo', cep: '04004-000' },
    { endereco: 'Alameda das Acácias', numero: '101', bairro: 'Morumbi',       cidade: 'São Paulo', cep: '05005-000' },
  ]
  const familias = await Promise.all(
    familiasSeed.map((f) =>
      prisma.familia.upsert({
        where: { endereco_numero_bairro_cep: { endereco: f.endereco, numero: f.numero, bairro: f.bairro, cep: f.cep } },
        create: f,
        update: {},
      }),
    ),
  )
  console.log('✅ Famílias demo')

  const beneficiariosSeed = [
    { nome: 'Ana Maria Santos',     cpf: '123.456.789-01', rg: '12.345.678-9', nascimento: new Date('1974-01-15'), telefone: '(11) 99001-0001', bairro: 'Centro',      pessoasCasa: 4, quentinhasAutorizadas: 2, responsavel: true,  familiaIdx: 0 },
    { nome: 'João Carlos Oliveira', cpf: '234.567.890-12', rg: '23.456.789-0', nascimento: new Date('1965-05-20'), telefone: '(11) 99002-0002', bairro: 'Jardim União', pessoasCasa: 3, quentinhasAutorizadas: 2, responsavel: true,  familiaIdx: 1 },
    { nome: 'Maria Aparecida Lima', cpf: '345.678.901-23', rg: '34.567.890-1', nascimento: new Date('1980-08-10'), telefone: '(11) 99003-0003', bairro: 'Vila Nova',    pessoasCasa: 5, quentinhasAutorizadas: 3, responsavel: true,  familiaIdx: 2 },
    { nome: 'Pedro Henrique Costa', cpf: '456.789.012-34', rg: '45.678.901-2', nascimento: new Date('1990-03-25'), telefone: '(11) 99004-0004', bairro: 'Bela Vista',   pessoasCasa: 2, quentinhasAutorizadas: 1, responsavel: false, familiaIdx: 3 },
    { nome: 'Francisca Bezerra',    cpf: '567.890.123-45', rg: '56.789.012-3', nascimento: new Date('1955-11-30'), telefone: '(11) 99005-0005', bairro: 'Centro',      pessoasCasa: 6, quentinhasAutorizadas: 4, responsavel: true,  familiaIdx: 0 },
    { nome: 'Carlos Eduardo Souza', cpf: '678.901.234-56', rg: '67.890.123-4', nascimento: new Date('1988-07-14'), telefone: '(11) 99006-0006', bairro: 'Morumbi',     pessoasCasa: 3, quentinhasAutorizadas: 2, responsavel: true,  familiaIdx: 4 },
  ]
  for (const b of beneficiariosSeed) {
    const familia = familias[b.familiaIdx]
    await prisma.beneficiario.upsert({
      where: { cpf: b.cpf },
      create: {
        nome: b.nome, cpf: b.cpf, rg: b.rg, nascimento: b.nascimento,
        telefone: b.telefone, bairro: b.bairro, cidade: 'São Paulo', cep: '01000-000',
        endereco: familia.endereco, numero: familia.numero,
        pessoasCasa: b.pessoasCasa, quentinhasAutorizadas: b.quentinhasAutorizadas,
        responsavel: b.responsavel, status: BeneficiarioStatus.ATIVO,
        biometriaStatus: BiometriaStatus.PENDENTE, familiaId: familia.id,
      },
      update: {},
    })
  }
  console.log('✅ Beneficiários demo')

  console.log('\n🎉 Seed de demonstração concluído!')
  console.log('📧 Credenciais de demo:')
  console.log('   Superadmin: joana@mesadobem.org / 123456')
  console.log('   Admin:      camila@mesadobem.org / 123456')
  console.log('   Colaborador: bruno@mesadobem.org / 123456')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
