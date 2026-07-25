import type { Prisma, PrismaClient } from '@prisma/client';

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

  it('passes an explicit timeout to the interactive Prisma transaction', async () => {
    const transactionMock = jest.fn().mockImplementation(
      async (
        operation: (transaction: Prisma.TransactionClient) => Promise<string>,
      ): Promise<string> => operation({} as Prisma.TransactionClient),
    );
    const prisma = {
      $transaction: transactionMock,
    } as unknown as PrismaClient;

    await expect(
      withSerializableTransaction(
        prisma,
        () => Promise.resolve('completed'),
        3,
        120_000,
      ),
    ).resolves.toBe('completed');
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      timeout: 120_000,
    });
  });
});
