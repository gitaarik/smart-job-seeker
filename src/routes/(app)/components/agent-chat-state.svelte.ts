// Shared open-state for the personal AI assistant, so entry points outside the
// AgentChat component (e.g. the mobile sidebar menu) can open it.
export const agentChatState = $state({ open: false });
