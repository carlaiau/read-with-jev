import test from 'node:test';
import assert from 'node:assert/strict';
import { readerText, readerSegments } from '../src/lib/reader-text';

test('detokenization cleans display without changing the source or paragraph boundaries', () => {
  const source = '“ My dear Mr. Bennet , ”\nMrs. Bennet ’ s drawing - room .';
  assert.equal(readerText(source, true), '“My dear Mr. Bennet,”\nMrs. Bennet’s drawing-room.');
  assert.equal(source, '“ My dear Mr. Bennet , ”\nMrs. Bennet ’ s drawing - room .');
  assert.equal(readerText(source, false), source);
});

test('Gutenberg emphasis preserves words and surrounding spacing in both editions', () => {
  for (const tokenized of [true, false]) {
    const source = tokenized ? 'Compliments take _ you _ by surprise, and _ me _ never.' : 'Compliments take _you_ by surprise, and _me_ never.';
    const parts = readerSegments(source, tokenized);
    assert.equal(parts.map(p => p.text).join(''), 'Compliments take you by surprise, and me never.');
    assert.deepEqual(parts.filter(p => p.emphasis).map(p => p.text), ['you', 'me']);
  }
  assert.equal(readerSegments('“ _ I _ did for you . ”', true).map(p => p.text).join(''), '“I did for you.”');
  assert.equal(readerSegments('unpaired _ marker', false).map(p => p.text).join(''), 'unpaired _ marker');
});
