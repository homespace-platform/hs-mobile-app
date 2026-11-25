import { Buffer } from 'buffer';
import { getRandomValues } from 'expo-crypto';
import { Linking } from 'react-native';
import type { createEVMClient } from '@metamask/connect-evm';
import { SEPOLIA_CHAIN_ID, isWalletAddress } from '@/lib/membership-eth-payment';

const DAPP_URL = 'https://www.homespace.id.vn';
let clientPromise: ReturnType<typeof createEVMClient> | undefined;

function walletClient() {
  clientPromise ??= (async () => {
    // Expo Crypto provides secure native randomness before the SDK is loaded.
    const globals = globalThis as unknown as { Buffer?: typeof Buffer; crypto?: { getRandomValues?: typeof getRandomValues } };
    globals.Buffer ??= Buffer;
    globals.crypto ??= {};
    globals.crypto.getRandomValues ??= getRandomValues;
    const browser = (globalThis.window ?? globalThis) as unknown as {
      addEventListener?: () => void;
      removeEventListener?: () => void;
      dispatchEvent?: () => boolean;
    };
    // Native dapp metadata comes from dapp.url. Expo needs the actual Metro URL for lazy imports.
    browser.addEventListener ??= () => {};
    browser.removeEventListener ??= () => {};
    browser.dispatchEvent ??= () => true;

    const { createEVMClient: create } = await import('@metamask/connect-evm');
    return create({
      dapp: { name: 'HomeSpace', url: DAPP_URL },
      api: { supportedNetworks: { [SEPOLIA_CHAIN_ID]: 'https://ethereum-sepolia-rpc.publicnode.com' } },
      ui: { preferExtension: false },
      mobile: { preferredOpenLink: (url) => Linking.openURL(url) },
    });
  })().catch((cause) => {
    clientPromise = undefined;
    throw cause;
  });
  return clientPromise;
}

export async function getSepoliaWallet(connect: boolean) {
  const client = await walletClient();
  const provider = client.getProvider();
  if (connect) await client.connect({ chainIds: [SEPOLIA_CHAIN_ID] });
  const chainId = await provider.request({ method: 'eth_chainId' });
  const accounts = await provider.request({ method: 'eth_accounts' });
  const account = Array.isArray(accounts) ? accounts[0] : null;
  if (chainId !== SEPOLIA_CHAIN_ID || !isWalletAddress(account)) {
    throw new Error('Hãy kết nối MetaMask với mạng Ethereum Sepolia và thử lại.');
  }
  return { provider, account: account.toLowerCase() };
}

export function encodeWalletMessage(message: string) {
  return `0x${Buffer.from(message, 'utf8').toString('hex')}`;
}
