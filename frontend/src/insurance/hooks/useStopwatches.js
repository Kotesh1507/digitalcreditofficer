// Human underwriter pre-seeded at 6h 44m 12s = 24252s (vs CDO's 4h 12m 38s)
// AI officer starts at 0 when demo starts
import { useInsuranceStore, PHASE, HUMAN_SEED } from '../store/index.js';

export { HUMAN_SEED };
// Stopwatch rendering is handled directly in the Stopwatches component
// using the same agentElapsed + tickAgent pattern from the store.
// This file re-exports HUMAN_SEED so the component can import it cleanly.
