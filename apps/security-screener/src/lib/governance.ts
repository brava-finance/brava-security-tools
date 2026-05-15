// Static, source-controlled metadata referenced by the screener UI: role
// explainers and the curated list of public audit reports. Anything
// commit-able here is preferred over runtime fetches so reviewers can audit
// the screener's claims by reading source alone.

// Per-role human-readable explainer. Keyed by the canonical role name
// produced by `apps/security-subgraph/src/roles.ts`; rows not in this map
// fall back to a generic "Unknown role" tooltip.
//
// Capability strings should describe what an account holding this role can
// do to the AdminVault state. Each line gets rendered as a separate bullet
// in the Roles section.
export interface RoleExplainer {
  summary: string;
  capabilities: readonly string[];
  // Risk level if a single account in this role were compromised.
  risk: 'low' | 'medium' | 'high' | 'critical';
}

export const ROLE_EXPLAINERS: Record<string, RoleExplainer> = {
  OWNER_ROLE: {
    summary:
      'Apex admin. Can grant or revoke any other role and is the ultimate authority over the AdminVault.',
    capabilities: [
      'Grant and revoke every other role (directly or through Role Manager).',
      'Override or pause the proposal pipeline.',
      'Set the proposal delay value.',
    ],
    risk: 'critical',
  },
  DEFAULT_ADMIN_ROLE: {
    summary:
      'OpenZeppelin AccessControl super-admin. Mirrors OWNER_ROLE in practice — can administer every role.',
    capabilities: [
      'Grant and revoke every other role through native AccessControl.',
      'Change the admin role of any role hash.',
    ],
    risk: 'critical',
  },
  ROLE_MANAGER_ROLE: {
    summary: 'Delegated role administrator. Can grant/revoke operational roles without owner intervention.',
    capabilities: ['Grant and revoke fee/pool/action/transaction operator roles.'],
    risk: 'high',
  },
  FEE_PROPOSER_ROLE: {
    summary: 'Proposes new fee recipients and basis-point bounds. Proposals still wait the delay before taking effect.',
    capabilities: ['Submit a fee proposal (recipient, min/max basis).'],
    risk: 'medium',
  },
  FEE_CANCELER_ROLE: {
    summary: 'Cancels pending fee proposals before they are executed.',
    capabilities: ['Cancel any pending fee proposal.'],
    risk: 'low',
  },
  FEE_EXECUTOR_ROLE: {
    summary: 'Executes fee proposals after the delay has elapsed.',
    capabilities: ['Promote a pending fee proposal into an active fee config.'],
    risk: 'medium',
  },
  FEE_TAKER_ROLE: {
    summary: 'Collects accrued fees on behalf of the protocol.',
    capabilities: ['Withdraw protocol fees to the configured recipient.'],
    risk: 'low',
  },
  POOL_PROPOSER_ROLE: {
    summary: 'Proposes new pools (protocolId + pool address) to the AdminVault whitelist.',
    capabilities: ['Submit a pool proposal.'],
    risk: 'medium',
  },
  POOL_CANCELER_ROLE: {
    summary: 'Cancels pending pool proposals before they are granted.',
    capabilities: ['Cancel any pending pool proposal.'],
    risk: 'low',
  },
  POOL_EXECUTOR_ROLE: {
    summary: 'Executes pool proposals after the delay has elapsed.',
    capabilities: ['Promote a pending pool proposal into an active whitelisted pool.'],
    risk: 'medium',
  },
  POOL_DISPOSER_ROLE: {
    summary: 'Removes pools from the active whitelist (no delay).',
    capabilities: ['Immediately remove a pool from the AdminVault whitelist.'],
    risk: 'medium',
  },
  ACTION_PROPOSER_ROLE: {
    summary: 'Proposes new ActionBase implementations to the whitelist.',
    capabilities: ['Submit an action proposal (actionId + implementation address).'],
    risk: 'medium',
  },
  ACTION_CANCELER_ROLE: {
    summary: 'Cancels pending action proposals before they are granted.',
    capabilities: ['Cancel any pending action proposal.'],
    risk: 'low',
  },
  ACTION_EXECUTOR_ROLE: {
    summary: 'Executes action proposals after the delay has elapsed.',
    capabilities: ['Promote a pending action proposal into an active whitelisted action.'],
    risk: 'medium',
  },
  ACTION_DISPOSER_ROLE: {
    summary: 'Removes actions from the active whitelist (no delay).',
    capabilities: ['Immediately remove an action from the AdminVault whitelist.'],
    risk: 'medium',
  },
  TRANSACTION_PROPOSER_ROLE: {
    summary: 'Proposes ad-hoc admin transactions that the AdminVault can execute through its Safe modules.',
    capabilities: ['Submit a transaction proposal.'],
    risk: 'high',
  },
  TRANSACTION_CANCELER_ROLE: {
    summary: 'Cancels pending admin transaction proposals.',
    capabilities: ['Cancel any pending transaction proposal.'],
    risk: 'low',
  },
  TRANSACTION_EXECUTOR_ROLE: {
    summary: 'Executes admin transaction proposals after the delay has elapsed.',
    capabilities: ['Trigger execution of a granted transaction proposal.'],
    risk: 'high',
  },
  TRANSACTION_DISPOSER_ROLE: {
    summary: 'Disposes (clears) granted transaction proposals.',
    capabilities: ['Remove a granted transaction proposal before it is executed.'],
    risk: 'medium',
  },
};

export interface AuditReport {
  firm: string;
  // Scope label printed in the card (e.g. "AdminVault + Logger v1").
  scope: string;
  // Human-friendly date string (free-form so the team can match how the
  // audits page renders it).
  date: string;
  // Publicly hosted PDF/HTML report.
  url: string;
}

// Canonical landing page where the team publishes the audit index. The
// screener mirrors entries from there so the IPFS-pinned build can show them
// offline, and links back to the source as the authoritative list.
export const AUDIT_INDEX_URL = 'https://docs.brava.finance/technical/audits';

// Mirrored from docs.brava.finance/technical/audits. Keep this in sync when
// new reports are added — adding an entry is a deliberate code change so the
// audit list is reproducible from the release commit alone.
export const AUDIT_REPORTS: readonly AuditReport[] = [
  {
    firm: 'SigmaPrime',
    scope: 'Core contracts, actions, and governance',
    date: 'January 2025',
    url: 'https://github.com/sigp/public-audits/blob/master/reports/brava/report.pdf',
  },
  {
    firm: 'SigmaPrime',
    scope: 'Module Integrations: CCTP, ZeroEx, EIP712 Typed Data Safe Module',
    date: 'November 2025',
    url: 'https://github.com/sigp/public-audits/blob/master/reports/brava/module-integrations/report.pdf',
  },
];
