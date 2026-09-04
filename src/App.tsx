import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './lib/store';
import { Shell } from './components/Shell';
import { DashboardRoleAware } from './pages/DashboardRoleAware';
import { AgendaOperational } from './pages/AgendaOperational';
import { RecepcaoHoje } from './pages/RecepcaoHoje';
import { PatientsRoleAware } from './pages/PatientsRoleAware';
import { PatientEditPage } from './pages/PatientEditPage';
import { CanonicalSoapPage } from './pages/CanonicalSoapPage';
import { NexusPatientHubPage } from './pages/NexusPatientHubPage';
import { NexusPatientPhq9Page } from './pages/NexusPatientPhq9Page';
import { NexusPatientCssrsPage } from './pages/NexusPatientCssrsPage';
import { NexusPatientGad7Page } from './pages/NexusPatientGad7Page';
import { NexusPatientHcl32Page } from './pages/NexusPatientHcl32Page';
import { NexusPatientScalePage } from './pages/NexusPatientScalePage';
import { NexusPatientEemPage } from './pages/NexusPatientEemPage';
import { NexusPatientMeemPage } from './pages/NexusPatientMeemPage';
import { NexusPatientEgfrPage } from './pages/NexusPatientEgfrPage';
import { NexusPatientCardiovascularRiskPage } from './pages/NexusPatientCardiovascularRiskPage';
import { NexusPatientAntidepressantSwitchPage } from './pages/NexusPatientAntidepressantSwitchPage';
import { NexusPatientEvolutionPage } from './pages/NexusPatientEvolutionPage';
import { NexusEvidencePage } from './pages/NexusEvidencePage';
import { NexusEducationPage } from './pages/NexusEducationPage';
import { NexusSelfAssessmentInvitePage } from './pages/NexusSelfAssessmentInvitePage';
import { NexusPublicSelfAssessmentPage } from './pages/NexusPublicSelfAssessmentPage';
import { FinanceiroOperational } from './pages/FinanceiroOperational';
import { CrmOperational } from './pages/CrmOperational';
import { MensagensOperational } from './pages/MensagensOperational';
import { RelatoriosHub } from './pages/RelatoriosHub';
import { ConfigPremium } from './pages/ConfigPremium';

function Home() {
  const { user, canView } = useApp();
  if (!user) return <Navigate to="/" replace />;
  if (user.role === 'recep') return <Navigate to="/dashboard" replace />;
  const first = canView('dashboard') ? '/dashboard' : canView('agenda') ? '/agenda' : canView('pacientes') ? '/pacientes' : '/crm';
  return <Navigate to={first} replace />;
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/autoavaliacao/:token" element={<NexusPublicSelfAssessmentPage />} />
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<DashboardRoleAware />} />
            <Route path="/agenda" element={<AgendaOperational />} />
            <Route path="/hoje" element={<RecepcaoHoje />} />
            <Route path="/pacientes" element={<PatientsRoleAware />} />
            <Route path="/pacientes/:id/editar" element={<PatientEditPage />} />
            <Route path="/pacientes/:id/prontuario" element={<CanonicalSoapPage />} />
            <Route path="/pacientes/:id/nexus" element={<NexusPatientHubPage />} />
            <Route path="/pacientes/:id/nexus/phq9" element={<NexusPatientPhq9Page />} />
            <Route path="/pacientes/:id/nexus/cssrs" element={<NexusPatientCssrsPage />} />
            <Route path="/pacientes/:id/nexus/gad7" element={<NexusPatientGad7Page />} />
            <Route path="/pacientes/:id/nexus/hcl32" element={<NexusPatientHcl32Page />} />
            <Route path="/pacientes/:id/nexus/eem" element={<NexusPatientEemPage />} />
            <Route path="/pacientes/:id/nexus/meem" element={<NexusPatientMeemPage />} />
            <Route path="/pacientes/:id/nexus/evolution" element={<NexusPatientEvolutionPage />} />
            <Route path="/pacientes/:id/nexus/education" element={<NexusEducationPage />} />
            <Route path="/pacientes/:id/nexus/self-assessment" element={<NexusSelfAssessmentInvitePage />} />
            <Route path="/nexus/evidence" element={<NexusEvidencePage />} />
            <Route path="/pacientes/:id/nexus/calculators/egfr" element={<NexusPatientEgfrPage />} />
            <Route path="/pacientes/:id/nexus/calculators/cv-risk" element={<NexusPatientCardiovascularRiskPage />} />
            <Route path="/pacientes/:id/nexus/psychopharmacology/antidepressant-switch" element={<NexusPatientAntidepressantSwitchPage />} />
            <Route path="/pacientes/:id/nexus/scales/:scaleKey" element={<NexusPatientScalePage />} />
            <Route path="/pacientes/:id" element={<PatientsRoleAware />} />
            <Route path="/financeiro" element={<FinanceiroOperational />} />
            <Route path="/crm" element={<CrmOperational />} />
            <Route path="/mensagens" element={<MensagensOperational />} />
            <Route path="/relatorios" element={<RelatoriosHub />} />
            <Route path="/config" element={<ConfigPremium />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
