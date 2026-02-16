import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublishedSnapshotByToken, getExistingPublish } from './publishService';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function createQueryBuilder(): QueryBuilder {
  return {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
}

describe('publishService', () => {
  const mockFrom = vi.mocked(supabase.from);
  const mockRpc = vi.mocked(supabase.rpc);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('short-circuits getExistingPublish when IDs are missing', async () => {
    await expect(getExistingPublish('', 'user-1')).resolves.toBeNull();
    await expect(getExistingPublish('project-1', '')).resolves.toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns existing publish URL for owner project', async () => {
    const query = createQueryBuilder();
    query.select.mockReturnThis();
    query.eq.mockReturnThis();
    query.maybeSingle.mockResolvedValueOnce({
      data: { share_token: 'token-123', is_active: true },
      error: null,
    });
    mockFrom.mockReturnValueOnce(query as never);

    const result = await getExistingPublish('project-1', 'user-1');

    expect(result).toEqual({
      shareToken: 'token-123',
      url: `${window.location.origin}/published?token=token-123`,
      isActive: true,
    });
  });

  it('throws when published snapshot payload shape is invalid', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { name: 'Bad Snapshot', objects: [] },
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    });

    await expect(fetchPublishedSnapshotByToken('token-abc')).rejects.toThrow(
      'Invalid published snapshot: missing steps.'
    );
  });
});
