import { advanceMobileWorld, createMobileKitchen, mobileGoalChecks, planMobileTask, startMobilePlan } from './mobile-navigation';
import type { MobileGoalCheck, MobilePlan, MobileWorld } from './mobile-navigation';

export interface MobileCapabilityResult {
  capability: 'fixed-base' | 'mobile-base'; label: string;
  capabilities: { canNavigate: boolean; armReach: number };
  outcome: 'completed' | 'failed' | 'refused' | 'blocked'; taskAccepted: boolean;
  initialWorld: MobileWorld; finalWorld: MobileWorld; steps: MobilePlan['steps'];
  completedSteps: number; completedPickups: number; completedPlacements: number;
  distanceTravelled: number; simulatedSeconds: number; evaluationDurationMs: number; ticks: number;
  checks: MobileGoalCheck[]; reason: string; error?: string;
}
export interface MobileComparison {
  schema: 'teachtrace.mobile-comparison.v1'; command: string; initialWorld: MobileWorld; target: MobilePlan['goal'] | null;
  fixedBase: MobileCapabilityResult; mobileBase: MobileCapabilityResult; results: MobileCapabilityResult[];
  executionBudget: { maxTicksPerCapability: number; dt: number }; limitations: string[];
}
const MAX_TICKS = 6000;
const DT = 1 / 30;

function runCapability(initial: MobileWorld, originalPlan: MobilePlan, mobile: boolean): MobileCapabilityResult {
  const started = performance.now();
  const initialWorld = structuredClone(initial);
  let world = structuredClone(initialWorld);
  // The fixed-base condition uses the same reach/handling controller and task,
  // with navigation unavailable. It receives no relocated start pose or object.
  const plan = structuredClone(originalPlan);
  if (!mobile) plan.steps = plan.steps.filter(step => step.kind !== 'navigate');
  let outcome: MobileCapabilityResult['outcome'] = 'refused';
  let error = plan.error;
  let ticks = 0;
  if (!error) {
    const start = startMobilePlan(world, plan, 'evaluation');
    world = start.world; error = start.error;
    if (!error) {
      outcome = 'failed';
      for (; ticks < MAX_TICKS; ticks++) {
        const advanced = advanceMobileWorld(world, DT);
        world = advanced.world;
        if (advanced.error) { error = advanced.error; ticks++; break; }
        if (advanced.blocked) { outcome = 'blocked'; error = advanced.blocked; ticks++; break; }
        if (advanced.done) { outcome = 'completed'; ticks++; break; }
      }
      if (ticks >= MAX_TICKS && world.mission?.status !== 'completed' && !error) error = 'The capability evaluation exceeded its bounded controller budget.';
    }
  }
  const checks = mobileGoalChecks(world);
  const taskAccepted = outcome === 'completed' && checks.length > 0 && checks.every(check => check.passed);
  const completedSteps = world.mission?.completedSteps ?? 0;
  const completed = plan.steps.slice(0, completedSteps);
  return {
    capability: mobile ? 'mobile-base' : 'fixed-base', label: mobile ? 'Mobile base + arm' : 'Stationary base + same arm',
    capabilities: { canNavigate: mobile, armReach: initialWorld.robot.armReach }, outcome, taskAccepted,
    initialWorld, finalWorld: world, steps: plan.steps, completedSteps,
    completedPickups: completed.filter(step => step.kind === 'pickup').length,
    completedPlacements: completed.filter(step => step.kind === 'place').length,
    distanceTravelled: world.distanceTravelled - initialWorld.distanceTravelled,
    simulatedSeconds: world.simTime - initialWorld.simTime,
    evaluationDurationMs: Math.max(0, Math.round((performance.now() - started) * 100) / 100), ticks,
    checks, reason: error ?? (taskAccepted ? 'The controller completed the actual route/handling steps and all geometric goal checks passed.' : 'Controller completion did not satisfy every explicit goal check.'),
    ...(error ? { error } : {}),
  };
}

/** A capability ablation on one shared scene, not a learned-policy or physical-robot benchmark. */
export function runMobileComparison(initial = createMobileKitchen(), command = 'Take cup from counter to sink'): MobileComparison {
  const initialWorld = structuredClone(initial);
  const plan = planMobileTask(command, initialWorld);
  const fixedBase = runCapability(initialWorld, plan, false);
  const mobileBase = runCapability(initialWorld, plan, true);
  return {
    schema: 'teachtrace.mobile-comparison.v1', command, initialWorld, target: plan.goal ?? null,
    fixedBase, mobileBase, results: [fixedBase, mobileBase], executionBudget: { maxTicksPerCapability: MAX_TICKS, dt: DT },
    limitations: [
      'Both conditions share the exact initial scene, object target, arm reach and deterministic handling controller.',
      'The fixed-base condition removes navigation primitives without relocating objects or increasing arm reach.',
      'Known-map geometric navigation and idealized station handoffs; no SLAM, contact dynamics, learned policy or sim-to-real validation.',
      'Evaluation duration is local computation time; simulated duration is controller time, not measured real-robot execution time.',
    ],
  };
}
