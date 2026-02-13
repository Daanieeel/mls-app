'use client';

import type { ApiClient } from '@repo/api';
import {
  acceptAll,
  type ClientState,
  type Credential,
  createApplicationMessage,
  createCommit,
  createGroup,
  decodeGroupState,
  decodeMlsMessage,
  defaultAuthenticationService,
  defaultCapabilities,
  defaultKeyPackageEqualityConfig,
  defaultKeyRetentionConfig,
  defaultLifetime,
  defaultLifetimeConfig,
  defaultPaddingConfig,
  emptyPskIndex,
  encodeGroupState,
  encodeMlsMessage,
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  type KeyPackage,
  type PrivateKeyPackage,
  type Proposal,
  processPrivateMessage,
  zeroOutUint8Array,
} from 'ts-mls';

const KEY_PACKAGE_STORAGE_KEY = 'mls_key_packages_v1';
const GROUP_STATE_STORAGE_KEY = 'mls_group_states_v1';
const DEFAULT_KEY_PACKAGE_BUFFER = 20;

interface StoredPrivateKeyPackage {
  initPrivateKey: string;
  hpkePrivateKey: string;
  signaturePrivateKey: string;
}

interface StoredKeyPackageRecord {
  userId: string;
  uploadedPayload: string;
  privatePackage: StoredPrivateKeyPackage;
}

type GroupStateStorage = Record<string, string>;

type KeyPackageStorage = StoredKeyPackageRecord[];

interface KeyPackagesCountApi {
  count: {
    get: () => Promise<{ data?: { count?: number } }>;
  };
  upload: {
    post: (body: {
      keyPackages: Array<{ payload: string }>;
    }) => Promise<unknown>;
  };
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let cipherSuitePromise: ReturnType<typeof getCiphersuiteImpl> | null = null;

const defaultClientConfig = {
  authService: defaultAuthenticationService,
  keyRetentionConfig: defaultKeyRetentionConfig,
  lifetimeConfig: defaultLifetimeConfig,
  keyPackageEqualityConfig: defaultKeyPackageEqualityConfig,
  paddingConfig: defaultPaddingConfig,
};

function getStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors.
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes.at(i) ?? 0);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function serializePrivateKeyPackage(value: PrivateKeyPackage): StoredPrivateKeyPackage {
  return {
    initPrivateKey: uint8ArrayToBase64(value.initPrivateKey),
    hpkePrivateKey: uint8ArrayToBase64(value.hpkePrivateKey),
    signaturePrivateKey: uint8ArrayToBase64(value.signaturePrivateKey),
  };
}

function deserializePrivateKeyPackage(value: StoredPrivateKeyPackage): PrivateKeyPackage {
  return {
    initPrivateKey: base64ToUint8Array(value.initPrivateKey),
    hpkePrivateKey: base64ToUint8Array(value.hpkePrivateKey),
    signaturePrivateKey: base64ToUint8Array(value.signaturePrivateKey),
  };
}

async function getCipherSuite() {
  if (!cipherSuitePromise) {
    cipherSuitePromise = getCiphersuiteImpl(
      getCiphersuiteFromName('MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519'),
    );
  }
  return cipherSuitePromise;
}

function parseMlsMessage(payloadBase64: string) {
  const bytes = base64ToUint8Array(payloadBase64);
  return decodeMlsMessage(bytes, 0)?.[0];
}

function loadGroupState(groupId: string): ClientState | null {
  const groupStates = getStorage<GroupStateStorage>(GROUP_STATE_STORAGE_KEY, {});
  const rawState = groupStates[groupId];
  if (!rawState) return null;

  try {
    const parsed = decodeGroupState(base64ToUint8Array(rawState), 0)?.[0];
    if (!parsed) {
      return null;
    }

    return {
      ...parsed,
      clientConfig: defaultClientConfig,
    };
  } catch {
    return null;
  }
}

function saveGroupState(groupId: string, state: ClientState) {
  const groupStates = getStorage<GroupStateStorage>(GROUP_STATE_STORAGE_KEY, {});
  groupStates[groupId] = uint8ArrayToBase64(encodeGroupState(state));
  setStorage(GROUP_STATE_STORAGE_KEY, groupStates);
}

function removeStoredKeyPackage(userId: string, uploadedPayload: string) {
  const records = getStorage<KeyPackageStorage>(KEY_PACKAGE_STORAGE_KEY, []);
  const next = records.filter((record) => {
    return !(record.userId === userId && record.uploadedPayload === uploadedPayload);
  });
  setStorage(KEY_PACKAGE_STORAGE_KEY, next);
}

function getStoredKeyPackagesForUser(userId: string): StoredKeyPackageRecord[] {
  const records = getStorage<KeyPackageStorage>(KEY_PACKAGE_STORAGE_KEY, []);
  return records.filter((record) => record.userId === userId);
}

function appendStoredKeyPackages(records: StoredKeyPackageRecord[]) {
  if (records.length === 0) return;

  const current = getStorage<KeyPackageStorage>(KEY_PACKAGE_STORAGE_KEY, []);
  setStorage(KEY_PACKAGE_STORAGE_KEY, [...current, ...records]);
}

function createCredential(identity: string): Credential {
  return {
    credentialType: 'basic',
    identity: textEncoder.encode(identity),
  };
}

function decodeClaimedKeyPackage(payloadBase64: string): KeyPackage {
  const decoded = parseMlsMessage(payloadBase64);
  if (!decoded || decoded.wireformat !== 'mls_key_package') {
    throw new Error('Claimed key package payload is invalid');
  }
  return decoded.keyPackage;
}

async function generateAndStoreKeyPackages(userId: string, count: number) {
  if (count <= 0) return [] as string[];

  const cipherSuite = await getCipherSuite();
  const credential = createCredential(userId);

  const uploadedPayloads: string[] = [];
  const records: StoredKeyPackageRecord[] = [];

  for (let i = 0; i < count; i += 1) {
    const generated = await generateKeyPackage(
      credential,
      defaultCapabilities(),
      defaultLifetime,
      [],
      cipherSuite,
    );

    const encodedPublic = encodeMlsMessage({
      keyPackage: generated.publicPackage,
      wireformat: 'mls_key_package',
      version: 'mls10',
    });

    const uploadedPayload = uint8ArrayToBase64(encodedPublic);
    uploadedPayloads.push(uploadedPayload);

    records.push({
      userId,
      uploadedPayload,
      privatePackage: serializePrivateKeyPackage(generated.privatePackage),
    });
  }

  appendStoredKeyPackages(records);
  return uploadedPayloads;
}

export async function ensureMlsKeyPackageBuffer(api: ApiClient, userId: string): Promise<void> {
  const keyPackagesApi = (api as unknown as { 'key-packages'?: KeyPackagesCountApi })[
    'key-packages'
  ];

  if (!keyPackagesApi) return;

  try {
    const countResult = await keyPackagesApi.count.get();
    const availableOnServer = Number(
      (countResult?.data as { count?: number } | undefined)?.count ?? 0,
    );
    const needed = Math.max(0, DEFAULT_KEY_PACKAGE_BUFFER - availableOnServer);

    if (needed === 0) return;

    const newPayloads = await generateAndStoreKeyPackages(userId, needed);

    if (newPayloads.length > 0) {
      await keyPackagesApi.upload.post({
        keyPackages: newPayloads.map((payload) => ({ payload })),
      });
    }
  } catch (error) {
    console.warn('[MLS] Failed to ensure key package buffer:', error);
  }
}

/**
 * Re-key MLS group state from a temporary/placeholder group ID to the actual
 * server-assigned group ID. Must be called after the server returns the real ID.
 */
export function reKeyGroupState(tempGroupId: string, realGroupId: string): void {
  const groupStates = getStorage<GroupStateStorage>(GROUP_STATE_STORAGE_KEY, {});
  const stateData = groupStates[tempGroupId];
  if (!stateData) {
    console.warn('[MLS] reKeyGroupState: no state found for temp ID', tempGroupId);
    return;
  }
  groupStates[realGroupId] = stateData;
  delete groupStates[tempGroupId];
  setStorage(GROUP_STATE_STORAGE_KEY, groupStates);
  console.log('[MLS] reKeyGroupState: moved state from', tempGroupId, 'to', realGroupId);
}

export async function createWelcomeForNewGroup(options: {
  groupId: string;
  creatorUserId: string;
  memberKeyPackagePayloads: string[];
}): Promise<string> {
  const { groupId, creatorUserId, memberKeyPackagePayloads } = options;
  const cipherSuite = await getCipherSuite();

  const creatorCredential = createCredential(creatorUserId);
  const creatorKeys = await generateKeyPackage(
    creatorCredential,
    defaultCapabilities(),
    defaultLifetime,
    [],
    cipherSuite,
  );

  let creatorState = await createGroup(
    textEncoder.encode(groupId),
    creatorKeys.publicPackage,
    creatorKeys.privatePackage,
    [],
    cipherSuite,
  );

  const proposals: Proposal[] = memberKeyPackagePayloads.map((payload) => ({
    proposalType: 'add',
    add: {
      keyPackage: decodeClaimedKeyPackage(payload),
    },
  }));

  const commit = await createCommit(
    {
      state: creatorState,
      cipherSuite,
      pskIndex: emptyPskIndex,
    },
    {
      extraProposals: proposals,
      ratchetTreeExtension: true,
    },
  );

  creatorState = commit.newState;
  saveGroupState(groupId, creatorState);

  if (!commit.welcome) {
    throw new Error('MLS commit did not include a welcome message');
  }

  const welcomePayload = encodeMlsMessage({
    wireformat: 'mls_welcome',
    version: 'mls10',
    welcome: commit.welcome,
  });

  commit.consumed.forEach(zeroOutUint8Array);

  return uint8ArrayToBase64(welcomePayload);
}

export async function processWelcomeMessage(options: {
  groupId: string;
  payloadBase64: string;
  userId: string;
}): Promise<boolean> {
  const { groupId, payloadBase64, userId } = options;

  const decoded = parseMlsMessage(payloadBase64);
  if (!decoded || decoded.wireformat !== 'mls_welcome') {
    return false;
  }

  const cipherSuite = await getCipherSuite();
  const records = getStoredKeyPackagesForUser(userId);

  for (const record of records) {
    try {
      const parsedKeyPackage = parseMlsMessage(record.uploadedPayload);
      if (!parsedKeyPackage || parsedKeyPackage.wireformat !== 'mls_key_package') {
        continue;
      }

      const joinedState = await joinGroup(
        decoded.welcome,
        parsedKeyPackage.keyPackage,
        deserializePrivateKeyPackage(record.privatePackage),
        emptyPskIndex,
        cipherSuite,
      );

      saveGroupState(groupId, joinedState);
      removeStoredKeyPackage(userId, record.uploadedPayload);
      return true;
    } catch {
      // Try the next local key package until one matches the welcome.
    }
  }

  return false;
}

export async function encryptOutgoingMessagePayload(
  groupId: string,
  plainText: string,
): Promise<string> {
  const state = loadGroupState(groupId);
  if (!state) {
    console.log('[MLS] encryptOutgoingMessagePayload: no group state, falling back to btoa()', {
      groupId,
      plainTextPreview: plainText.substring(0, 80),
    });
    return btoa(plainText);
  }

  console.log('[MLS] encryptOutgoingMessagePayload: encrypting with MLS', { groupId });
  const cipherSuite = await getCipherSuite();
  const result = await createApplicationMessage(state, textEncoder.encode(plainText), cipherSuite);

  saveGroupState(groupId, result.newState);

  const encodedMessage = encodeMlsMessage({
    wireformat: 'mls_private_message',
    version: 'mls10',
    privateMessage: result.privateMessage,
  });

  result.consumed.forEach(zeroOutUint8Array);

  const outPayload = uint8ArrayToBase64(encodedMessage);
  console.log('[MLS] encryptOutgoingMessagePayload: encrypted', {
    groupId,
    outPayloadLength: outPayload.length,
    outPayloadPreview: outPayload.substring(0, 80),
  });

  return outPayload;
}

export async function decryptIncomingMessagePayload(
  groupId: string,
  payloadBase64: string,
): Promise<string | null> {
  const state = loadGroupState(groupId);
  if (!state) {
    console.log('[MLS] decryptIncomingMessagePayload: no group state', {
      groupId,
      payloadPreview: payloadBase64.substring(0, 80),
    });
    return null;
  }

  console.log('[MLS] decryptIncomingMessagePayload: attempting MLS decrypt', {
    groupId,
    payloadLength: payloadBase64.length,
    payloadPreview: payloadBase64.substring(0, 80),
  });

  const decoded = parseMlsMessage(payloadBase64);
  if (!decoded || decoded.wireformat !== 'mls_private_message') {
    console.log('[MLS] decryptIncomingMessagePayload: not an MLS private message', {
      wireformat: decoded?.wireformat ?? 'decode-failed',
    });
    return null;
  }

  const cipherSuite = await getCipherSuite();

  const processed = await processPrivateMessage(
    state,
    decoded.privateMessage,
    emptyPskIndex,
    cipherSuite,
    acceptAll,
  );

  saveGroupState(groupId, processed.newState);
  processed.consumed.forEach(zeroOutUint8Array);

  if (processed.kind !== 'applicationMessage') {
    console.log('[MLS] decryptIncomingMessagePayload: processed but not applicationMessage', {
      kind: processed.kind,
    });
    return null;
  }

  const decryptedText = textDecoder.decode(processed.message);
  console.log('[MLS] decryptIncomingMessagePayload: success', {
    decryptedPreview: decryptedText.substring(0, 80),
  });
  return decryptedText;
}
