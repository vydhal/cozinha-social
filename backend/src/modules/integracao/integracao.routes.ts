import type { FastifyInstance } from 'fastify'
import { prisma } from '../../shared/prisma.js'

// Protege o endpoint por API key via variável de ambiente INTEGRATION_API_KEY.
// Se a variável não estiver definida, o endpoint é desabilitado.
export async function integracaoRoutes(fastify: FastifyInstance) {
  fastify.get('/pessoa/:cpf', async (request, reply) => {
    const apiKey = process.env.INTEGRATION_API_KEY
    if (!apiKey) {
      return reply.code(503).send({ error: 'Integração não configurada neste servidor.' })
    }

    const headerKey = (request.headers['x-integration-key'] as string | undefined) ?? ''
    if (headerKey !== apiKey) {
      return reply.code(401).send({ error: 'Chave de integração inválida.' })
    }

    const { cpf } = request.params as { cpf: string }
    const cpfNormalizado = cpf.replace(/\D/g, '')

    const beneficiario = await prisma.beneficiario.findFirst({
      where: {
        deletadoEm: null,
        OR: [
          { cpf: cpf },
          { cpf: cpfNormalizado },
          { cpf: { contains: cpfNormalizado } },
        ],
      },
      include: {
        retiradas: {
          where: { status: 'ENTREGUE' },
          orderBy: { horario: 'desc' },
          take: 10,
          select: {
            id: true,
            quantidade: true,
            metodoRetirada: true,
            data: true,
            horario: true,
            operador: { select: { nome: true } },
          },
        },
        familia: {
          include: { membros: { where: { deletadoEm: null }, select: { nome: true, cpf: true } } },
        },
      },
    })

    if (!beneficiario) {
      return reply.send({
        sistema: 'mesa-do-bem',
        sistemaLabel: process.env.NOME_COZINHA ?? 'Cozinha Solidária',
        cpfConsultado: cpf,
        pessoaEncontrada: false,
      })
    }

    const totalRetiradas = await prisma.retirada.count({
      where: { beneficiarioId: beneficiario.id, status: 'ENTREGUE' },
    })

    const totalQuentinhas = await prisma.retirada.aggregate({
      where: { beneficiarioId: beneficiario.id, status: 'ENTREGUE' },
      _sum: { quantidade: true },
    })

    const baseUrl = process.env.PUBLIC_URL ?? 'https://cozinha.simplisoft.com.br'

    const eventos = beneficiario.retiradas.map(r => ({
      id: r.id,
      tipo: 'RETIRADA' as const,
      data: r.horario,
      descricao: `Retirada de ${r.quantidade} quentinha${r.quantidade > 1 ? 's' : ''} — ${(r as any).metodoRetirada === 'FACIAL' ? 'Facial' : 'Manual'}`,
      detalhes: {
        quantidade: r.quantidade,
        metodo: (r as any).metodoRetirada ?? 'MANUAL',
        operador: r.operador.nome,
      },
    }))

    return reply.send({
      sistema: 'mesa-do-bem',
      sistemaLabel: process.env.NOME_COZINHA ?? 'Cozinha Solidária',
      cpfConsultado: cpf,
      pessoaEncontrada: true,
      pessoa: {
        nome: beneficiario.nome,
        cpf: beneficiario.cpf,
        nascimento: beneficiario.nascimento,
        telefone: beneficiario.telefone,
        bairro: beneficiario.bairro,
        cidade: beneficiario.cidade,
        status: beneficiario.status,
        fotoUrl: beneficiario.fotoUrl ? `${baseUrl}${beneficiario.fotoUrl}` : null,
        profileUrl: `${baseUrl}/beneficiarios/${beneficiario.id}`,
      },
      resumo: {
        totalRetiradas,
        totalQuentinhas: totalQuentinhas._sum.quantidade ?? 0,
        ultimaRetirada: beneficiario.retiradas[0]?.data ?? null,
        quentinhasAutorizadasPorDia: beneficiario.quentinhasAutorizadas,
        pessoasCasa: beneficiario.pessoasCasa,
        biometriaRegistrada: beneficiario.biometriaStatus === 'VERIFICADA',
        membrosDaFamilia: beneficiario.familia?.membros.length ?? 1,
      },
      eventos,
    })
  })
}
