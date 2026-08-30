import { addDays, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  User, Unidade, Patient, Room, Appointment, SessionPackage, PatientPackage,
  FinancialTransaction, Commission, Evolution, ConsentTerm, NpsSurvey,
  RecurrenceRule, WaLog, AuditEntry,
} from './types';

const d = (offset: number) =>
  format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), offset), 'yyyy-MM-dd', { locale: ptBR });

export const seedUsers: User[] = [
  { id: 'u1', nome: 'Dra. Helena Duarte', email: 'helena@coracao.app', role: 'admin', registro: 'CREFITO 48.213-F', cor: '#4fd1a5', ativo: true },
  { id: 'u2', nome: 'Dr. Caio Monteiro', email: 'caio@coracao.app', role: 'fisio', registro: 'CREFITO 61.004-F', cor: '#f2b441', ativo: true },
  { id: 'u3', nome: 'Dra. Bianca Salles', email: 'bianca@coracao.app', role: 'fisio', registro: 'CREFITO 57.882-F', cor: '#6ec1e4', ativo: true },
  { id: 'u4', nome: 'Rafael Nogueira', email: 'rafael@coracao.app', role: 'recep', registro: 'Recepção', cor: '#9ab8c9', ativo: true },
];

export const seedUnidades: Unidade[] = [
  { id: 'un1', nome: 'Sede — Centro', endereco: 'Av. Brasil, 1200 · Belo Horizonte/MG' },
  { id: 'un2', nome: 'Unidade Savassi', endereco: 'R. Pernambuco, 880 · Belo Horizonte/MG' },
];

export const seedRooms: Room[] = [
  { id: 'r1', nome: 'Sala 1 — Cinesioterapia', tipo: 'sala', unidadeId: 'un1' },
  { id: 'r2', nome: 'Sala 2 — Eletroterapia', tipo: 'sala', unidadeId: 'un1' },
  { id: 'r3', nome: 'Sala 3 — RPG / Pilates', tipo: 'sala', unidadeId: 'un1' },
  { id: 'r4', nome: 'Mesa de Tração', tipo: 'equipamento', unidadeId: 'un1' },
  { id: 'r5', nome: 'Ondas de Choque', tipo: 'equipamento', unidadeId: 'un2' },
  { id: 'r6', nome: 'Sala 4 — Cinesioterapia', tipo: 'sala', unidadeId: 'un2' },
  { id: 'r7', nome: 'Sala 5 — Pilates', tipo: 'sala', unidadeId: 'un2' },
];

export const seedPatients: Patient[] = [
  {
    id: 'p1', nome: 'Mariana Castro', nascimento: '1990-04-12', telefone: '(31) 98811-2233',
    email: 'mariana.castro@mail.com', cpf: '123.456.789-09', convenio: 'Unimed',
    queixaPrincipal: 'Dor lombar crônica com irradiação p/ membro inferior direito',
    cid10: ['M54.5'], funilStage: 'tratamento', status: 'ativo', ultimaVisita: d(-2),
    createdAt: '2025-11-03', optInWhats: true,
    anamnese: { historia: 'Dor lombar há 2 anos, piora ao ficar sentada por longos períodos.', cirurgias: 'Apendicectomia (2015).', medicamentos: 'Ibuprofeno em crise.', alergias: 'Penicilina.', objetivo: 'Retomar corrida de rua sem dor.' },
  },
  {
    id: 'p2', nome: 'João Pedro Almeida', nascimento: '1985-09-27', telefone: '(31) 99122-4455',
    email: 'jp.almeida@mail.com', cpf: '987.654.321-00', convenio: null,
    queixaPrincipal: 'Pós-operatório de LCA — 8ª semana',
    cid10: ['S83.5'], funilStage: 'tratamento', status: 'ativo', ultimaVisita: d(-1),
    createdAt: '2025-10-15', optInWhats: true,
    anamnese: { historia: 'Reconstrução de LCA em joelho direito, 8 semanas de PO.', cirurgias: 'Reconstrução LCA (recente).', medicamentos: 'Nenhum.', alergias: 'Nenhuma conhecida.', objetivo: 'Retorno ao futebol amador em 4 meses.' },
  },
  {
    id: 'p3', nome: 'Teresa Oliveira', nascimento: '1958-01-30', telefone: '(31) 99333-6677',
    email: 'teresa.oliveira@mail.com', cpf: '456.789.123-45', convenio: 'Bradesco Saúde',
    queixaPrincipal: 'Gonartrose bilateral — dor e rigidez matinal',
    cid10: ['M17.1'], funilStage: 'tratamento', status: 'ativo', ultimaVisita: d(-4),
    createdAt: '2025-09-20', optInWhats: false,
    anamnese: { historia: 'Artrose de joelhos diagnosticada há 5 anos, piora ao subir escadas.', cirurgias: 'Histerectomia (2010).', medicamentos: 'Losartana, Metformina.', alergias: 'AAS.', objetivo: 'Reduzir dor para caminhar 30 min/dia.' },
  },
  {
    id: 'p4', nome: 'Lucas Ferreira', nascimento: '1996-07-19', telefone: '(31) 98444-8899',
    email: 'lucas.ferreira@mail.com', cpf: '321.654.987-78', convenio: null,
    queixaPrincipal: 'Cervicalgia por postura em home office',
    cid10: ['M54.2'], funilStage: 'avaliacao', status: 'ativo', ultimaVisita: d(-6),
    createdAt: '2025-12-01', optInWhats: true,
    anamnese: { historia: 'Dor cervical há 6 meses, formigamento ocasional em MSD.', cirurgias: 'Nenhuma.', medicamentos: 'Nenhum.', alergias: 'Nenhuma.', objetivo: 'Avaliação e plano para dor postural.' },
  },
  {
    id: 'p5', nome: 'Beatriz Rocha', nascimento: '1992-11-05', telefone: '(31) 99555-1122',
    email: 'bia.rocha@mail.com', cpf: '654.321.987-12', convenio: 'Amil',
    queixaPrincipal: 'Fasciite plantar — dor aos primeiros passos',
    cid10: ['M72.2'], funilStage: 'lead', status: 'ativo', ultimaVisita: null,
    createdAt: format(addDays(new Date(), -3), 'yyyy-MM-dd'), optInWhats: true,
    anamnese: { historia: 'Aguardando primeira avaliação.', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' },
  },
  {
    id: 'p6', nome: 'Antônio Souza', nascimento: '1950-03-22', telefone: '(31) 99666-3344',
    email: 'antonio.souza@mail.com', cpf: '147.258.369-96', convenio: null,
    queixaPrincipal: 'Reabilitação pós-AVC — hemiparesia esquerda',
    cid10: ['I69.4'], funilStage: 'tratamento', status: 'ativo', ultimaVisita: d(-3),
    createdAt: '2025-08-10', optInWhats: true,
    anamnese: { historia: 'AVC isquêmico há 6 meses, sequela motora à esquerda.', cirurgias: 'Nenhuma.', medicamentos: 'Anticoagulante, Estatina.', alergias: 'Nenhuma.', objetivo: 'Recuperar marcha independente.' },
  },
  {
    id: 'p7', nome: 'Camila Mendes', nascimento: '1999-05-14', telefone: '(31) 98777-5566',
    email: 'camila.mendes@mail.com', cpf: '258.369.147-85', convenio: 'Unimed',
    queixaPrincipal: 'Alta concluída — síndrome do impacto (ombro)',
    cid10: ['M75.4'], funilStage: 'alta', status: 'alta', ultimaVisita: '2025-11-28',
    createdAt: '2025-07-01', optInWhats: true,
    anamnese: { historia: 'Impacto subacromial tratado com sucesso em 16 sessões.', cirurgias: 'Nenhuma.', medicamentos: 'Nenhum.', alergias: 'Látex.', objetivo: 'Alta funcional alcançada.' },
  },
  {
    id: 'p8', nome: 'Roberto Lima', nascimento: '1978-12-08', telefone: '(31) 99888-7788',
    email: 'roberto.lima@mail.com', cpf: '369.147.258-74', convenio: null,
    queixaPrincipal: 'Tratamento interrompido — dor no quadril',
    cid10: ['M25.5'], funilStage: 'tratamento', status: 'inativo', ultimaVisita: '2025-10-05',
    createdAt: '2025-08-25', optInWhats: true,
    anamnese: { historia: 'Iniciou protocolo, ausente há mais de 60 dias.', cirurgias: '', medicamentos: '', alergias: '', objetivo: 'Reativar tratamento.' },
  },
];

export const seedPackages: SessionPackage[] = [
  { id: 'pk1', nome: 'Pacote 10 sessões — Cinesioterapia', sessoes: 10, preco: 120000, validadeDias: 90 },
  { id: 'pk2', nome: 'Pacote 5 sessões — Eletroterapia', sessoes: 5, preco: 70000, validadeDias: 60 },
  { id: 'pk3', nome: 'Pacote 16 sessões — RPG', sessoes: 16, preco: 240000, validadeDias: 120 },
];

export const seedPatientPackages: PatientPackage[] = [
  { id: 'pp1', pacienteId: 'p1', pacoteId: 'pk1', sessoesTotais: 10, sessoesUsadas: 6, compraData: '2025-11-10', valorPago: 120000, status: 'ativo' },
  { id: 'pp2', pacienteId: 'p2', pacoteId: 'pk1', sessoesTotais: 10, sessoesUsadas: 8, compraData: '2025-10-20', valorPago: 120000, status: 'ativo' },
  { id: 'pp3', pacienteId: 'p3', pacoteId: 'pk3', sessoesTotais: 16, sessoesUsadas: 4, compraData: '2025-11-25', valorPago: 240000, status: 'ativo' },
];

const av = (
  pacienteId: string, fisioId: string, roomId: string, day: number,
  inicio: string, fim: string, status: Appointment['status'], tipo: string,
  valor: number, pacoteId: string | null = null
): Appointment => {
  const quando = d(day);
  return {
    id: `a${pacienteId}${day}${inicio.replace(':', '')}${roomId}`,
    pacienteId, fisioId, roomId, inicio, fim, status, tipo, valor, pacoteId, serieId: null, notas: '',
    ['da' + 'ta' as 'data']: quando,
  } as Appointment;
};

export const seedAppointments: Appointment[] = [
  // Sede — Centro
  av('p1', 'u2', 'r1', 0, '08:00', '08:50', 'finalizado', 'Cinesioterapia', 12000, 'pp1'),
  av('p6', 'u3', 'r3', 0, '09:00', '09:50', 'finalizado', 'Neurofuncional', 15000),
  av('p3', 'u2', 'r3', 0, '10:00', '10:50', 'finalizado', 'RPG', 15000, 'pp3'),
  av('p2', 'u2', 'r1', 1, '08:00', '08:50', 'finalizado', 'Pós-op LCA', 12000, 'pp2'),
  av('p4', 'u3', 'r2', 1, '11:00', '11:50', 'finalizado', 'Avaliação', 15000),
  av('p1', 'u2', 'r1', 1, '14:00', '14:50', 'finalizado', 'Cinesioterapia', 12000, 'pp1'),
  av('p6', 'u3', 'r3', 2, '09:00', '09:50', 'finalizado', 'Neurofuncional', 15000),
  av('p2', 'u2', 'r4', 2, '10:00', '10:50', 'finalizado', 'Tração', 12000, 'pp2'),
  av('p1', 'u2', 'r1', 3, '08:00', '08:50', 'finalizado', 'Cinesioterapia', 12000, 'pp1'),
  av('p3', 'u2', 'r3', 3, '10:00', '10:50', 'finalizado', 'RPG', 15000, 'pp3'),
  av('p4', 'u3', 'r2', 3, '15:00', '15:50', 'confirmado', 'Eletroterapia', 14000),
  av('p2', 'u2', 'r1', 4, '08:00', '08:50', 'confirmado', 'Pós-op LCA', 12000, 'pp2'),
  av('p6', 'u3', 'r3', 4, '09:00', '09:50', 'confirmado', 'Neurofuncional', 15000),
  av('p1', 'u2', 'r1', 4, '14:00', '14:50', 'agendado', 'Cinesioterapia', 12000, 'pp1'),
  av('p3', 'u2', 'r3', 5, '09:00', '09:50', 'agendado', 'RPG', 15000, 'pp3'),
  // Unidade Savassi
  av('p4', 'u3', 'r6', 3, '16:00', '16:50', 'finalizado', 'Cinesioterapia', 12000),
  av('p6', 'u3', 'r6', 2, '16:00', '16:50', 'finalizado', 'Neurofuncional', 15000),
  av('p5', 'u3', 'r6', 5, '10:00', '10:50', 'agendado', 'Avaliação', 15000),
  av('p8', 'u2', 'r7', 4, '17:00', '17:50', 'faltou', 'Cinesioterapia', 12000),
];

seedAppointments.forEach((a) => {
  if (a.pacienteId === 'p1') a.serieId = 'serie-mariana';
  if (a.pacienteId === 'p2') a.serieId = 'serie-joao';
});

export const seedRecurrence: RecurrenceRule[] = [
  { id: 'serie-mariana', pacienteId: 'p1', fisioId: 'u2', roomId: 'r1', tipo: 'Cinesioterapia', diasSemana: [1, 2, 4, 5], hora: '08:00', duracaoMin: 50, inicio: d(-21), fim: d(35), valor: 12000 },
  { id: 'serie-joao', pacienteId: 'p2', fisioId: 'u2', roomId: 'r1', tipo: 'Pós-op LCA', diasSemana: [2, 3, 5], hora: '08:00', duracaoMin: 50, inicio: d(-28), fim: d(28), valor: 12000 },
];

export const seedTransactions: FinancialTransaction[] = [
  { id: 't1', tipo: 'receber', descricao: 'Pacote 10 sessões — Mariana Castro', categoria: 'Pacotes', valor: 120000, vencimento: d(2), status: 'pago', pacienteId: 'p1', metodo: 'pix' },
  { id: 't2', tipo: 'receber', descricao: 'Sessão avulsa — João Pedro', categoria: 'Sessões', valor: 12000, vencimento: d(4), status: 'pago', pacienteId: 'p2', metodo: 'cartao' },
  { id: 't3', tipo: 'receber', descricao: 'Pacote RPG — Teresa Oliveira', categoria: 'Pacotes', valor: 240000, vencimento: d(7), status: 'pendente', pacienteId: 'p3', metodo: 'boleto' },
  { id: 't4', tipo: 'receber', descricao: 'Avaliação — Lucas Ferreira', categoria: 'Avaliação', valor: 15000, vencimento: d(-3), status: 'atrasado', pacienteId: 'p4', metodo: null },
  { id: 't5', tipo: 'receber', descricao: 'Sessão avulsa — Antônio Souza', categoria: 'Sessões', valor: 15000, vencimento: d(9), status: 'pendente', pacienteId: 'p6', metodo: null },
  { id: 't6', tipo: 'pagar', descricao: 'Aluguel — Sede Centro', categoria: 'Fixo', valor: 450000, vencimento: d(8), status: 'pendente', pacienteId: null, metodo: null },
  { id: 't7', tipo: 'pagar', descricao: 'Energia elétrica (2 unidades)', categoria: 'Fixo', valor: 78000, vencimento: d(-5), status: 'pago', pacienteId: null, metodo: 'boleto' },
  { id: 't8', tipo: 'pagar', descricao: 'Manutenção ondas de choque — Savassi', categoria: 'Manutenção', valor: 35000, vencimento: d(11), status: 'pendente', pacienteId: null, metodo: null },
];

export const seedCommissions: Commission[] = [
  { id: 'c1', fisioId: 'u2', periodo: format(new Date(), 'yyyy-MM'), base: 156000, percentual: 40, status: 'aberto' },
  { id: 'c2', fisioId: 'u3', periodo: format(new Date(), 'yyyy-MM'), base: 119000, percentual: 40, status: 'aberto' },
];

const evo = (pacienteId: string, fisioId: string, day: number, texto: string, anexos: string[] = []): Evolution => ({
  id: `e${pacienteId}${day}`, pacienteId, fisioId, texto, anexos,
  ['da' + 'ta' as 'data']: d(day),
} as Evolution);

export const seedEvolutions: Evolution[] = [
  evo('p1', 'u2', -2, 'Paciente refere redução de 30% da dor (EVA 7→4). Realizado fortalecimento de core e alongamento de isquiotibiais. Boa tolerância.', ['rx-lombar.pdf']),
  evo('p1', 'u2', -9, 'EVA 6. Iniciado protocolo de estabilização segmentar. Sem irradiação para MID nesta semana.'),
  evo('p2', 'u2', -1, '8ª semana PO. Flexão 120°, extensão completa. Progressão de carga em cadeia fechada. Sem derrame articular.', ['ressonancia-joelho.pdf', 'foto-marcha.jpg']),
  evo('p6', 'u3', -3, 'Ganho de controle de tronco. Treino de transferência sentar-deitar com supervisão mínima. Ânimo elevado.'),
  evo('p3', 'u2', -4, 'Rigidez matinal reduzida. Alongamento global e fortalecimento de quadríceps em baixa carga.'),
];

export const seedConsents: ConsentTerm[] = [
  { id: 'ct1', pacienteId: 'p1', nome: 'Termo de Consentimento — Fisioterapia', versao: 'v2.1', assinado: true, dataAssinatura: '2025-11-03', hash: '9f3a…c1d8', ip: '200.147.35.18 (registrado)' },
  { id: 'ct2', pacienteId: 'p2', nome: 'Termo de Consentimento — Pós-operatório', versao: 'v2.1', assinado: true, dataAssinatura: '2025-10-15', hash: 'b7e2…90af', ip: '200.147.35.18 (registrado)' },
  { id: 'ct3', pacienteId: 'p4', nome: 'Termo de Consentimento — Fisioterapia', versao: 'v2.1', assinado: false, dataAssinatura: null, hash: null },
];

const nps = (id: string, pacienteId: string, nota: number | null, comentario: string, dayOffset: number | string): NpsSurvey => ({
  id, pacienteId, nota, comentario,
  ['da' + 'ta' as 'data']: typeof dayOffset === 'string' ? dayOffset : d(dayOffset),
} as NpsSurvey);

export const seedNps: NpsSurvey[] = [
  nps('n1', 'p1', 9, 'Atendimento excelente, agenda sempre pontual.', -2),
  nps('n2', 'p2', 10, 'Evolução muito clara a cada sessão.', -1),
  nps('n3', 'p6', 9, '', -3),
  nps('n4', 'p3', 8, 'Gostaria de mais horários pela manhã.', -4),
  nps('n5', 'p7', 10, 'Alta com resultado completo. Recomendo!', '2025-11-28'),
];

export const seedWaLogs: WaLog[] = [
  { id: 'w1', pacienteId: 'p1', template: 'confirmacao', mensagem: 'Olá, Mariana! Sua sessão de Cinesioterapia está marcada para amanhã às 08:00. Responda SIM para confirmar. 💚', enviadoEm: new Date(Date.now() - 3 * 3600e3).toISOString(), status: 'lido' },
  { id: 'w2', pacienteId: 'p2', template: 'nps', mensagem: 'Olá, João! Como você avalia seu atendimento de ontem? Responda de 0 a 10.', enviadoEm: new Date(Date.now() - 26 * 3600e3).toISOString(), status: 'entregue' },
  { id: 'w3', pacienteId: 'p4', template: 'confirmacao', mensagem: 'Olá, Lucas! Sua sessão de Eletroterapia está marcada para quinta às 15:00. Responda SIM para confirmar. 💚', enviadoEm: new Date(Date.now() - 5 * 3600e3).toISOString(), status: 'enviado' },
];

export const seedAudit: AuditEntry[] = [
  { id: 'log1', ts: new Date(Date.now() - 2 * 3600e3).toISOString(), usuarioId: 'u1', acao: 'LOGIN', detalhe: 'Autenticação JWT + refresh token emitido' },
  { id: 'log2', ts: new Date(Date.now() - 26 * 3600e3).toISOString(), usuarioId: 'u2', acao: 'ASSINATURA_TERMO', detalhe: 'Termo v2.1 — Mariana Castro (hash 9f3a…c1d8)' },
  { id: 'log3', ts: new Date(Date.now() - 3 * 86400e3).toISOString(), usuarioId: 'u1', acao: 'EXPORTACAO_LGPD', detalhe: 'Portabilidade completa — João Pedro Almeida' },
  { id: 'log4', ts: new Date(Date.now() - 5 * 86400e3).toISOString(), usuarioId: 'u1', acao: 'FECHAMENTO_REPASSE', detalhe: 'Competência anterior — 2 comissões geradas' },
];
