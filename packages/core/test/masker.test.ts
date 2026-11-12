import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMasker, MemoryVault } from '../src';

const yml = `spring:
  datasource:
    password: Claude123
aws:
  access-key: AKIAABCDEFGHIJKLMNOP
kafka:
  sasl-password: \${KAFKA_PWD}
db: jdbc:postgresql://app:hunter22@db:5432/x
`;

test('masks secrets and round-trips exactly', () => {
  const m = createMasker(new MemoryVault());
  const masked = m.mask(yml);
  assert.ok(!masked.includes('Claude123'));
  assert.ok(!masked.includes('AKIAABCDEFGHIJKLMNOP'));
  assert.ok(!masked.includes('hunter22'));
  assert.equal(m.unmask(masked), yml);
});

test('leaves placeholders alone', () => {
  const m = createMasker(new MemoryVault());
  assert.ok(m.mask(yml).includes('${KAFKA_PWD}'));
});

test('same secret gives same token everywhere', () => {
  const m = createMasker(new MemoryVault());
  const a = m.mask('password=Claude123');
  const b = m.mask('String copy = "Claude123";'); // no secret-ish key name
  const tok = a.split('=')[1];
  assert.match(tok, /^SECRET_[0-9a-f]{16}$/);
  assert.equal(b, `String copy = "${tok}";`);
});

test('masking is idempotent', () => {
  const m = createMasker(new MemoryVault());
  const once = m.mask(yml);
  assert.equal(m.mask(once), once);
});

test('different keys give different tokens', () => {
  const a = createMasker(new MemoryVault('k1')).mask('password=Claude123');
  const b = createMasker(new MemoryVault('k2')).mask('password=Claude123');
  assert.notEqual(a, b);
});

test('unknown tokens are left untouched', () => {
  const m = createMasker(new MemoryVault());
  assert.equal(m.unmask('x=SECRET_0000000000000000'), 'x=SECRET_0000000000000000');
});
