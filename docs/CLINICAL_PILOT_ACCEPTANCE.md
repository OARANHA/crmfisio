# MedicsPro — Clinical Pilot Acceptance

Checklist canônico para validar o fluxo de atendimento com um fisioterapeuta real sem criar caminhos paralelos.

## Estado técnico

O fluxo está apto para piloto controlado porque os boundaries críticos são server-side:

- somente o fisioterapeuta atribuído pode iniciar/finalizar a própria sessão;
- no máximo uma sessão `em_atendimento` por profissional e por paciente;
- nova evolução autenticada exige `session_id` de atendimento ativo e vínculo exato de clínica/paciente/profissional;
- vínculo de evolução é imutável após criação;
- `em_atendimento -> finalizado` exige evolução ativa da mesma sessão e do mesmo autor;
- leitura clínica do fisioterapeuta exige relação assistencial; cadastro operacional do paciente continua tenant-wide;
- owner/admin têm leitura administrativa, mas não recebem autoria clínica implícita.

## Roteiro vivo recomendado

Use uma sessão de teste real/controlada de um fisioterapeuta.

1. Entrar como fisioterapeuta responsável.
2. Abrir o dashboard ou `/hoje`.
3. Iniciar a própria sessão.
4. Confirmar que o fluxo leva ao paciente/sessão correta no workspace clínico.
5. Confirmar que a sessão aparece `em_atendimento` e pré-selecionada para evolução quando aberta via deep link.
6. Tentar finalizar sem evolução: o banco deve negar.
7. Registrar evolução clínica vinculada à sessão.
8. Finalizar pelo workspace clínico.
9. Confirmar status `finalizado`, vínculo da evolução e atualização dos efeitos de agenda/financeiro/pacote.
10. Entrar como outro fisioterapeuta da mesma clínica: o paciente pode permanecer localizável operacionalmente, mas o prontuário não deve ser aberto sem relação assistencial e ações clínicas da sessão do colega não devem aparecer.

## Pontos de entrada alinhados

- Dashboard clínico: sessão aponta para `/pacientes/:patientId?session=:appointmentId#clinical-workspace`.
- `/hoje`: somente o profissional responsável inicia/continua e o handoff entra no workspace.
- Agenda completa: ações clínicas de outro profissional são escondidas; sessão em andamento não é finalizada pelo drawer, e sim continuada no prontuário.

## Critério de GREEN

O gate é GREEN para piloto controlado quando os boundaries acima estão instalados/verificados e o CI está verde. O roteiro vivo deve ser repetido no primeiro piloto e após mudanças relevantes em Agenda, ClinicalWorkspace, RLS/RPCs/triggers clínicos ou autoria.
