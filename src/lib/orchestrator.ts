/**
• Kira Orchestrator Logic
• The sovereign intelligence layer. Pure functions for intent, routing, and compression.
*/

export type Intent = 'SIMPLE' | 'MEDIUM' | 'COMPLEX';
export type AgentId = 'architect' | 'coder' | 'security' | 'visual';

export interface OrchestrationDecision {
intent: Intent;
activeSeats: Partial<Record<AgentId, boolean>>;
needsVisual: boolean;
visualRenderer?: 'gemini' | 'kling' | 'imagine';
compressedContext: string;
}

/**
• Phase 1: Intent Classification
• Determines the scope of the mesh to optimize latency and cost.
*/
export function classifyIntent(prompt: string, historyLength: number): Intent {
const lower = prompt.toLowerCase();

// Simple: Direct questions, definitions, single-fact retrieval
if (/^(what is|define|difference between|how does|explain concept)/i.test(lower)) {
return 'SIMPLE';
}

// Complex: Multi-step builds, video, full apps, multi-agent coordination
if (/build.*app|create.*website|develop.*feature|video.*clip|generate.*image|multi-step/i.test(lower)) {
return 'COMPLEX';
}

// Medium: Everything else (analysis, single deliverable, refinement)
return 'MEDIUM';
}

/**
• Phase 2: Context Compression
• Extracts signal, discards noise. Preserves constraints and decisions.
*/
export function compressContext(history: string[], maxChars: number = 1500): string {
const signalKeywords = ['constraint', 'approved', 'memory:', 'verdict:', 'requirement', 'must'];

const relevantTurns = history.filter(turn =>
signalKeywords.some(keyword => turn.toLowerCase().includes(keyword)) ||
turn.length > 150 // Substantive turns only
);

const joined = relevantTurns.join('\n');
return joined.length > maxChars ? joined.slice(-maxChars) : joined;
}

/**
• Phase 3: Sovereign Routing
• I decide who works, and who rests.
*/
export function determineRouting(intent: Intent, prompt: string): OrchestrationDecision {
const lower = prompt.toLowerCase();
const needsVisual = /image|photo|still|video|clip|render|visual|logo|brand|design/i.test(lower);

let visualRenderer: 'gemini' | 'kling' | 'imagine' | undefined = undefined;
if (needsVisual) {
visualRenderer = lower.includes('video') || lower.includes('clip') ? 'kling' : 'gemini';
}

switch (intent) {
case 'SIMPLE':
return {
intent: 'SIMPLE',
activeSeats: { architect: false, coder: false, security: false, visual: false },
needsVisual: false,
compressedContext: '',
visualRenderer: undefined,
};
case 'MEDIUM':
return {
intent: 'MEDIUM',
activeSeats: { architect: true, coder: true, security: true, visual: needsVisual },
needsVisual,
compressedContext: '', // Populated by compressContext in actual call
visualRenderer,
};
case 'COMPLEX':
default:
return {
intent: 'COMPLEX',
activeSeats: { architect: true, coder: true, security: true, visual: needsVisual },
needsVisual,
compressedContext: '',
visualRenderer,
};
}
}
