import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/useAuth';
import { FinanceProvider } from './lib/financeContext';
import { AgendaProvider } from './lib/agendaContext';
import { PatientProvider } from './lib/patientContext';
import { ClinicalProvider } from './lib/clinicalContext';
import { ClinicDirectoryProvider } from './lib/clinicDirectoryContext';
import { PackageProvider } from './lib/packageContext';
import { CommunicationProvider } from './lib/communicationContext';
import { AuditProvider } from './lib/auditContext';
import { InfrastructureProvider } from './lib/infrastructureContext';
import { ToastProvider } from './lib/toastContext';
import { ClinicDataBoundary } from './lib/ClinicDataBoundary';
import { PresentationContextProvider } from './lib/presentationContextContext';
import { useCurrentUserAccess } from './lib/currentUserAccess';
import { Shell } from './components/Shell';
import { ContextualHelp } from './components/ContextualHelp';
import { ClinicEntitlementGate } from './components/ClinicEntitlementGate';
import { ModuleAccessGate } from './components/ModuleAccessGate';
import { PresentationPrivacyBoundary } from './components/PresentationPrivacyBoundary';
import { MandatoryPasswordChange } from './components/MandatoryPasswordChange';
import { PulseMark } from './components/Ecg';
const DashboardRoleAware = lazy(() => import('./pages/DashboardRoleAware').then((module) => ({ default: module.DashboardRoleAware })));
const AgendaOperational = lazy(() => import('./pages/AgendaOperational').then((module) => ({ default: module.AgendaOperational })));
const RecepcaoHoje = lazy(() => import('./pages/RecepcaoHoje').then((module) => ({ default: module.RecepcaoHoje })));
const PatientsRoleAware = lazy(() => import('./pages/PatientsRoleAware').then((module) => ({ default: module.PatientsRoleAware })));
const PatientEditPage = lazy(() => import('./pages/PatientEditPage').then((module) => ({ default: module.PatientEditPage })));
const ClinicAccessRequestPage = lazy(() => import('./pages/ClinicAccessRequestPage').then((module) => ({ default: module.ClinicAccessRequestPage })));
const NexusPublicSelfAssessmentPage = lazy(() => import('./pages/NexusPublicSelfAssessmentPage').then((module) => ({ default: module.NexusPublicSelfAssessmentPage })));
const NexusGlobalPage = lazy(() => import('./pages/NexusGlobalPage').then((module) => ({ default: module.NexusGlobalPage })));
const NexusPatientEemPage = lazy(() => import('./pages/NexusPatientEemPage').then((module) => ({ default: module.NexusPatientEemPage })));
const NexusPatientEvolutionPage = lazy(() => import('./pages/NexusPatientEvolutionPage').then((module) => ({ default: module.NexusPatientEvolutionPage })));
const PlatformAdminHomePage = lazy(() => import('./pages/PlatformAdminHomePage').then((module) => ({ default: module.PlatformAdminHomePage })));
const PlatformAdminPage = lazy(() => import('./pages/PlatformAdminPage').then((module) => ({ default: module.PlatformAdminPage })));
const PlatformClinicModulesPage = lazy(() => import('./pages/PlatformClinicModulesPage').then((module) => ({ default: module.PlatformClinicModulesPage })));
const PlatformClinicProvisioningPage = lazy(() => import('./pages/PlatformClinicProvisioningPage').then((module) => ({ default: module.PlatformClinicProvisioningPage })));
const PlatformCommercialPage = lazy(() => import('./pages/PlatformCommercialPage').then((module) => ({ default: module.PlatformCommercialPage })));
const PlatformRevenuePage = lazy(() => import('./pages/PlatformRevenuePage').then((module) => ({ default: module.PlatformRevenuePage })));
const FinanceiroOperational = lazy(() => import('./pages/FinanceiroOperational').then((module) => ({ default: module.FinanceiroOperational })));
const CrmOperational = lazy(() => import('./pages/CrmOperational').then((module) => ({ default: module.CrmOperational })));
const MensagensOperational = lazy(() => import('./pages/MensagensOperational').then((module) => ({ default: module.MensagensOperational })));
const RelatoriosHub = lazy(() => import('./pages/RelatoriosHub').then((module) => ({ default: module.RelatoriosHub })));
const ConfigPremium = lazy(() => import('./pages/ConfigPremium').then((module) => ({ default: module.ConfigPremium })));

function FullPageRouteFallback() {
  return (
    <div className="app-surface grid min-h-screen place-items-center p-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-2xl border border-line/70 bg-panel px-5 py-4 text-fog shadow-[0_18px_60px_rgba(15,28,24,0.10)]">
        <PulseMark className="h-6 w-7" />
        <span className="text-[15px] font-medium">Carregando MedicsPro…</span>
      </div>
    </div>
  );
}

const deferredRoute = (element: React.ReactNode) => (
  <Suspense fallback={<FullPageRouteFallback />}>{element}</Suspense>
);

function Home() {
  const { user, canView } = useCurrentUserAccess();
  if (!user) return <Navigate to="/" replace />;
  if (user.role === 'recep') return <Navigate to="/dashboard" replace />;
  const first = canView('dashboard') ? '/dashboard' : canView('agenda') ? '/agenda' : canView('pacientes') ? '/pacientes' : '/crm';
  return <Navigate to={first} replace />;
}

function SuspendedClinicScreen({ onSignOut }: { onSignOut: () => Promise<void> }) {
  return (
    <div className="app-surface min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-lg overflow-hidden rounded-[24px] border border-amber/35 bg-panel shadow-[0_24px_80px_rgba(15,28,24,0.12)]">
        <div className="px-8 pt-8">
          <div className="flex items-center gap-2.5">
            <PulseMark className="w-8 h-7" />
            <span className="font-display font-bold text-xl tracking-tight">MEDICSPRO<span className="text-pulse">.</span></span>
          </div>
          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber">Acesso temporariamente suspenso</p>
          <h1 className="font-display text-[28px] font-bold mt-2 leading-tight tracking-tight">Esta clínica está suspensa</h1>
          <p className="text-fog text-[14px] mt-3 leading-relaxed">
            Sua autenticação é válida, mas o acesso operacional desta clínica foi suspenso pela administração da plataforma. Nenhum dado da clínica fica disponível enquanto a suspensão estiver ativa.
          </p>
        </div>
        <div className="px-8 py-6 space-y-3">
          <div className="rounded-xl border border-line/75 bg-deep/55 px-4 py-3 text-[12.5px] leading-relaxed text-fog">
            Se você acredita que isso ocorreu por engano, entre em contato com o responsável pela contratação do MedicsPro ou com o suporte da plataforma.
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="w-full min-h-12 rounded-xl border border-line bg-deep px-4 py-3 font-display text-[13px] font-semibold text-paper hover:bg-raise/60"
          >
            Encerrar sessão
          </button>
        </div>
      </div>
    </div>
  );
}

function ClinicSessionGate({ children }: { children: React.ReactNode }) {
  const { user, session, profile, tenantAccessState, signOut, loading } = useAuth();
  const mustChangePassword = Boolean((profile as (typeof profile & { must_change_password?: boolean }))?.must_change_password);

  if (loading) return <div className="app-surface min-h-screen" />;

  if (session && tenantAccessState === 'suspended') {
    return <SuspendedClinicScreen onSignOut={signOut} />;
  }

  if (!user || !profile) return <>{children}</>;

  if (mustChangePassword) {
    return (
      <MandatoryPasswordChange
        onComplete={() => window.location.reload()}
        onSignOut={signOut}
      />
    );
  }

  return <>{children}</>;
}

const entitlementGate = (entitlement: 'nexus.access' | 'finance.access' | 'crm.access' | 'reports.access' | 'whatsapp.access', element: React.ReactNode) => (
  <ClinicEntitlementGate entitlement={entitlement}>{element}</ClinicEntitlementGate>
);

const moduleGate = (module: 'dashboard' | 'agenda' | 'pacientes' | 'clinico' | 'financeiro' | 'crm' | 'mensagens' | 'relatorios' | 'config', element: React.ReactNode) => (
  <ModuleAccessGate module={module}>{element}</ModuleAccessGate>
);

const privacyBoundary = (element: React.ReactNode) => (
  <PresentationPrivacyBoundary>{element}</PresentationPrivacyBoundary>
);

const protectedModule = (
  module: 'financeiro' | 'crm' | 'mensagens' | 'relatorios',
  entitlement: 'finance.access' | 'crm.access' | 'whatsapp.access' | 'reports.access',
  element: React.ReactNode,
) => moduleGate(module, entitlementGate(entitlement, element));

export default function App() {
  return (
    <AuthProvider>
      <ClinicDataBoundary>
        <PatientProvider>
          <AgendaProvider>
            <FinanceProvider>
              <ClinicalProvider>
                <ClinicDirectoryProvider>
                  <PackageProvider>
                    <CommunicationProvider>
                      <AuditProvider>
                        <InfrastructureProvider>
                          <ToastProvider>
                            <HashRouter>
                              <PresentationContextProvider>
                                <Routes>
                                  <Route path="/solicitar-acesso" element={deferredRoute(<ClinicAccessRequestPage />)} />
                                  <Route path="/autoavaliacao/:token" element={deferredRoute(<NexusPublicSelfAssessmentPage />)} />
                                  <Route path="/platform" element={deferredRoute(<PlatformAdminHomePage />)} />
                                  <Route path="/platform/comercial" element={deferredRoute(<PlatformCommercialPage />)} />
                                  <Route path="/platform/receita" element={deferredRoute(<PlatformRevenuePage />)} />
                                  <Route path="/platform/governanca" element={deferredRoute(<PlatformAdminPage />)} />
                                  <Route path="/platform/modulos" element={deferredRoute(<PlatformClinicModulesPage />)} />
                                  <Route path="/platform/provisionar" element={deferredRoute(<PlatformClinicProvisioningPage />)} />
                                  <Route element={<ClinicSessionGate><Shell /></ClinicSessionGate>}>
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
                                    <Route path="/financeiro" element={protectedModule('financeiro', 'finance.access', privacyBoundary(<FinanceiroOperational />))} />
                                    <Route path="/crm" element={protectedModule('crm', 'crm.access', privacyBoundary(<CrmOperational />))} />
                                    <Route path="/mensagens" element={protectedModule('mensagens', 'whatsapp.access', <MensagensOperational />)} />
                                    <Route path="/relatorios" element={protectedModule('relatorios', 'reports.access', privacyBoundary(<RelatoriosHub />))} />
                                    <Route path="/config" element={moduleGate('config', privacyBoundary(<ConfigPremium />))} />
                                    <Route path="*" element={<Home />} />
                                  </Route>
                                </Routes>
                                <ContextualHelp />
                              </PresentationContextProvider>
                            </HashRouter>
                          </ToastProvider>
                        </InfrastructureProvider>
                      </AuditProvider>
                    </CommunicationProvider>
                  </PackageProvider>
                </ClinicDirectoryProvider>
              </ClinicalProvider>
            </FinanceProvider>
          </AgendaProvider>
        </PatientProvider>
      </ClinicDataBoundary>
    </AuthProvider>
  );
}
