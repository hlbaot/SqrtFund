import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createPublicClient, http, isAddress, parseAbi, zeroAddress } from 'viem';
import { avalancheFuji } from 'viem/chains';

// Public, read-only preflight. Never load a signer or print credentials from .env.
const config = {};
for (const file of ['.env', '.env.local']) {
  const path = new URL(`../${file}`, import.meta.url);
  if (existsSync(path)) Object.assign(config, parseEnv(readFileSync(path, 'utf8')));
}
Object.assign(config, process.env);
const factory = process.argv[2] ?? config.NEXT_PUBLIC_FACTORY_ADDRESS;
const wallet = process.argv[3] ?? zeroAddress;
if (!isAddress(factory) || !isAddress(wallet)) {
  console.error('Usage: pnpm check:factory [FACTORY_ADDRESS] [WALLET_ADDRESS]');
  process.exit(1);
}
if (Number(config.NEXT_PUBLIC_CHAIN_ID ?? 43113) !== 43113) {
  console.error('Factory preflight requires Avalanche Fuji (43113).');
  process.exit(1);
}
const token = config.NEXT_PUBLIC_USDC_ADDRESS;
const abi = parseAbi([
  'function fundingVersion() view returns (uint256)',
  'function owner() view returns (address)',
  'function studentRegistry() view returns (address)',
  'function authorizedOrganizers(address) view returns (bool)',
  'function initialPoolDeposits(address,address) view returns (uint256)',
]);
const client = createPublicClient({ chain: avalancheFuji, transport: http(config.NEXT_PUBLIC_RPC_URL || avalancheFuji.rpcUrls.default.http[0], { timeout: 15000, retryCount: 1 }) });
function unavailableFunction(error) {
  let current = error;
  while (current) {
    if (['ContractFunctionRevertedError', 'ContractFunctionZeroDataError', 'AbiDecodingZeroDataError'].includes(current.name)) return true;
    current = current.cause;
  }
  return false;
}
async function main() {
  console.log(`Factory: ${factory}\nNetwork: Avalanche Fuji (43113)`);
  if (await client.getChainId() !== 43113) throw new Error('RPC_CHAIN_MISMATCH');
  const code = await client.getCode({ address: factory });
  if (!code || code === '0x') throw new Error('NO_FACTORY_BYTECODE');
  const read = (functionName, args) => client.readContract({ address: factory, abi, functionName, args });
  const [owner, registry] = await Promise.all([read('owner'), read('studentRegistry')]);
  console.log(`Platform owner: ${owner}\nStudentRegistry: ${registry}`);
  let version;
  try { version = await read('fundingVersion'); }
  catch (error) {
    if (!unavailableFunction(error)) throw error;
    console.error('UNSUPPORTED: This deployed Factory has no deposit-before-creation API. Deploy the current DeployPrefundedFactory script; changing frontend code cannot add functions to this address.');
    process.exitCode = 2;
    return;
  }
  if (version !== 1n) throw new Error('UNSUPPORTED_FUNDING_VERSION');
  if (!isAddress(token)) throw new Error('MISSING_USDC_ADDRESS');
  const credit = await read('initialPoolDeposits', [wallet, token]);
  let authorized = wallet.toLowerCase() === owner.toLowerCase();
  if (!authorized && wallet !== zeroAddress) authorized = await read('authorizedOrganizers', [wallet]);
  const configuredRegistry = config.NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS;
  if (configuredRegistry && configuredRegistry.toLowerCase() !== registry.toLowerCase()) throw new Error('STUDENT_REGISTRY_MISMATCH');
  console.log(`Funding version: ${version}\nDeposit-before-creation: supported`);
  if (wallet !== zeroAddress) console.log(`Wallet authorized: ${authorized}\nUnused deposit (token base units): ${credit}`);
  else console.log('Pass a wallet address as the second argument to check Organizer access and refundable credit.');
}
main().catch(error => {
  // Raw RPC errors can include credential-bearing URLs. Keep the diagnostic sanitized.
  const known = ['RPC_CHAIN_MISMATCH', 'NO_FACTORY_BYTECODE', 'UNSUPPORTED_FUNDING_VERSION', 'MISSING_USDC_ADDRESS', 'STUDENT_REGISTRY_MISMATCH'];
  console.error(known.includes(error.message) ? error.message : 'RPC_READ_FAILED: Cannot verify this Factory. Check network/RPC and retry; no transaction was sent.');
  process.exitCode = 1;
});
