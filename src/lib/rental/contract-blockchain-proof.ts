// Port of hs-web-app lib/contract-blockchain-proof.ts (hashPdfForProof uses expo-crypto instead of crypto.subtle).
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import type { BlockchainProofStatus } from '@/types/rental/blockchain.type';

export const blockchainProofPending = (status?: BlockchainProofStatus | null) =>
  status === 'PENDING' || status === 'SUBMITTED';

export function supportsContractProof(contract: {
  parentContractId?: string | null;
  agreementKind?: string | null;
}): boolean {
  return contract.parentContractId
    ? !contract.agreementKind ||
        ['AMENDMENT', 'RENEWAL', 'WORKFLOW'].includes(contract.agreementKind)
    : !contract.agreementKind ||
        contract.agreementKind === 'LEASE' ||
        contract.agreementKind === 'DEPOSIT';
}

export function blockchainTransactionUrl(
  chainId?: number | null,
  transactionHash?: string | null
): string | undefined {
  if (chainId !== 11155111 || !transactionHash || !/^0x[0-9a-fA-F]{64}$/.test(transactionHash))
    return undefined;
  return `https://sepolia.etherscan.io/tx/${transactionHash}`;
}

export async function hashPdfForProof(file: Pick<File, 'size' | 'arrayBuffer'>): Promise<string> {
  if (file.size === 0) throw new Error('Tệp đang trống. Hãy chọn bản PDF đã ký.');
  if (file.size > 20 * 1024 * 1024)
    throw new Error('Hãy chọn PDF không quá 20 MB để đối chiếu trong trình duyệt.');
  // A typed array: the Android digest does not accept a bare ArrayBuffer.
  const bytes = new Uint8Array(await file.arrayBuffer());
  let hashed: ArrayBuffer;
  try {
    hashed = await digest(CryptoDigestAlgorithm.SHA256, bytes);
  } catch {
    throw new Error(
      'Trình duyệt chưa hỗ trợ tính hash ở địa chỉ này. Hãy dùng HTTPS hoặc localhost.'
    );
  }
  return (
    '0x' + Array.from(new Uint8Array(hashed), (byte) => byte.toString(16).padStart(2, '0')).join('')
  );
}
