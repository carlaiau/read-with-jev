import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayBookTitle, displayCharacterName } from '../src/lib/reader-labels';

test('display titles remove Gutenberg additions and formatting without losing meaningful names', () => {
  assert.equal(displayBookTitle('Pride and Prejudice · Gutenberg 1342'), 'Pride and Prejudice');
  assert.equal(displayBookTitle('The Complete Project Gutenberg Works of Jane Austen'), 'The Complete Works of Jane Austen');
  assert.equal(displayBookTitle('\uFEFF_Alice’s Adventures_\u200B'), "Alice's Adventures");
  assert.equal(displayBookTitle('Arsène Lupin — Volume 1'), 'Arsène Lupin - Volume 1');
});

test('character labels hide scope suffixes while keeping names and identities intact', () => {
  const character={name:'Anne Elliot · Persuasion',scope:'Persuasion'};
  assert.equal(displayCharacterName(character),'Anne Elliot');
  assert.equal(character.name,'Anne Elliot · Persuasion');
  assert.equal(displayCharacterName({name:'Mr. Darcy',scope:'book'}),'Mr. Darcy');
  assert.equal(displayCharacterName({name:'A · B',scope:'Other'}),'A · B');
});
