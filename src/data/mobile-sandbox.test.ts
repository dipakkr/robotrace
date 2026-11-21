import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueSandboxTask, reorderSandboxTask, sandboxTaskCommand } from './mobile-sandbox';
import { createMobileKitchen } from '../sim/mobile-navigation';

test('pending instructions reorder without changing identity or inventing stale source positions', () => {
  const world = createMobileKitchen();
  let queue = enqueueSandboxTask([], sandboxTaskCommand(world, 'cup', 'sink'));
  queue = enqueueSandboxTask(queue, sandboxTaskCommand(world, 'cup', 'table'));
  const original = [...queue];
  const reordered = reorderSandboxTask(queue, queue[1].id, -1);
  assert.deepEqual(reordered.map(item => item.command), ['Take Cup to Table', 'Take Cup to Sink']);
  assert.equal(reordered[1].id, original[0].id); assert.deepEqual(queue, original);
  assert.equal(reorderSandboxTask(queue, 'missing', 1), queue);
  assert.throws(() => sandboxTaskCommand(world, 'cup', 'home'));
});
test('queue bounds reject excess tasks without discarding accepted work', () => {
  let queue = enqueueSandboxTask([], '  Take cup to sink  ');
  assert.equal(queue[0].command, 'Take cup to sink');
  while (queue.length < 12) queue = enqueueSandboxTask(queue, 'Take bowl to table');
  assert.throws(() => enqueueSandboxTask(queue, 'Go Home'), /12/);
  assert.throws(() => enqueueSandboxTask([], ' ')); assert.throws(() => enqueueSandboxTask([], 'x'.repeat(251)));
  assert.equal(queue.length, 12);
});
