import { AccountData, Coin } from "@cosmjs/amino";
import {
  SigningCosmWasmClient,
  InstantiateResult,
  ExecuteResult,
  ExecuteInstruction,
} from "@cosmjs/cosmwasm-stargate";
import { rawQuery } from "./util";

export type LotteryStatus = "pending" | "active" | "complete" | "canceled";

export type RoundStatus =
  | "pending"
  | "active"
  | "closed"
  | "complete"
  | "canceled";

export type Token = {
  native?: { denom: string };
  cw20?: { address: string };
};

export type IncentivePackage = {
  reward: { token: Token; amount: string };
  position?: number | null;
  message?: string | null;
};

export type RoundConfig = {
  name?: string | null;
  ticket_price: string;
  max_tickets_per_wallet?: number | null;
  targets: {
    wallet_count?: number | null;
    ticket_count?: number | null;
    duration_minutes?: number | null;
  };
  selection: {
    method: {
      percent?: { pct: number; max?: number | null };
      fixed?: Array<number>;
    };
    with_replacement: boolean;
  };
  token: {
    native?: { denom: string };
    cw20?: { address: string };
  };
  royalties: Array<{
    wallet: string;
    autosend?: boolean | null;
    pct: number;
  }>;
};

export type Winner = {
  wallet: string;
  amount: string;
  position: number;
};

export type TicketOrder = {
  wallet: string;
  ticket_count: number;
  message: string | null;
  is_public: boolean;
};

export type Player = {
  wallet: string;
  ticket_count: string;
  order_indices: number[];
};

export type Round = {
  status: RoundStatus;
  config: RoundConfig;
  started_at: Date;
  ended_by: string | null;
  max_tickets_per_wallet: number | null;
  winners: Winner[] | null;
  orders: TicketOrder[] | null;
  players: Player[] | null;
  index: number;
  counts: {
    wallets: number;
    tickets: number;
    drawings: number;
    orders: number;
  };
};

export type Claim = {
  wallet: string;
  rewards: Array<{
    token: Token;
    amount: string;
  }>;
};

export type Balance = {
  amount: string;
  denom?: string;
  address?: string;
};

export type Balances = {
  native: Balance[];
  cw20: Balance[];
};

export class Lottery {
  readonly client: SigningCosmWasmClient;
  readonly sender: AccountData;
  readonly codeId: number;
  readonly address: string;

  state?: {
    owner: string;
    name: string;
    tournament: boolean | null;
    status: LotteryStatus;
    rounds: {
      count: number;
      index: number;
      configs: Array<RoundConfig>;
    };
  };

  constructor(
    client: SigningCosmWasmClient,
    sender: AccountData,
    codeId: number,
    address: string
  ) {
    this.client = client;
    this.sender = sender;
    this.codeId = codeId;
    this.address = address;
  }

  getCurrentRoundConfig(): RoundConfig | null {
    if (this.state) {
      const index = this.state.rounds.index % this.state.rounds.configs.length;
      return this.state?.rounds.configs[index];
    }
    return null;
  }

  static async instantiate(
    client: SigningCosmWasmClient,
    sender: AccountData,
    codeId: number,
    message: {
      activate: boolean;
      tournament: boolean;
      name: string;
      rounds: {
        configs: RoundConfig[];
        count: number;
      };
    }
  ): Promise<{ result: InstantiateResult; lottery: Lottery }> {
    const result = await client.instantiate(
      sender.address,
      codeId,
      message,
      `${message.name} gelotto lottery - ${new Date()}`,
      "auto"
    );
    return {
      result,
      lottery: await new this(
        client,
        sender,
        codeId,
        result.contractAddress
      ).refresh(),
    };
  }

  async refresh(): Promise<Lottery> {
    const jsonData = await rawQuery(this.client, this.address, "lottery");
    if (jsonData !== null) {
      this.state = JSON.parse(jsonData);
    }
    return this;
  }

  async fetchBalances(): Promise<Balances> {
    return (await this.client.queryContractSmart(this.address, {
      get_balances: {},
    })) as Balances;
  }

  async fetchIncentives({
    roundIndex,
  }: {
    roundIndex?: number | null;
  } = {}): Promise<IncentivePackage[]> {
    return (
      await this.client.queryContractSmart(this.address, {
        get_incentives: {
          round_index: roundIndex,
        },
      })
    ).incentives as IncentivePackage[];
  }

  async fetchRound({
    index,
    includeOrders,
    includePlayers,
    includeWinners,
  }: {
    index?: number;
    includeWinners?: boolean;
    includePlayers?: boolean;
    includeOrders?: boolean;
  } = {}): Promise<Round> {
    return await this.client.queryContractSmart(this.address, {
      get_round: {
        index,
        winners: includeWinners ?? true,
        players: includePlayers ?? true,
        orders: includeOrders ?? true,
      },
    });
  }

  async fetchClaims(): Promise<Claim[]> {
    return (
      (await this.client.queryContractSmart(this.address, {
        get_claims: {},
      })) as any
    ).claims as Claim[];
  }

  async buyTickets({
    client,
    sender,
    count,
    message,
    isPublic,
  }: {
    client?: SigningCosmWasmClient;
    sender?: AccountData;
    count: number;
    message?: string;
    isPublic?: boolean;
  }): Promise<ExecuteResult> {
    const config = this.getCurrentRoundConfig();
    const funds: Coin[] = [];

    // base64 encode lucky message
    if (message !== undefined) {
      message = Buffer.from(message).toString("base64");
    }

    const fee = "auto";
    const memo = `Bought Gelotto lottery tickets (${count})`;
    const amount = (parseInt(config.ticket_price) * count).toString();

    // buy with native token
    if (config?.token.native) {
      funds.push({
        denom: config.token.native.denom,
        amount,
      });
      return await (client ?? this.client).execute(
        sender ? sender.address : this.sender.address,
        this.address,
        {
          buy_tickets: {
            is_public: isPublic ?? false,
            message,
            count,
          },
        },
        fee,
        memo,
        funds
      );
    } else {
      // buy with CW20 token
      const instructions: ExecuteInstruction[] = [
        {
          contractAddress: config.token.cw20.address,
          msg: {
            increase_allowance: {
              spender: this.address,
              expires: { never: {} },
              amount,
            },
          },
          funds: [],
        },
        {
          contractAddress: this.address,
          msg: {
            buy_tickets: {
              is_public: isPublic ?? false,
              message,
              count,
            },
          },
          funds: [],
        },
      ];
      return await client.executeMultiple(
        sender.address,
        instructions,
        fee,
        memo
      );
    }
  }

  async claim({
    client,
    sender,
  }: {
    client?: SigningCosmWasmClient;
    sender?: AccountData;
  } = {}): Promise<ExecuteResult> {
    client = client ?? this.client;
    sender ??= sender ?? this.sender;
    return await client.execute(
      sender.address,
      this.address,
      { claim_rewards: {} },
      "auto",
      "Claimed Gelotto lottery rewards"
    );
  }

  async addIncentives({
    client,
    sender,
    rewards,
    message,
  }: {
    client?: SigningCosmWasmClient;
    sender?: AccountData;
    rewards: IncentivePackage[];
    message?: String;
  }): Promise<ExecuteResult> {
    client ??= this.client;
    sender ??= this.sender;

    const funds: Coin[] = [];
    const instructions: ExecuteInstruction[] = [];

    rewards.forEach(({ reward }) => {
      const token = reward.token;
      if (token.cw20 !== undefined) {
        instructions.push({
          contractAddress: token.cw20.address,
          msg: {
            increase_allowance: {
              spender: this.address,
              amount: reward.amount,
              expires: { never: {} },
            },
          },
          funds: [],
        });
        // create a msg to execute to transfer each type of CW20 token
        // to the lottery contract.
      } else if (token.native !== undefined) {
        // native rewards need to be sent to the lottery contract in the form of
        // transaction funds
        funds.push({ denom: token.native.denom, amount: reward.amount });
      }
    });

    // now add the instruction to register the incentives with the lottery contract
    instructions.push({
      contractAddress: this.address,
      msg: {
        add_incentives: {
          message: message ? Buffer.from(message).toString("base64") : null,
          rewards,
        },
      },
      funds: funds,
    });

    const memo = "Incentives for Gelotto lottery";
    const fee = "auto";

    if (instructions.length > 1) {
      return await client.executeMultiple(
        sender.address,
        instructions,
        fee,
        memo
      );
    } else {
      return await client.execute(
        sender.address,
        this.address,
        instructions[0].msg,
        fee,
        memo,
        instructions[0].funds
      );
    }
  }
}

export function getPotSize(round: Round): number {
  return round.counts.tickets * parseInt(round.config.ticket_price);
}
