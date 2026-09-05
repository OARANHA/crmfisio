import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './lib/store';
import { Shell } from './components/Shell';
import { ClinicEntitlementGate } from './components/ClinicEntitlementGate';
import { DashboardRoleAware } from './pages/DashboardRoleAware';
import { AgendaOperational } from './pages/AgendaOperational';
import { RecepcaoHoje } from './pages/RecepcaoHoje';
import { PatientsRoleAware } from './pages/PatientsRoleAware';
import { PatientEditPage } from './pages/PatientEditPage';
import { NexusPublicSelfAssessmentPage } from './pages/NexusPublicSelfAssessmentPage';
import { NexusGlobalPage } from './pages/NexusGlobalPage';
import { NexusPatientEemPage } from './pages/NexusPatientEemPage';
import { NexusPatientEvolutionPage } from './pages/NexusPatientEvolutionPage';
import { PlatformAdminHomePage } from './pages/PlatformAdminHomePage';
import { PlatformAdminPage } from './pages/PlatformAdminPage';
import { PlatformClinicModulesPage } from './pages/PlatformClinicModulesPage';
import { PlatformClinicProvisioningPage } from './pages/PlatformClinicProvisioningPage';
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

const gated = (entitlement: 'nexus.access' | 'finance.access' | 'crm.access' | 'reports.access' | 'whatsapp.access', element: React.ReactNode) => (
  <ClinicEntitlementGate entitlement={entitlement}>{element}</ClinicEntitlementGate>
);

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/autoavaliacao/:token" element={<NexusPublicSelfAssessmentPage />} />
          <Route path="/platform" element={<PlatformAdminHomePage />} />
          <Route path="/platform/governanca" element={<PlatformAdminPage />} />
          <Route path="/platform/modulos" element={<PlatformClinicModulesPage />} />
          <Route path="/platform/provisionar" element={<PlatformClinicProvisioningPage />} />
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<DashboardRoleAware />} />
            <Route path="/nexus" element={gated('nexus.access', <NexusGlobalPage />)} />
            <Route path="/agenda" element={<AgendaOperational />} />
            <Route path="/hoje" element={<RecepcaoHoje />} />
            <Route path="/pacientes" element={<PatientsRoleAware />} />
            <Route path="/pacientes/:id/editar" element={<PatientEditPage />} />
            <Route path="/pacientes/:id" element={<PatientsRoleAware />} />
            <Route path="/pacientes/:id/nexus" element={gated('nexus.access', <PatientsRoleAware />)} />
            <Route path="/pacientes/:id/nexus/eem" element={gated('nexus.access', <NexusPatientEemPage />)} />
            <Route path="/pacientes/:id/nexus/evolution" element={gated('nexus.access', <NexusPatientEvolutionPage />)} />
            <Route path="/financeiro" element={gated('finance.access', <FinanceiroOperational />)} />
            <Route path="/crm" element={gated('crm.access', <CrmOperational />)} />
            <Route path="/mensagens" element={gated('whatsapp.access', <MensagensOperational />)} />
            <Route path="/relatorios" element={gated('reports.access', <RelatoriosHub />)} />
            <Route path="/config" element={<ConfigPremium />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
