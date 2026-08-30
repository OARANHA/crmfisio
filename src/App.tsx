import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './lib/store';
import { Shell } from './components/Shell';
import { Dashboard } from './pages/Dashboard';
import { Agenda } from './pages/Agenda';
import { Pacientes } from './pages/Pacientes';
import { Financeiro } from './pages/Financeiro';
import { Crm } from './pages/Crm';
import { Mensagens } from './pages/Mensagens';
import { Relatorios } from './pages/Relatorios';
import { Config } from './pages/Config';

function Home() {
  const { user, canView } = useApp();
  if (!user) return <Navigate to="/" replace />;
  const first = canView('dashboard')
    ? '/dashboard'
    : canView('agenda')
      ? '/agenda'
      : canView('pacientes')
        ? '/pacientes'
        : '/crm';
  return <Navigate to={first} replace />;
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/pacientes" element={<Pacientes />} />
            <Route path="/pacientes/:id" element={<Pacientes />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/crm" element={<Crm />} />
            <Route path="/mensagens" element={<Mensagens />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/config" element={<Config />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
