import type { PrismaClient } from '@prisma/client';

import { withSerializableTransaction } from './serializable-transaction';

describe('withSerializableTransaction', () => {
  it('retries a structurally identified P2034 error from the Prisma runtime', async () => {
    const runtimeConflict = Object.assign(new Error('write conflict'), { code: 'P2034' });
    const transactionMock = jest
      .fn()
      .mockRejectedValueOnce(runtimeConflict)
      .mockResolvedValueOnce('completed');
    const prisma = {
      $transaction: transactionMock,
    } as unknown as PrismaClient;

    await expect(
      withSerializableTransaction(prisma, () => Promise.resolve('completed')),
    ).resolves.toBe('completed');
    expect(transactionMock).toHaveBeenCalledTimes(2);
  });
});
