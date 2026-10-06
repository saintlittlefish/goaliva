const test = require('node:test');
const assert = require('node:assert/strict');
const { sessionLengthInput, parseSessionMinutes } = require('./sessionLength.ts');

test('deleting the duration leaves an empty draft instead of inserting 1', () => {
  assert.equal(sessionLengthInput(''), '');
  assert.equal(parseSessionMinutes(''), null);
});
test('clearing and retyping accepts any positive whole-number duration', () => {
  for (const value of ['2', '5', '25', '30', '45', '90', '120']) {
    assert.equal(parseSessionMinutes(sessionLengthInput(value)), Number(value));
  }
});
test('input stays textual until save, including zero and leading zeroes', () => {
  assert.equal(sessionLengthInput('0'), '0');
  assert.equal(sessionLengthInput('005'), '005');
  assert.equal(parseSessionMinutes('005'), 5);
  assert.equal(sessionLengthInput('25 min'), '25');
});
test('saving rejects missing, zero, negative, fractional and unsafe values', () => {
  for (const value of ['', '0', '000', '-2', '2.5', 'abc', '9007199254740992']) assert.equal(parseSessionMinutes(value), null);
});
