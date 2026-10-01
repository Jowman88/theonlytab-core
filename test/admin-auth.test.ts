import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../src/app/api/admin/revert-to-house/route';
import { isValidAdminSecret } from '../src/lib/adminAuth';

test('admin secret validation rejects missing configuration and credentials', () => {
  assert.equal(isValidAdminSecret(undefined, 'secret'), false);
  assert.equal(isValidAdminSecret('secret', null), false);
  assert.equal(isValidAdminSecret('secret', ''), false);
});

test('admin secret validation accepts only an exact match', () => {
  assert.equal(isValidAdminSecret('strong-secret', 'strong-secret'), true);
  assert.equal(isValidAdminSecret('strong-secret', 'incorrect-secret'), false);
});

test('admin revert endpoint rejects missing and incorrect credentials', async () => {
  const configuredSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = 'configured-secret';
  try {
    const missingSecretResponse = await POST(new Request('http://localhost/api/admin/revert-to-house', { method: 'POST' }));
    const wrongSecretResponse = await POST(new Request('http://localhost/api/admin/revert-to-house', {
      method: 'POST',
      headers: { 'X-Admin-Secret': 'wrong-secret' },
    }));

    assert.equal(missingSecretResponse.status, 401);
    assert.equal(wrongSecretResponse.status, 401);
  } finally {
    if (configuredSecret === undefined) {
      delete process.env.ADMIN_SECRET;
    } else {
      process.env.ADMIN_SECRET = configuredSecret;
    }
  }
});
