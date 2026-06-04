import { Shield, Crown, Users, Wrench, FileCheck, LineChart, ServerCog, Activity } from 'lucide-react';
import { useFilters, Role } from '@/lib/filterContext';
import { cn } from '@/lib/utils';
import { ROLE_LABEL } from '@/lib/rbac';

const NAV: { id: Role; icon: any }[] = [
  { id: 'executive',  icon: Crown },
  { id: 'lobManager', icon: Users },
  { id: 'spoc',       icon: Wrench },
  { id: 'compliance', icon: FileCheck },
  { id: 'analyst',    icon: LineChart },
  { id: 'admin',      icon: ServerCog },
];

export function AppSidebar() {
  const { filters, setFilters } = useFilters();

  return (
    <aside className="w-14 hover:w-52 transition-all duration-200 bg-sidebar border-r border-sidebar-border flex flex-col group overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-sidebar-border">
        <Shield className="h-5 w-5 text-primary shrink-0" />
        <span className="text-xs font-semibold text-sidebar-accent-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          GovShield
        </span>
      </div>

      <nav className="flex-1 py-2 space-y-0.5">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setFilters((f) => ({ ...f, role: item.id }))}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
              filters.role === item.id
                ? 'bg-sidebar-accent text-primary border-l-2 border-primary'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 border-l-2 border-transparent',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {ROLE_LABEL[item.id]}
            </span>
          </button>
        ))}
      </nav>

      <div className="px-3 py-2 border-t border-sidebar-border flex items-center gap-2">
        <Activity className="h-4 w-4 rag-green shrink-0" />
        <span className="text-[10px] text-sidebar-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          5-state RAG · live
        </span>
      </div>
    </aside>
  );
}
