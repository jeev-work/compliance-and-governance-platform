import { FilterProvider, useFilters } from '@/lib/filterContext';
import { AppSidebar } from '@/components/AppSidebar';
import { GlobalFilterBar } from '@/components/GlobalFilterBar';
import { ExecutiveView } from '@/components/views/ExecutiveView';
import { LobManagerView } from '@/components/views/LobManagerView';
import { SpocView } from '@/components/views/SpocView';
import { ComplianceView } from '@/components/views/ComplianceView';
import { AnalystView } from '@/components/views/AnalystView';
import { AdminHealthView } from '@/components/views/AdminHealthView';
import { DrilldownPanel } from '@/components/DrilldownPanel';
import { KpiHistoryPanel } from '@/components/KpiHistoryPanel';

function DashboardContent() {
  const { filters } = useFilters();

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <GlobalFilterBar />
        <main className="flex-1 p-3 overflow-y-auto scrollbar-thin">
          <KpiHistoryPanel />
          {filters.role === 'executive'  && <ExecutiveView />}
          {filters.role === 'lobManager' && <LobManagerView />}
          {filters.role === 'spoc'       && <SpocView />}
          {filters.role === 'compliance' && <ComplianceView />}
          {filters.role === 'analyst'    && <AnalystView />}
          {filters.role === 'admin'      && <AdminHealthView />}
        </main>
      </div>
      <DrilldownPanel />
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
