import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const readerSource = readFileSync(new URL('../assets/reader.js', import.meta.url), 'utf8');

class FakeClassList {
  constructor() { this.names = new Set(); }
  add(name) { this.names.add(name); }
  remove(name) { this.names.delete(name); }
  contains(name) { return this.names.has(name); }
  toggle(name, force) {
    if (force === undefined) force = !this.names.has(name);
    if (force) this.names.add(name);
    else this.names.delete(name);
    return force;
  }
}

class FakeElement {
  constructor() {
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.hovered = false;
    this.offsetWidth = 400;
    this.offsetHeight = 430;
    this.scrollTop = 0;
    this.innerHTML = '';
  }
  addEventListener(type, listener) {
    (this.listeners[type] ||= []).push(listener);
  }
  dispatch(type) {
    const event = { target: this, stopPropagation() {} };
    for (const listener of this.listeners[type] || []) listener(event);
  }
  getBoundingClientRect() {
    return { left: 100, top: 100, bottom: 120 };
  }
  matches(selector) { return selector === ':hover' && this.hovered; }
  contains(target) { return target === this; }
}

function makeHarness() {
  const passage = new FakeElement();
  const pop = new FakeElement();
  const span = new FakeElement();
  span.dataset.ids = 'device-1';

  const cards = {
    'device-1': { family: 'trope', name: 'Metaphor', definition: 'A comparison.' }
  };
  const data = { textContent: JSON.stringify(cards) };
  const documentListeners = {};
  const document = {
    documentElement: { clientWidth: 1200 },
    getElementById(id) {
      return { 'reader-data': data, passage, pop }[id];
    },
    querySelectorAll(selector) {
      if (selector === '.seg.tagged' || selector === '.seg') return [span];
      return [];
    },
    addEventListener(type, listener) {
      (documentListeners[type] ||= []).push(listener);
    }
  };
  const window = {
    scrollX: 0,
    scrollY: 0,
    innerHeight: 900,
    setTimeout,
    clearTimeout
  };

  runInNewContext(readerSource, { document, window, console });
  return { pop, span };
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('hover card stays open while the pointer moves from its trigger into the card', async () => {
  const { pop, span } = makeHarness();

  span.dispatch('mouseenter');
  assert.equal(pop.classList.contains('show'), true);

  span.dispatch('mouseleave');
  await wait(50);
  pop.hovered = true;
  pop.dispatch('mouseenter');
  await wait(320);

  assert.equal(pop.classList.contains('show'), true);
  pop.scrollTop = 80;
  assert.equal(pop.scrollTop, 80);

  pop.hovered = false;
  pop.dispatch('mouseleave');
  await wait(320);
  assert.equal(pop.classList.contains('show'), false);
});

test('a pinned hover card ignores pointer exits until it is released', async () => {
  const { pop, span } = makeHarness();

  span.dispatch('mouseenter');
  span.dispatch('click');
  span.dispatch('mouseleave');
  pop.dispatch('mouseleave');
  await wait(320);

  assert.equal(pop.classList.contains('show'), true);
  span.dispatch('click');
  assert.equal(pop.classList.contains('show'), false);
});
