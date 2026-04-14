import { Shield, BarChart3, Settings, AlertTriangle, FileCheck, Activity } from 'lucide-react';
import { useFilters, Persona } from '@/lib/filterContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { id: 'leadership' as Persona, label: 'Executive View', icon: BarChart3 },
  { id: 'techops' as Persona, label: 'Tech Ops', icon: Settings },
  { id: 'compliance' as Persona, label: 'Compliance & Risk', icon: FileCheck },
];

export function AppSidebar() {
  const { filters, setFilters } = useFilters();

  return (
    <aside className="w-14 hover:w-48 transition-all duration-200 bg-sidebar border-r border-sidebar-border flex flex-col group overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-sidebar-border">
        <Shield className="h-5 w-5 text-primary shrink-0" />
        <span className="text-xs font-semibold text-sidebar-accent-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          GovShield
        </span>
      </div>

      <nav className="flex-1 py-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setFilters((f) => ({ ...f, persona: item.id }))}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
              filters.persona === item.id
                ? 'bg-sidebar-accent text-primary'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="px-3 py-2 border-t border-sidebar-border">
        <Activity className="h-4 w-4 text-rag-green shrink-0" />
      </div>
    </aside>
  );
}
