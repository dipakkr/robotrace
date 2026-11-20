import { createInitialWorld, TABLE_TOP } from './engine';
import type { SceneObject, Vec3, WorldState } from './engine';
import { SCENARIOS } from './scenarios';

export interface SceneValidation { valid: boolean; errors: string[] }
export interface SceneDraft { summary: string; world: WorldState | null; changes: string[]; error?: string }

const MAX_OBJECTS = 6;
const COUNTS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1 };
const COLORS: Record<string, string> = { red: '#e66c52', blue: '#5594c6', green: '#83a993' };
const INITIAL_SLOTS: Vec3[] = [[-0.65, 0.89, -0.64], [-0.12, 0.89, -0.64], [0.35, 0.89, -0.64], [-0.65, 0.89, 0.34], [-0.12, 0.89, 0.34], [0.35, 0.89, 0.34]];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isVector = (value: unknown): value is Vec3 => Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item));

/** Validates bounded initial workcell data. It is not a contact-dynamics or robot-safety validator. */
export function validateScene(value: unknown): SceneValidation {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['The scene must be a world-state object.'] };
  if (!Array.isArray(value.objects)) errors.push('The scene must contain an objects array.');
  if (!isRecord(value.robot)) errors.push('The scene must contain a robot state.');
  if (typeof value.simTime !== 'number' || !Number.isFinite(value.simTime) || value.simTime < 0) errors.push('Simulation time must be a finite nonnegative number.');
  if (!Number.isInteger(value.revision) || (value.revision as number) < 0) errors.push('The scene revision must be a nonnegative integer.');
  if (value.motion !== null) errors.push('An authored initial scene must not contain an active motion.');
  const objects = Array.isArray(value.objects) ? value.objects : [];
  if (objects.length > MAX_OBJECTS) errors.push(`This workcell supports at most ${MAX_OBJECTS} initial objects.`);
  const ids = new Set<string>();
  const geometricObjects: SceneObject[] = [];
  for (const [index, object] of objects.entries()) {
    if (!isRecord(object)) { errors.push(`Object ${index + 1} must be a structured scene object.`); continue; }
    const name = typeof object.label === 'string' && object.label ? object.label : `Object ${index + 1}`;
    if (typeof object.id !== 'string' || !object.id.trim()) errors.push(`${name} needs a nonempty object ID.`);
    else if (ids.has(object.id)) errors.push(`Duplicate object ID: ${object.id}.`);
    else ids.add(object.id);
    if (typeof object.label !== 'string' || !object.label.trim()) errors.push(`${name} needs a visible label.`);
    if (typeof object.color !== 'string' || !/^#[\da-f]{6}$/i.test(object.color)) errors.push(`${name} needs a six-digit hexadecimal color.`);
    if (!['cube', 'block', 'cylinder'].includes(String(object.kind))) errors.push(`${name} has an unsupported object type.`);
    if (!['table', 'tray-a', 'tray-b', 'reject'].includes(String(object.location))) errors.push(`${name} has an unknown location.`);
    if (!['ready', 'placed', 'rejected'].includes(String(object.status))) errors.push(`${name} must have an initial ready, placed, or rejected status.`);
    if (!isVector(object.position)) errors.push(`${name} needs three finite position coordinates.`);
    if (!isVector(object.size) || !(object.size as number[]).every(dimension => dimension >= 0.04 && dimension <= 0.6)) errors.push(`${name} needs supported positive rigid-object dimensions (0.04–0.60 m).`);
    if (isVector(object.position) && isVector(object.size) && object.size.every(dimension => dimension > 0)) {
      const [x, y, z] = object.position;
      if (Math.abs(x) + object.size[0] / 2 > 2.175 || Math.abs(z) + object.size[2] / 2 > 1.4) errors.push(`${name} extends beyond the tabletop.`);
      if (y - object.size[1] / 2 < TABLE_TOP - 0.005) errors.push(`${name} intersects the tabletop.`);
      geometricObjects.push(object as unknown as SceneObject);
    }
  }
  for (let i = 0; i < geometricObjects.length; i++) for (let j = i + 1; j < geometricObjects.length; j++) {
    const a = geometricObjects[i], b = geometricObjects[j];
    const overlapping = [0, 1, 2].every(axis => Math.abs(a.position[axis] - b.position[axis]) < (a.size[axis] + b.size[axis]) / 2 - 0.002);
    if (overlapping) errors.push(`${a.label} overlaps ${b.label} in the initial scene.`);
  }
  if (isRecord(value.robot)) {
    if (!isVector(value.robot.position)) errors.push('The robot needs three finite end-effector coordinates.');
    if (typeof value.robot.gripperOpen !== 'number' || !Number.isFinite(value.robot.gripperOpen) || value.robot.gripperOpen < 0 || value.robot.gripperOpen > 1) errors.push('Gripper opening must be between 0 and 1.');
    if (typeof value.robot.speed !== 'number' || !Number.isFinite(value.robot.speed) || value.robot.speed <= 0 || value.robot.speed > 3) errors.push('Simulation speed must be greater than 0 and no more than 3.');
    if (value.robot.mode !== 'idle') errors.push('An authored initial scene must have an idle controller.');
    if (value.robot.heldObjectId !== null) errors.push('An authored initial scene must have an empty gripper.');
    if (typeof value.robot.phase !== 'string') errors.push('The robot needs a controller phase label.');
  }
  return { valid: errors.length === 0, errors };
}

function invalid(error: string): SceneDraft { return { summary: 'The scene needs clarification.', world: null, changes: [], error }; }

/** Deterministic text-to-schema authoring for the supported tabletop template. */
export function draftSceneFromText(text: string, source?: WorldState): SceneDraft {
  const input = text.toLowerCase().trim().replace(/[.!?]+$/, '');
  if (!input) return invalid('Describe an initial scene, such as “Create a workcell with two red blocks and one blue block”.');
  const authorPrefix = '(?:create|build|set\\s+up|setup|make|generate)\\s+(?:(?:a|an|the)\\s+)?';
  const special = [
    { pattern: new RegExp(`^${authorPrefix}(?:reach[- ]limit|out[- ]of[- ]reach)\\s+(?:test|scenario|workcell|environment)$`), id: 'reach-limit' },
    { pattern: new RegExp(`^${authorPrefix}(?:occupied\\s+tray|full\\s+tray|tray[- ]capacity)\\s+(?:test|scenario|workcell|environment)$`), id: 'occupied-tray' },
    { pattern: new RegExp(`^${authorPrefix}baseline(?:\\s+sorting)?\\s+(?:test|scenario|workcell|environment)$`), id: 'baseline-sort' },
  ].find(candidate => candidate.pattern.test(input));
  if (special) {
    const scenario = SCENARIOS.find(candidate => candidate.id === special.id)!;
    const world = scenario.world();
    const validation = validateScene(world);
    if (!validation.valid) return invalid(validation.errors.join(' '));
    return { summary: `Drafted ${scenario.name.toLowerCase()}.`, world, changes: [scenario.description, `Loaded ${world.objects.length} visible rigid objects.`, 'Controller reset to its home pose; apply the draft before running a test.'] };
  }
  if (/\b(?:reach[- ]limit|out[- ]of[- ]reach|occupied\s+tray|full\s+tray)\b/.test(input)) return invalid('Use the complete supported template: “Create a reach-limit test” or “Create an occupied tray test”. Extra scene modifications need a separate supported draft.');
  if (/[-−]\s*\d|\b\d+\.\d+\b/.test(input)) return invalid('Object counts must be whole numbers from zero to six.');
  if (!new RegExp(`^${authorPrefix}`).test(input)) return invalid('Start with “Create”, “Build”, or “Set up”, then describe the supported workcell and blocks.');
  const unknownColor = input.match(/\b(yellow|orange|purple|pink|black|white|brown|gray|grey|violet)\b/);
  if (unknownColor) return invalid(`The authoring template supports red, blue, and green blocks. “${unknownColor[1]}” needs a different supported template.`);
  const colorCounts: Record<string, number> = { red: 0, blue: 0, green: 0 };
  const sequence: string[] = [];
  const phrase = /\b(?:(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s+)?(red|blue|green)\b(?:\s+(?:blocks?|parts?|cubes?))?/g;
  let match: RegExpExecArray | null;
  while ((match = phrase.exec(input))) {
    const count = match[1] ? COUNTS[match[1]] ?? Number(match[1]) : 1;
    if (!Number.isInteger(count) || count < 0 || count > MAX_OBJECTS) return invalid(`Choose at most ${MAX_OBJECTS} blocks in total.`);
    colorCounts[match[2]] += count;
    for (let i = 0; i < count; i++) sequence.push(match[2]);
  }
  if (sequence.length > MAX_OBJECTS) return invalid(`This workcell supports at most ${MAX_OBJECTS} blocks. Your draft requests ${sequence.length}.`);
  const isEmpty = /\bempty\b/.test(input);
  if (isEmpty && sequence.length) return invalid('The draft requests an empty workcell and also requests objects. Choose one initial state.');
  const unparsed = input.replace(phrase, ' ').replace(/\b(?:create|build|set|up|setup|make|generate|a|an|the|sorting|robot|robotic|arm|workcell|environment|scene|with|and|plus|on|tabletop|table|empty)\b/g, ' ').replace(/[\s,;:+]/g, '');
  if (unparsed) return invalid('This template supports a tabletop robot workcell with red, blue, and green rigid blocks. Additional objects, shapes, rooms, and physical properties need a supported template.');
  if (!isEmpty && !sequence.length) return invalid('Specify block counts and colors, or say “Create an empty workcell”.');
  const world = createInitialWorld();
  const colorIndex: Record<string, number> = { red: 0, blue: 0, green: 0 };
  world.objects = sequence.map((color, index): SceneObject => {
    const ordinal = ++colorIndex[color];
    const name = color.charAt(0).toUpperCase() + color.slice(1);
    return {
      id: `part-${color}${ordinal === 1 ? '' : `-${ordinal}`}`,
      label: `${name} block${colorCounts[color] > 1 ? ` ${ordinal}` : ''}`,
      color: COLORS[color],
      kind: 'cube',
      position: [...INITIAL_SLOTS[index]],
      size: [0.22, 0.22, 0.22],
      location: 'table',
      status: 'ready',
    };
  });
  const validation = validateScene(world);
  if (!validation.valid) return invalid(validation.errors.join(' '));
  const countLabel = Object.entries(colorCounts).filter(([, count]) => count > 0).map(([color, count]) => `${count} ${color}`).join(', ');
  return {
    summary: isEmpty ? 'Drafted an empty tabletop workcell.' : `Drafted a workcell with ${countLabel} block${sequence.length === 1 ? '' : 's'}.`,
    world,
    changes: [
      source ? `Replace the current ${source.objects.length}-object scene with ${world.objects.length} objects.` : `Create ${world.objects.length} visible rigid objects.`,
      ...(world.objects.length ? ['Place blocks in distinct, fixed tabletop slots with no initial object overlap.'] : []),
      'Keep the articulated arm and fixed tray A, tray B, and review destinations.',
      'Reset the controller and simulation clock; apply this draft explicitly to change the live scene.',
    ],
  };
}
