#!/usr/bin/env node

/**
 * Script de Seed Administrativo - MedicsPro/CRM Fisioterapia
 * 
 * USO: Executar APENAS em ambiente seguro (servidor/backend)
 * NUNCA executar no browser ou expor SERVICE_ROLE_KEY
 * 
 * Pré-requisitos:
 * - Variáveis de ambiente configuradas:
 *   SUPABASE_URL=https://supabase.medicspro.com.br
 *   SUPABASE_SERVICE_ROLE_KEY=<chave_service_role>
 * 
 * Execução:
 *   node scripts/seed-admin.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: Variáveis de ambiente não configuradas');
  console.error('Execute:');
  console.error('  export SUPABASE_URL=https://supabase.medicspro.com.br');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY=<sua_chave>');
  process.exit(1);
}

// Cliente administrativo (ignora RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function seed() {
  console.log('🚀 Iniciando seed administrativo...\n');

  try {
    // 1. Criar clínica principal
    console.log('📋 Criando clínica principal...');
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .insert({
        name: 'Clínica Fisioterapia Principal',
        email: 'contato@medicspro.com.br',
        phone: '+55 11 99999-9999',
        timezone: 'America/Sao_Paulo',
        active: true,
      })
      .select()
      .single();

    if (clinicError) {
      if (clinicError.code === '23505') {
        console.log('⚠️  Clínica já existe, buscando...');
        const { data: existing } = await supabaseAdmin
          .from('clinics')
          .select('*')
          .eq('name', 'Clínica Fisioterapia Principal')
          .single();
        clinic = existing;
      } else {
        throw clinicError;
      }
    }

    console.log(`✅ Clínica criada: ${clinic.name} (ID: ${clinic.id})\n`);

    // 2. Criar usuário admin via Auth API
    console.log('👤 Criando usuário administrador...');
    const adminEmail = 'admin@medicspro.com.br';
    const adminPassword = 'Mud@r123!'; // Trocar no primeiro login
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        clinic_id: clinic.id,
        role: 'admin',
        full_name: 'Administrador Principal',
      },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('⚠️  Usuário admin já existe');
        const { data: existingUser } = await supabaseAdmin.auth.signInWithPassword({
          email: adminEmail,
          password: adminPassword,
        });
        authData = { user: existingUser.user };
      } else {
        throw authError;
      }
    }

    const userId = authData.user.id;
    console.log(`✅ Admin criado: ${adminEmail} (ID: ${userId})\n`);

    // 3. Criar profile vinculado
    console.log('📝 Criando profile do administrador...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        clinic_id: clinic.id,
        email: adminEmail,
        full_name: 'Administrador Principal',
        role: 'admin',
        crefito: null,
        active: true,
      });

    if (profileError) {
      console.warn('⚠️  Profile pode já existir:', profileError.message);
    } else {
      console.log('✅ Profile criado com sucesso\n');
    }

    // 4. Criar profissionais de exemplo
    console.log('👨‍⚕️  Criando profissionais de exemplo...');
    const profissionais = [
      {
        email: 'fisio1@medicspro.com.br',
        full_name: 'Dr. João Silva',
        crefito: 'CREFITO-3/12345-F',
        role: 'fisioterapeuta',
        specialities: ['Ortopedia', 'Esportiva'],
      },
      {
        email: 'fisio2@medicspro.com.br',
        full_name: 'Dra. Maria Santos',
        crefito: 'CREFITO-3/67890-F',
        role: 'fisioterapeuta',
        specialities: ['Neurologia', 'Respiratória'],
      },
      {
        email: 'recepcao@medicspro.com.br',
        full_name: 'Ana Oliveira',
        crefito: null,
        role: 'recepcao',
        specialities: [],
      },
    ];

    for (const prof of profissionais) {
      const { data: profAuth } = await supabaseAdmin.auth.admin.createUser({
        email: prof.email,
        password: 'Mud@r123!',
        email_confirm: true,
        user_metadata: {
          clinic_id: clinic.id,
          role: prof.role,
          full_name: prof.full_name,
        },
      });

      if (profAuth?.user) {
        await supabaseAdmin
          .from('profiles')
          .upsert({
            id: profAuth.user.id,
            clinic_id: clinic.id,
            email: prof.email,
            full_name: prof.full_name,
            role: prof.role,
            crefito: prof.crefito,
            specialities: prof.specialities,
            active: true,
          });
        
        console.log(`  ✅ ${prof.full_name} (${prof.email})`);
      }
    }

    console.log('\n✅ Profissionais criados\n');

    // 5. Criar pacientes de exemplo
    console.log('🧑‍🦽 Criando pacientes de exemplo...');
    const pacientes = [
      {
        name: 'Carlos Eduardo Pereira',
        email: 'carlos.paciente@email.com',
        phone: '+55 11 98888-7777',
        birth_date: '1985-03-15',
        cpf: '123.456.789-00',
        gender: 'masculino',
        blood_type: 'O+',
        emergency_contact: 'Maria Pereira - +55 11 97777-6666',
        anamnesis: {
          historia: 'Paciente relata dor lombar crônica há 2 anos',
          cirurgias: ['Apendicectomia em 2010'],
          medicamentos: ['Dipirona 500mg SOS'],
          alergias: ['Penicilina'],
          objetivo: 'Reduzir dor e melhorar mobilidade',
        },
        cid10_codes: ['M54.5'],
      },
      {
        name: 'Fernanda Costa Lima',
        email: 'fernanda.paciente@email.com',
        phone: '+55 11 96666-5555',
        birth_date: '1990-07-22',
        cpf: '987.654.321-00',
        gender: 'feminino',
        blood_type: 'A+',
        emergency_contact: 'Roberto Lima - +55 11 95555-4444',
        anamnesis: {
          historia: 'Lesão no joelho direito durante prática esportiva',
          cirurgias: [],
          medicamentos: [],
          alergias: [],
          objetivo: 'Retornar às atividades esportivas',
        },
        cid10_codes: ['S83.5'],
      },
    ];

    for (const paciente of pacientes) {
      const { data: insertedPatient, error: patientError } = await supabaseAdmin
        .from('patients')
        .insert({
          clinic_id: clinic.id,
          ...paciente,
          status: 'ativo',
        })
        .select()
        .single();

      if (patientError) {
        console.warn(`  ⚠️  Erro ao criar paciente ${paciente.name}:`, patientError.message);
      } else {
        console.log(`  ✅ ${paciente.name} (ID: ${insertedPatient.id})`);
      }
    }

    console.log('\n✅ Pacientes criados\n');

    // 6. Criar agendamentos de exemplo
    console.log('📅 Criando agendamentos de exemplo...');
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    // Buscar IDs dos profiles criados
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('clinic_id', clinic.id);

    const fisioProfile = profiles?.find(p => p.role === 'fisioterapeuta');
    const { data: patients } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('clinic_id', clinic.id)
      .limit(2);

    if (fisioProfile && patients && patients.length > 0) {
      const appointments = [
        {
          clinic_id: clinic.id,
          patient_id: patients[0].id,
          professional_id: fisioProfile.id,
          start_time: amanha.toISOString().replace('T00:00:00.000Z', 'T09:00:00.000Z'),
          end_time: amanha.toISOString().replace('T00:00:00.000Z', 'T10:00:00.000Z'),
          type: 'avaliacao',
          status: 'agendado',
          notes: 'Primeira avaliação - Dor lombar',
        },
        {
          clinic_id: clinic.id,
          patient_id: patients[1]?.id || patients[0].id,
          professional_id: fisioProfile.id,
          start_time: amanha.toISOString().replace('T00:00:00.000Z', 'T14:00:00.000Z'),
          end_time: amanha.toISOString().replace('T00:00:00.000Z', 'T15:00:00.000Z'),
          type: 'sessao',
          status: 'agendado',
          notes: 'Sessão de acompanhamento - Joelho',
        },
      ];

      for (const apto of appointments) {
        const { data: insertedApto, error: aptoError } = await supabaseAdmin
          .from('appointments')
          .insert(apto)
          .select()
          .single();

        if (aptoError) {
          console.warn(`  ⚠️  Erro ao criar agendamento:`, aptoError.message);
        } else {
          console.log(`  ✅ Agendamento: ${apto.start_time} - ${apto.type}`);
        }
      }
    }

    console.log('\n✅ Agendamentos criados\n');

    // Resumo final
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 SEED COMPLETADO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════');
    console.log(`🏢 Clínica: ${clinic.name}`);
    console.log(`👤 Admin: ${adminEmail}`);
    console.log(`🔑 Senha temporária: Mud@r123!`);
    console.log(`👨‍⚕️  Profissionais: ${profissionais.length} criados`);
    console.log(`🧑‍🦽 Pacientes: ${pacientes.length} criados`);
    console.log(`📅 Agendamentos: Exemplo criados`);
    console.log('\n⚠️  IMPORTANTE:');
    console.log('  - Troque todas as senhas no primeiro login');
    console.log('  - Nunca exponha SERVICE_ROLE_KEY no frontend');
    console.log('  - Este script deve rodar apenas em ambiente seguro');
    console.log('═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ ERRO CRÍTICO:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seed();
