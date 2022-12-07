import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

export async function initSigningClient({
  mnemonic,
  prefix,
  rpcEndpoint,
  gasPrice,
}: {
  mnemonic: string;
  prefix: string;
  rpcEndpoint: string;
  gasPrice: GasPrice;
}) {
  const offlineSigner = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix,
  });

  const client = await SigningCosmWasmClient.connectWithSigner(
    rpcEndpoint,
    offlineSigner,
    { prefix, gasPrice }
  );

  const account = (await offlineSigner.getAccounts())[0];

  return { client, sender: account };
}

export async function rawQuery(
  client: SigningCosmWasmClient,
  contractAddress: string,
  key: string
): Promise<string | null> {
  const responseBytes = await client.queryContractRaw(
    contractAddress,
    Uint8Array.from(toAscii(key))
  );
  if (responseBytes) {
    return new TextDecoder().decode(responseBytes);
  }
  return null;
}

export function toAscii(key: string): number[] {
  const arr: number[] = [];
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    arr.push(code);
  }
  return arr;
}
