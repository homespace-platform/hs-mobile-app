import type { getSepoliaWallet as nativeWallet } from './metamask-wallet.native';

export const getSepoliaWallet: typeof nativeWallet = async () => {
  throw new Error('Mở HomeSpace trên điện thoại để kết nối MetaMask.');
};

export function encodeWalletMessage(_message: string): string {
  throw new Error('Mở HomeSpace trên điện thoại để ký bằng MetaMask.');
}
