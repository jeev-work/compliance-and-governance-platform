// Role action matrix — drives drilldown panel button visibility (Solution Blueprint §3, TPRS §6.2).
import { Role } from './filterContext';

export type DrilldownAction =
  | 'acknowledge'        // SPOC stops chase timer
  | 'deployResolution'   // SPOC → moves to Verifying
  | 'tagDependency'      // SPOC forks cross-functional sub-ticket
  | 'reassign'           // LOB Manager
  | 'escalate'           // LOB Manager
  | 'executiveFlag'      // Executive override
  | 'exportAudit';       // Compliance auditor — hashed regulatory export

export const ROLE_ACTIONS: Record<Role, DrilldownAction[]> = {
  executive: ['executiveFlag'],
  lobManager: ['reassign', 'escalate'],
  spoc: ['acknowledge', 'deployResolution', 'tagDependency'],
  compliance: ['exportAudit'],
  analyst: [],
  admin: [],
};

export const ROLE_LABEL: Record<Role, string> = {
  executive: 'Executive Leadership',
  lobManager: 'LOB Manager',
  spoc: 'IT System SPOC',
  compliance: 'Compliance & Audit',
  analyst: 'Generic Viewer / Analyst',
  admin: 'Platform Admin',
};

export const ROLE_PURPOSE: Record<Role, string> = {
  executive: 'Enterprise-wide read-only with Executive Flag override',
  lobManager: 'Aggregated LoB matrix · escalation rail · reassignment',
  spoc: 'Actionable alert inbox · acknowledge / resolve / fork',
  compliance: 'Immutable ledger query · hashed regulatory export',
  analyst: 'Historical trends · SLA% month-over-month · no PII',
  admin: 'Connector health · SLA vault versions · DLQ',
};
