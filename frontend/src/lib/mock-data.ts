// Mock data for Mesa do Bem
export type Beneficiary = {
  id: string;
  nome: string;
  cpf: string;
  rg: string;
  nascimento: string;
  telefone: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  cep: string;
  pessoasCasa: number;
  quentinhasAutorizadas: number;
  responsavel: boolean;
  observacoes: string;
  status: "ativo" | "pendente" | "bloqueado";
  dataCadastro: string;
  fotoUrl?: string;
  biometriaStatus: "verificada" | "pendente" | "indisponivel";
  familiaId: string;
};

export type Withdrawal = {
  id: string;
  beneficiaryId: string;
  beneficiaryNome: string;
  bairro: string;
  quantidade: number;
  horario: string;
  data: string;
  operador: string;
  status: "entregue" | "duplicado_bloqueado" | "ausente";
};

export type QueueEntry = {
  id: string;
  senha: string;
  beneficiaryId: string;
  nome: string;
  status: "aguardando" | "chamado" | "retirado" | "ausente";
  horaEntrada: string;
};

const bairros = [
  "Centro",
  "Jardim União",
  "Vila Esperança",
  "São Pedro",
  "Boa Vista",
  "Parque das Flores",
  "Santa Luzia",
  "Cidade Nova",
];

const nomes = [
  "Maria Aparecida Silva",
  "João Carlos Ferreira",
  "Ana Beatriz Souza",
  "José Roberto Lima",
  "Francisca das Chagas",
  "Antônio Pereira Santos",
  "Rosa Maria Oliveira",
  "Carlos Eduardo Rocha",
  "Lucia Helena Mendes",
  "Pedro Henrique Alves",
  "Vanessa Cristina Dias",
  "Marcos Antônio Ribeiro",
  "Cleide dos Santos",
  "Sebastião Nogueira",
  "Joana D'Arc Moreira",
  "Raimundo Nonato Costa",
  "Tereza Cristina Barros",
  "Edinaldo Vieira",
  "Sueli Pinheiro",
  "Edson Luís Cardoso",
  "Marta Regina Gomes",
  "Geraldo Magela",
  "Inês Maria da Silva",
  "Wellington Borges",
  "Patrícia Helena",
  "Joaquim Bezerra",
  "Damiana Souza",
  "Edivaldo Rodrigues",
  "Fátima Lopes",
  "Renato Pacheco",
];

function fmtCPF(n: number) {
  const s = String(100000000000 + n).slice(-11);
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}

function fmtCEP(n: number) {
  const s = String(10000000 + n).slice(-8);
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

export const beneficiaries: Beneficiary[] = nomes.map((nome, i) => {
  const familiaIdx = Math.floor(i / 1.6);
  return {
    id: `b-${i + 1}`,
    nome,
    cpf: fmtCPF(i * 7919 + 13),
    rg: `${10 + i}.${String(100 + i).padStart(3, "0")}.${String(200 + i).padStart(3, "0")}-${i % 10}`,
    nascimento: `19${50 + (i % 45)}-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, "0")}`,
    telefone: `(11) 9${String(40000000 + i * 137).slice(-8)}`,
    endereco: ["Rua das Acácias", "Av. Brasil", "Rua São José", "Travessa da Paz", "Rua das Palmeiras"][i % 5],
    numero: String(100 + (i * 7) % 900),
    bairro: bairros[i % bairros.length],
    cidade: "São Paulo",
    cep: fmtCEP(i * 31),
    pessoasCasa: 2 + (i % 6),
    quentinhasAutorizadas: 1 + (i % 4),
    responsavel: i % 1.6 < 1,
    observacoes: i % 4 === 0 ? "Situação de vulnerabilidade. Acompanhamento social ativo." : "",
    status: i % 11 === 0 ? "pendente" : i % 17 === 0 ? "bloqueado" : "ativo",
    dataCadastro: `2024-${String(((i % 12) + 1)).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
    biometriaStatus: i % 5 === 0 ? "pendente" : "verificada",
    familiaId: `fam-${familiaIdx + 1}`,
  };
});

const operadores = ["Camila R.", "Bruno H.", "Aline F.", "Diego M.", "Joana P."];

export const withdrawalsToday: Withdrawal[] = Array.from({ length: 38 }, (_, i) => {
  const b = beneficiaries[i % beneficiaries.length];
  const hour = 11 + Math.floor(i / 10);
  const min = (i * 7) % 60;
  return {
    id: `w-${i + 1}`,
    beneficiaryId: b.id,
    beneficiaryNome: b.nome,
    bairro: b.bairro,
    quantidade: b.quentinhasAutorizadas,
    horario: `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
    data: new Date().toISOString().slice(0, 10),
    operador: operadores[i % operadores.length],
    status: i === 12 ? "duplicado_bloqueado" : i === 22 ? "ausente" : "entregue",
  };
});

export const queueMock: QueueEntry[] = beneficiaries.slice(0, 12).map((b, i) => ({
  id: `q-${i + 1}`,
  senha: String(101 + i),
  beneficiaryId: b.id,
  nome: b.nome,
  status: i < 2 ? "retirado" : i < 4 ? "chamado" : i === 11 ? "ausente" : "aguardando",
  horaEntrada: `10:${String(i * 4).padStart(2, "0")}`,
}));

// Dashboard time-series
export const distribuicaoSemana = [
  { dia: "Seg", entregues: 96, ausentes: 4 },
  { dia: "Ter", entregues: 100, ausentes: 0 },
  { dia: "Qua", entregues: 92, ausentes: 8 },
  { dia: "Qui", entregues: 98, ausentes: 2 },
  { dia: "Sex", entregues: 100, ausentes: 0 },
  { dia: "Sáb", entregues: 87, ausentes: 13 },
];

export const horariosPico = [
  { hora: "10h", qtd: 6 },
  { hora: "11h", qtd: 22 },
  { hora: "12h", qtd: 38 },
  { hora: "13h", qtd: 24 },
  { hora: "14h", qtd: 10 },
];

export const evolucaoMensal = Array.from({ length: 12 }, (_, i) => ({
  mes: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][i],
  total: 1800 + Math.round(Math.sin(i / 1.4) * 350 + i * 30),
}));

export const frequenciaBairro = bairros.map((b, i) => ({
  bairro: b,
  familias: 24 + (i * 5) % 30,
}));

export const familiasFrequentes = [
  { familia: "Família Silva", retiradas: 22 },
  { familia: "Família Ferreira", retiradas: 19 },
  { familia: "Família Souza", retiradas: 17 },
  { familia: "Família Lima", retiradas: 14 },
  { familia: "Família Costa", retiradas: 11 },
];

export const team = [
  { id: "u-1", nome: "Camila Ramos", cargo: "Coordenadora", email: "camila@mesadobem.org", telefone: "(11) 99876-1122", perfil: "admin", ativo: true },
  { id: "u-2", nome: "Bruno Henrique", cargo: "Operador", email: "bruno@mesadobem.org", telefone: "(11) 99311-7788", perfil: "colaborador", ativo: true },
  { id: "u-3", nome: "Aline Ferreira", cargo: "Operadora", email: "aline@mesadobem.org", telefone: "(11) 98234-4501", perfil: "colaborador", ativo: true },
  { id: "u-4", nome: "Diego Mota", cargo: "Voluntário", email: "diego@mesadobem.org", telefone: "(11) 97654-2210", perfil: "colaborador", ativo: false },
  { id: "u-5", nome: "Joana Prado", cargo: "Diretora", email: "joana@mesadobem.org", telefone: "(11) 99000-0001", perfil: "superadmin", ativo: true },
];

export const activityLogs = [
  { id: 1, quando: "há 2 min", quem: "Camila R.", o_que: "Confirmou retirada de Maria Aparecida Silva" },
  { id: 2, quando: "há 7 min", quem: "Bruno H.", o_que: "Cadastrou novo beneficiário (Renato Pacheco)" },
  { id: 3, quando: "há 15 min", quem: "Aline F.", o_que: "Bloqueou tentativa duplicada" },
  { id: 4, quando: "há 32 min", quem: "Diego M.", o_que: "Importou 18 cadastros via CSV" },
  { id: 5, quando: "há 1 h", quem: "Joana P.", o_que: "Alterou limite diário para 100" },
];

export const LIMITE_DIARIO = 100;
