import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ROLE_PRECEDENCE } from '@ai-fluency/shared';
import { useMe } from './lib/auth.js';
import { Spinner, ErrorBanner } from './components/ui.js';
import { RoleGuard } from './components/RoleGuard.js';
import { Home } from './surfaces/Home.js';
import { SelfAssessment } from './surfaces/employee/SelfAssessment.js';
import { TeamView } from './surfaces/manager/TeamView.js';
import { ConversationGuide } from './surfaces/manager/ConversationGuide.js';
import { OrgDashboard } from './surfaces/elt/OrgDashboard.js';
import type { Me } from './lib/types.js';

function Nav({ me }: { me: Me }) {
  const link = 'px-3 py-2 text-sm font-medium rounded-md';
  const active = ({ isActive }: { isActive: boolean }) =>
    `${link} ${isActive ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100'}`;
  const isManager = ROLE_PRECEDENCE[me.role] >= ROLE_PRECEDENCE.MANAGER;
  const isElt = ROLE_PRECEDENCE[me.role] >= ROLE_PRECEDENCE.ELT;
  return (
    <nav className="flex items-center gap-2 border-b border-gray-200 bg-white px-6 py-3">
      <span className="mr-4 font-semibold text-brand">AI Fluency</span>
      <NavLink to="/" className={active} end>
        Home
      </NavLink>
      <NavLink to="/self-assessment" className={active}>
        My assessment
      </NavLink>
      {isManager && (
        <NavLink to="/manager/team" className={active}>
          My team
        </NavLink>
      )}
      {isElt && (
        <NavLink to="/elt" className={active}>
          Organisation
        </NavLink>
      )}
      <span className="ml-auto text-sm text-gray-500">
        {me.name} · {me.role}
      </span>
    </nav>
  );
}

export function App() {
  const { data: me, isLoading, isError, error } = useMe();

  if (isLoading) return <div className="p-10"><Spinner /></div>;
  if (isError || !me)
    return (
      <div className="p-10">
        <ErrorBanner message={(error as Error)?.message ?? 'Could not load your profile.'} />
      </div>
    );

  return (
    <div className="min-h-screen">
      <Nav me={me} />
      <main className="mx-auto max-w-5xl p-6">
        <Routes>
          <Route path="/" element={<Home me={me} />} />
          <Route path="/self-assessment" element={<SelfAssessment me={me} />} />
          <Route
            path="/manager/team"
            element={
              <RoleGuard min="MANAGER" role={me.role}>
                <TeamView me={me} />
              </RoleGuard>
            }
          />
          <Route
            path="/manager/calibrate/:id"
            element={
              <RoleGuard min="MANAGER" role={me.role}>
                <ConversationGuide />
              </RoleGuard>
            }
          />
          <Route
            path="/elt"
            element={
              <RoleGuard min="ELT" role={me.role}>
                <OrgDashboard />
              </RoleGuard>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
