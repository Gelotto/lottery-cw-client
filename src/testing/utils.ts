import { AccountData } from "@cosmjs/amino";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { initSigningClient } from "../util";

export type ScenarioParams = {
  codeId: number;
  client: SigningCosmWasmClient;
  sender: AccountData;
  wallets: { client: SigningCosmWasmClient; sender: AccountData }[];
};

export type Scenario = (params: ScenarioParams) => Promise<void>;

export async function initWallet(
  mnemonic: string
): Promise<{ client: SigningCosmWasmClient; sender: AccountData }> {
  return await initSigningClient({
    mnemonic,
    rpcEndpoint: "http://127.0.0.1:26657",
    gasPrice: GasPrice.fromString("0.002ujunox"),
    prefix: "juno",
  });
}

export async function initTestWallets(): Promise<
  Array<{ client: SigningCosmWasmClient; sender: AccountData }>
> {
  return [
    await initWallet(
      "rude ripple author field learn film actual wink between arrive various flush card " +
        "wrap razor shuffle iron royal virtual insane awful cool spike certain"
    ),
    await initWallet(
      "attract beach extend ski reopen exotic pride oblige album piano mercy replace soon " +
        "pave pause sheriff smooth caution twin sausage fringe vivid annual loop"
    ),
  ];
}

export async function run(scenario: Scenario) {
  const codeId = parseInt(process.env.CODE_ID!);
  const { client, sender } = await initSigningClient({
    mnemonic:
      "clip hire initial neck maid actor venue client foam budget lock catalog " +
      "sweet steak waste crater broccoli pipe steak sister coyote moment obvious choose",
    rpcEndpoint: "http://127.0.0.1:26657",
    gasPrice: GasPrice.fromString("0.002ujunox"),
    prefix: "juno",
  });
  const wallets = await initTestWallets();
  await scenario({ codeId, client, sender, wallets });
}
