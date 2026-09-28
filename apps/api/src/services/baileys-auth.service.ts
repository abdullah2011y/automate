import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  SignalDataTypeMap,
  SignalKeyStoreWithTransaction,
} from '@whiskeysockets/baileys';
import { prisma } from '../db/prisma';
import { encryptCredential, decryptCredential } from '../utils/crypto';

/**
 * Custom PostgreSQL Authentication State Adapter for Baileys Multi-Device.
 * Stores credentials and signal key pairs encrypted with AES-256-GCM in PostgreSQL,
 * ensuring zero session loss across Northflank container restarts.
 */
export async function usePostgresAuthState(
  sessionId = 'default'
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearSession: () => Promise<void>;
}> {
  // 1. Fetch or initialize root credentials
  let creds: AuthenticationCreds;
  const credsRecord = await prisma.whatsAppSession.findUnique({
    where: {
      sessionId_key: {
        sessionId,
        key: 'creds',
      },
    },
  });

  if (credsRecord && credsRecord.data) {
    try {
      const decrypted = decryptCredential(credsRecord.data);
      creds = JSON.parse(decrypted, BufferJSON.reviver);
    } catch (err) {
      console.warn('[Baileys Auth] Failed to decrypt saved credentials, generating fresh credentials:', err);
      creds = initAuthCreds();
    }
  } else {
    creds = initAuthCreds();
  }

  // 2. Define signal keys store
  const keys: SignalKeyStoreWithTransaction = {
    get: async <T extends keyof SignalDataTypeMap>(
      type: T,
      ids: string[]
    ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
      const result: { [id: string]: SignalDataTypeMap[T] } = {};

      if (ids.length === 0) return result;

      // Construct DB keys: e.g. "pre-key_1", "session_923001234567@s.whatsapp.net"
      const dbKeys = ids.map((id) => `${type}_${id}`);

      const records = await prisma.whatsAppSession.findMany({
        where: {
          sessionId,
          key: { in: dbKeys },
        },
      });

      for (const record of records) {
        try {
          const rawId = record.key.replace(`${type}_`, '');
          const decrypted = decryptCredential(record.data);
          const value = JSON.parse(decrypted, BufferJSON.reviver);
          result[rawId] = value;
        } catch (err) {
          console.error(`[Baileys Auth] Error decrypting key ${record.key}:`, err);
        }
      }

      return result;
    },

    set: async (data: any): Promise<void> => {
      const tasks: Promise<any>[] = [];

      for (const category of Object.keys(data)) {
        const categoryData = data[category];
        for (const id of Object.keys(categoryData)) {
          const value = categoryData[id];
          const dbKey = `${category}_${id}`;

          if (value === null || value === undefined) {
            // Delete key
            tasks.push(
              prisma.whatsAppSession
                .deleteMany({
                  where: { sessionId, key: dbKey },
                })
                .catch(() => {})
            );
          } else {
            // Upsert encrypted key
            const serialized = JSON.stringify(value, BufferJSON.replacer);
            const encrypted = encryptCredential(serialized);

            tasks.push(
              prisma.whatsAppSession.upsert({
                where: {
                  sessionId_key: { sessionId, key: dbKey },
                },
                update: {
                  data: encrypted,
                },
                create: {
                  sessionId,
                  key: dbKey,
                  data: encrypted,
                },
              })
            );
          }
        }
      }

      await Promise.all(tasks);
    },

    isInTransaction: () => false,
    transaction: async <T>(work: () => Promise<T>): Promise<T> => {
      return await work();
    },
  };

  // 3. Save root credentials function
  const saveCreds = async () => {
    try {
      const serialized = JSON.stringify(creds, BufferJSON.replacer);
      const encrypted = encryptCredential(serialized);

      await prisma.whatsAppSession.upsert({
        where: {
          sessionId_key: { sessionId, key: 'creds' },
        },
        update: {
          data: encrypted,
        },
        create: {
          sessionId,
          key: 'creds',
          data: encrypted,
        },
      });
    } catch (err) {
      console.error('[Baileys Auth] Failed to save credentials to PostgreSQL:', err);
    }
  };

  // 4. Wipe session completely (used upon logout)
  const clearSession = async () => {
    try {
      await prisma.whatsAppSession.deleteMany({
        where: { sessionId },
      });
      console.log(`[Baileys Auth] Cleared all session keys for sessionId: ${sessionId}`);
    } catch (err) {
      console.error('[Baileys Auth] Failed to clear session from PostgreSQL:', err);
    }
  };

  return {
    state: {
      creds,
      keys,
    },
    saveCreds,
    clearSession,
  };
}
