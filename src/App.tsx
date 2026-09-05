import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './lib/store';
import { Shell } from './components/Shell';
import { ClinicEntitlementGate } from './components/ClinicEntitlementGate';
import { ModuleAccessGate } from './components/ModuleAccessGate';
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

const entitlementGate = (entitlement: 'nexus.access' | 'finance.access' | 'crm.access' | 'reports.access' | 'whatsapp.access', element: React.ReactNode) => (
  <ClinicEntitlementGate entitlement={entitlement}>{element}</ClinicEntitlementGate>
);

const moduleGate = (module: 'dashboard' | 'agenda' | 'pacientes' | 'clinico' | 'financeiro' | 'crm' | 'mensagens' | 'relatorios' | 'config', element: React.ReactNode) => (
  <ModuleAccessGate module={module}>{element}</ModuleAccessGate>
);

const protectedModule = (
  module: 'financeiro' | 'crm' | 'mensagens' | 'relatorios',
  entitlement: 'finance.access' | 'crm.access' | 'whatsapp.access' | 'reports.access',
  element: React.ReactNode,
) => moduleGate(module, entitlementGate(entitlement, element));

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
            <Route path="/dashboard" element={moduleGate('dashboard', <DashboardRoleAware />)} />
            <Route path="/nexus" element={moduleGate('clinico', entitlementGate('nexus.access', <NexusGlobalPage />))} />
            <Route path="/agenda" element={moduleGate('agenda', <AgendaOperational />)} />
            <Route path="/hoje" element={moduleGate('agenda', <RecepcaoHoje />)} />
            <Route path="/pacientes" element={moduleGate('pacientes', <PatientsRoleAware />)} />
            <Route path="/pacientes/:id/editar" element={moduleGate('pacientes', <PatientEditPage />)} />
            <Route path="/pacientes/:id" element={moduleGate('pacientes', <PatientsRoleAware />)} />
            <Route path="/pacientes/:id/nexus" element={moduleGate('clinico', entitlementGate('nexus.access', <PatientsRoleAware />))} />
            <Route path="/pacientes/:id/nexus/eem" element={moduleGate('clinico', entitlementGate('nexus.access', <NexusPatientEemPage />))} />
            <Route path="/pacientes/:id/nexus/evolution" element={moduleGate('clinico', entitlementGate('nexus.access', <NexusPatientEvolutionPage />))} />
            <Route path="/financeiro" element={protectedModule('financeiro', 'finance.access', <FinanceiroOperational />)} />
            <Route path="/crm" element={protectedModule('crm', 'crm.access', <CrmOperational />)} />
            <Route path="/mensagens" element={protectedModule('mensagens', 'whatsapp.access', <MensagensOperational />)} />
            <Route path="/relatorios" element={protectedModule('relatorios', 'reports.access', <RelatoriosHub />)} />
            <Route path="/config" element={moduleGate('config', <ConfigPremium />)} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
