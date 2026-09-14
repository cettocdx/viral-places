import { afterEach, describe, expect, it } from 'vitest';
import { requireAdmin } from '@/lib/admin-auth';

const req = (headers: Record<string, string>) => new Request('http://x/api/v1/admin/jobs', { headers });
afterEach(() => { delete process.env.ADMIN_API_TOKEN; });

describe('requireAdmin', () => {
  it('token ayarlı değilse 503 (açık kalmaz); yanlış token 401; doğru token actor döner', () => {
    expect(() => requireAdmin(req({ 'x-admin-token': 'x' }))).toThrow(expect.objectContaining({ status: 503 }));
    process.env.ADMIN_API_TOKEN = 'a'.repeat(32);
    expect(() => requireAdmin(req({ 'x-admin-token': 'b'.repeat(32) }))).toThrow(expect.objectContaining({ status: 401 }));
    expect(() => requireAdmin(req({}))).toThrow(expect.objectContaining({ status: 401 }));
    expect(requireAdmin(req({ 'x-admin-token': 'a'.repeat(32), 'x-admin-actor-id': '11111111-1111-4111-8111-111111111111' })).actorId).toBe('11111111-1111-4111-8111-111111111111');
    expect(requireAdmin(req({ 'x-admin-token': 'a'.repeat(32) })).actorId).toBe('00000000-0000-0000-0000-000000000000');
  });
});
