import { useState } from 'react';
import { FilterProvider, useFilters } from '@/lib/filterContext';
import { AppSidebar } from '@/components/AppSidebar';
import { GlobalFilterBar } from '@/components/GlobalFilterBar';
import { ExecutiveView } from '@/components/views/ExecutiveView';
import { LobManagerView } from '@/components/views/LobManagerView';
import { SpocView } from '@/components/views/SpocView';
import { ComplianceView } from '@/components/views/ComplianceView';
import { AdminHealthView } from '@/components/views/AdminHealthView';
import { DrilldownPanel } from '@/components/DrilldownPanel';
import { KpiHistoryPanel } from '@/components/KpiHistoryPanel';
import { NotificationPanel } from '@/components/NotificationPanel';
import { PinnedKpiRail } from '@/components/PinnedKpiRail';
import { NocWallboard } from '@/components/NocWallboard';

function DashboardContent() {
  const { filters } = useFilters();
  const [wallboardOpen, setWallboardOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar onLaunchWallboard={() => setWallboardOpen(true)} activeWallboard={wallboardOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <GlobalFilterBar />
        <main className="flex-1 p-3 overflow-y-auto scrollbar-thin">
          <KpiHistoryPanel />
          <NotificationPanel />
          <PinnedKpiRail />
          {filters.role === 'executive'  && <ExecutiveView />}
          {filters.role === 'lobManager' && <LobManagerView />}
          {filters.role === 'spoc'       && <SpocView />}
          {(filters.role === 'compliance' || filters.role === 'analyst') && <ComplianceView />}
          {filters.role === 'admin'      && <AdminHealthView />}
        </main>
      </div>
      <DrilldownPanel />
      <NocWallboard open={wallboardOpen} onClose={() => setWallboardOpen(false)} />
    </div>
  );
}

export default function Index() {
  return (
    <FilterProvider>
      <DashboardContent />
    </FilterProvider>
  );
}
