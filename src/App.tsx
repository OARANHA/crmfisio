import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './lib/store';
import { Shell } from './components/Shell';
import { DashboardRoleAware } from './pages/DashboardRoleAware';
import { AgendaOperational } from './pages/AgendaOperational';
import { RecepcaoHoje } from './pages/RecepcaoHoje';
import { PatientsRoleAware } from './pages/PatientsRoleAware';
import { PatientEditPage } from './pages/PatientEditPage';
import { NexusPublicSelfAssessmentPage } from './pages/NexusPublicSelfAssessmentPage';
import { FinanceiroOperational } from './pages/FinanceiroOperational';
import { CrmOperational } from './pages/CrmOperational';
import { MensagensOperational } from './pages/MensagensOperational';
import { RelatoriosHub } from './pages/RelatoriosHub';
import { ConfigPremium } from './pages/ConfigPremium';
import { PlatformAdminConsole } from './pages/PlatformAdminConsole';
import { useAuth } from './lib/useAuth';

function Home() {
  const { user, canView } = useApp();
  if (!user) return <Navigate to="/" replace />;
  if (user.role === 'recep') return <Navigate to="/dashboard" replace />;
  const first = canView('dashboard') ? '/dashboard' : canView('agenda') ? '/agenda' : canView('pacientes') ? '/pacientes' : '/crm';
  return <Navigate to={first} replace />;
}

function AuthenticatedSurface() {
  const { principal, platformAdmin, signOut, loading } = useAuth();

  if (!loading && principal && platformAdmin) {
    return <PlatformAdminConsole principal={principal} onSignOut={signOut} />;
  }

  return <Shell />;
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/autoavaliacao/:token" element={<NexusPublicSelfAssessmentPage />} />
          <Route element={<AuthenticatedSurface />}>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<DashboardRoleAware />} />
            <Route path="/agenda" element={<AgendaOperational />} />
            <Route path="/hoje" element={<RecepcaoHoje />} />
            <Route path="/pacientes" element={<PatientsRoleAware />} />
            <Route path="/pacientes/:id/editar" element={<PatientEditPage />} />
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
