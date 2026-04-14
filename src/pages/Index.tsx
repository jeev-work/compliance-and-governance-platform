import { FilterProvider, useFilters } from '@/lib/filterContext';
import { AppSidebar } from '@/components/AppSidebar';
import { GlobalFilterBar } from '@/components/GlobalFilterBar';
import { LeadershipView } from '@/components/views/LeadershipView';
import { TechOpsView } from '@/components/views/TechOpsView';
import { ComplianceView } from '@/components/views/ComplianceView';
import { DrilldownPanel } from '@/components/DrilldownPanel';

function DashboardContent() {
  const { filters } = useFilters();

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <GlobalFilterBar />
        <main className="flex-1 p-3 overflow-y-auto scrollbar-thin">
          {filters.persona === 'leadership' && <LeadershipView />}
          {filters.persona === 'techops' && <TechOpsView />}
          {filters.persona === 'compliance' && <ComplianceView />}
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
