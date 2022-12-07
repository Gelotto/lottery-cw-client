import { getPotSize, Lottery } from "./Lottery";
import { run as scenario, ScenarioParams } from "./testing/utils";

describe(`lottery`, () => {
  it(`instantiates with correct initial state`, async () => {
    await scenario(async ({ codeId, client, sender }: ScenarioParams) => {
      const { lottery } = await Lottery.instantiate(client, sender, codeId, {
        activate: true,
        tournament: false,
        name: "Test Lottery",
        rounds: {
          count: 1,
          configs: [
            {
              name: "Test Round",
              selection: {
                method: { fixed: [100] },
                with_replacement: false,
              },
              targets: {
                wallet_count: 3,
                duration_minutes: 10,
                ticket_count: 5,
              },
              ticket_price: "100000",
              royalties: [
                {
                  wallet: sender.address,
                  autosend: true,
                  pct: 1,
                },
              ],
              token: {
                native: { denom: "ujunox" },
              },
            },
          ],
        },
      });

      await lottery.refresh();

      expect(lottery.state).toEqual({
        owner: sender.address,
        name: "Test Lottery",
        tournament: false,
        status: "active",
        rounds: {
          index: 0,
          count: 1,
          configs: [
            {
              max_tickets_per_wallet: null,
              ticket_price: "100000",
              name: "Test Round",
              royalties: [{ wallet: sender.address, pct: 1, autosend: true }],
              selection: {
                method: {
                  fixed: [100],
                },
                with_replacement: false,
              },
              targets: {
                duration_minutes: 10,
                wallet_count: 3,
                ticket_count: 5,
              },
              token: {
                native: {
                  denom: "ujunox",
                },
              },
            },
          ],
        },
      });
    });
  });

  it(`ends when target ticket count has been reached`, async () => {
    await scenario(
      async ({ codeId, client, sender, wallets }: ScenarioParams) => {
        console.log("instantiating game...");
        const { lottery } = await Lottery.instantiate(client, sender, codeId, {
          activate: true,
          tournament: false,
          name: "Test Lottery",
          rounds: {
            count: 1,
            configs: [
              {
                name: "Test Round",
                selection: {
                  method: { fixed: [100] },
                  with_replacement: false,
                },
                targets: {
                  ticket_count: 10,
                },
                ticket_price: "10000",
                royalties: [],
                token: {
                  native: { denom: "ujunox" },
                },
              },
            ],
          },
        });

        let round;

        console.log("buying 9 tickets...");
        await lottery.buyTickets({ count: 9 });

        round = await lottery.fetchRound({ index: 0 });

        expect(round.status).toStrictEqual("active");
        expect(round.winners).toEqual([]);
        expect(round.counts).toEqual({
          drawings: 1,
          tickets: 9,
          wallets: 1,
          orders: 1,
        });

        console.log("buying 1 final ticket, expecting game to end...");
        await lottery.buyTickets({
          ...wallets[0],
          count: 1,
          message: "Test Message",
          isPublic: true,
        });
        await lottery.refresh();

        round = await lottery.fetchRound({ index: 0 });

        expect(round.status).toStrictEqual("complete");
        expect(round.ended_by).toStrictEqual(wallets[0].sender.address);
        expect(round.winners!.length).toStrictEqual(1);
        expect(round.winners![0].amount).toStrictEqual("100000");
        expect(round.winners![0].position).toStrictEqual(0);
        expect(round.counts).toEqual({
          tickets: 10,
          drawings: 1,
          wallets: 2,
          orders: 2,
        });

        expect(round.players!.length).toStrictEqual(2);
        expect(round.players![0].ticket_count).toStrictEqual(9);
        expect(round.players![0].order_indices).toEqual([0]);
        expect(round.players![1].ticket_count).toStrictEqual(1);
        expect(round.players![1].order_indices).toEqual([1]);

        expect(round.orders!.length).toStrictEqual(2);
        expect(round.orders![0].ticket_count).toStrictEqual(1);
        expect(round.orders![0].is_public).toStrictEqual(true);
        expect(round.orders![0].message).toStrictEqual("VGVzdCBNZXNzYWdl");
        expect(round.orders![1].ticket_count).toStrictEqual(9);
        expect(round.orders![1].is_public).toStrictEqual(false);

        const claims = await lottery.fetchClaims();

        expect(claims.length).toStrictEqual(1);
        expect(claims[0]).toEqual({
          wallet: round.winners![0].wallet,
          rewards: [
            { amount: "100000", token: { native: { denom: "ujunox" } } },
          ],
        });
      }
    );
  });

  it(`ends when target wallet count has been reached`, async () => {
    await scenario(
      async ({ codeId, client, sender, wallets }: ScenarioParams) => {
        console.log("instantiating game...");
        const { lottery } = await Lottery.instantiate(client, sender, codeId, {
          activate: true,
          tournament: false,
          name: "Test Lottery",
          rounds: {
            count: 1,
            configs: [
              {
                name: "Test Round",
                selection: {
                  method: { fixed: [100] },
                  with_replacement: false,
                },
                targets: {
                  wallet_count: 2,
                },
                ticket_price: "10000",
                royalties: [],
                token: {
                  native: { denom: "ujunox" },
                },
              },
            ],
          },
        });

        let round;

        console.log("player 0 buys 1 ticket...");
        await lottery.buyTickets({ count: 1 });

        round = await lottery.fetchRound({ index: 0 });

        expect(round.status).toStrictEqual("active");
        expect(round.winners).toEqual([]);
        expect(round.counts).toEqual({
          drawings: 1,
          tickets: 1,
          wallets: 1,
          orders: 1,
        });

        console.log("player 1 buys second ticket, expecting game to end...");
        await lottery.buyTickets({
          ...wallets[0],
          count: 1,
        });
        await lottery.refresh();

        round = await lottery.fetchRound({ index: 0 });

        expect(round.status).toStrictEqual("complete");
        expect(round.ended_by).toStrictEqual(wallets[0].sender.address);
        expect(round.winners!.length).toStrictEqual(1);
        expect(round.winners![0].amount).toStrictEqual("20000");
        expect(round.winners![0].position).toStrictEqual(0);
        expect(round.counts).toEqual({
          tickets: 2,
          drawings: 1,
          wallets: 2,
          orders: 2,
        });

        expect(round.players!.length).toStrictEqual(2);
        expect(round.players![0].ticket_count).toStrictEqual(1);
        expect(round.players![0].order_indices).toEqual([0]);
        expect(round.players![1].ticket_count).toStrictEqual(1);
        expect(round.players![1].order_indices).toEqual([1]);

        expect(round.orders!.length).toStrictEqual(2);
        expect(round.orders![0].ticket_count).toStrictEqual(1);
        expect(round.orders![1].ticket_count).toStrictEqual(1);

        const claims = await lottery.fetchClaims();

        expect(claims.length).toStrictEqual(1);
        expect(claims[0]).toEqual({
          wallet: round.winners![0].wallet,
          rewards: [
            {
              amount: round.winners![0].amount,
              token: { native: { denom: "ujunox" } },
            },
          ],
        });
      }
    );
  });

  it(`allocates correct claim amounts for royalties and winners`, async () => {
    await scenario(
      async ({ codeId, client, sender, wallets }: ScenarioParams) => {
        console.log("instantiating game...");
        const royaltyPct = 5;
        const { lottery } = await Lottery.instantiate(client, sender, codeId, {
          activate: true,
          tournament: false,
          name: "Test Lottery",
          rounds: {
            count: 1,
            configs: [
              {
                name: "Test Round",
                selection: {
                  method: { fixed: [100] },
                  with_replacement: false,
                },
                targets: {
                  ticket_count: 2,
                },
                ticket_price: "10000",
                royalties: [
                  {
                    wallet: sender.address,
                    autosend: false,
                    pct: royaltyPct,
                  },
                ],
                token: {
                  native: { denom: "ujunox" },
                },
              },
            ],
          },
        });

        console.log("player 1 buys a ticket...");
        await lottery.buyTickets({ ...wallets[0], count: 1 });

        console.log("player 2 buys ticket, expecting game to end...");
        await lottery.buyTickets({
          ...wallets[1],
          count: 1,
        });

        await lottery.refresh();

        console.log(
          JSON.stringify({ balances: await lottery.fetchBalances() })
        );

        const round = await lottery.fetchRound({ index: 0 });
        const claims = await lottery.fetchClaims();

        const ticketPrice = parseInt(round.config.ticket_price);
        const totalAmount = ticketPrice * round.counts.tickets;
        const royaltyAmount = Math.floor((totalAmount * royaltyPct) / 100);
        const winnerAmount = totalAmount - royaltyAmount;

        // verify we have 2 claim records: one for the royalty recipient
        // and one for the winner
        expect(claims.length).toStrictEqual(2);
        expect(round.winners![0].amount).toStrictEqual(winnerAmount.toString());

        // verify claim amounts correct
        for (let claim of claims) {
          if (claim.wallet === sender.address) {
            expect(claim.rewards[0].amount).toStrictEqual(
              royaltyAmount.toString()
            );
          } else {
            expect(claim.rewards[0].amount).toStrictEqual(
              winnerAmount.toString()
            );
          }
        }
      }
    );
  });

  it(`distributes incentives appropriately`, async () => {
    await scenario(
      async ({ codeId, client, sender, wallets }: ScenarioParams) => {
        console.log("instantiating cw20 token...");
        const cw20ContractAddress = (
          await client.instantiate(
            sender.address,
            62,
            {
              name: "TestToken",
              symbol: "TEST",
              decimals: 6,
              initial_balances: [
                { address: sender.address, amount: "100000000" },
              ],
              mint: {
                minter: sender.address,
              },
            },
            `test-token-${new Date()}`,
            "auto"
          )
        ).contractAddress;

        console.log(`CW20 token contract address: ${cw20ContractAddress}`);

        console.log("instantiating game...");
        const royaltyPct = 5;
        const { result, lottery } = await Lottery.instantiate(
          client,
          sender,
          codeId,
          {
            activate: true,
            tournament: false,
            name: "Test Lottery",
            rounds: {
              count: 1,
              configs: [
                {
                  name: "Test Round",
                  selection: {
                    method: { fixed: [100] },
                    with_replacement: false,
                  },
                  targets: {
                    ticket_count: 2,
                  },
                  ticket_price: "10000",
                  royalties: [
                    {
                      wallet: sender.address,
                      autosend: false,
                      pct: royaltyPct,
                    },
                  ],
                  token: {
                    native: { denom: "ujunox" },
                  },
                },
              ],
            },
          }
        );

        console.log(`lottery contract address: ${result.contractAddress}`);

        console.log("player 0 adds juno and cw20 incentives");
        await lottery.addIncentives({
          message: "Take my coins!",
          rewards: [
            {
              reward: {
                amount: "5000",
                token: { native: { denom: "ujunox" } },
              },
            },
            {
              reward: {
                amount: "10000",
                token: { cw20: { address: cw20ContractAddress } },
              },
            },
          ],
        });

        console.log("player 1 adds juno incentive");
        await lottery.addIncentives({
          ...wallets[0],
          message: "Gift from God",
          rewards: [
            {
              reward: {
                amount: "2000",
                token: { native: { denom: "ujunox" } },
              },
              position: 0,
            },
          ],
        });

        const incentives = await lottery.fetchIncentives();

        expect(incentives.length).toStrictEqual(2);
        expect(incentives).toEqual([
          {
            source: sender.address,
            message: "VGFrZSBteSBjb2lucyE=",
            rewards: [
              {
                reward: {
                  token: { native: { denom: "ujunox" } },
                  amount: "5000",
                },
                position: null,
              },
              {
                reward: {
                  token: { cw20: { address: cw20ContractAddress } },
                  amount: "10000",
                },
                position: null,
              },
            ],
          },
          {
            source: wallets[0].sender.address,
            message: "R2lmdCBmcm9tIEdvZA==",
            rewards: [
              {
                reward: {
                  token: { native: { denom: "ujunox" } },
                  amount: "2000",
                },
                position: 0,
              },
            ],
          },
        ]);

        console.log("player 1 buys a ticket");
        await lottery.buyTickets({ ...wallets[0], count: 1 });

        console.log("player 2 buys a ticket");
        await lottery.buyTickets({ ...wallets[1], count: 1 });
        await lottery.refresh();

        const round = await lottery.fetchRound({ index: 0 });
        const claims = await lottery.fetchClaims();

        // expect a claim for winner and royalty recipient
        expect(claims.length).toStrictEqual(2);

        const royaltyClaim = claims.find(
          (claim) => claim.wallet === sender.address
        );

        // verify that there's only one royalty reward that
        // has the expected cut of the pot
        expect(royaltyClaim.rewards.length).toStrictEqual(1);
        expect(royaltyClaim.rewards[0]).toEqual({
          amount: Math.floor((royaltyPct * getPotSize(round)) / 100).toString(),
          token: { native: { denom: "ujunox" } },
        });

        const totalIncentive = 7000;
        const royaltyAmount = Math.floor(
          (royaltyPct * getPotSize(round)) / 100
        );
        const winnerClaim = claims.find(
          (claim) => claim.wallet !== sender.address
        );

        // verify that the winner receives the expected share of the pot
        // as well as the external cw20 token incentive
        expect(winnerClaim.rewards.length).toStrictEqual(2);
        expect(
          winnerClaim.rewards.find((x) => x.token.native !== undefined)
        ).toEqual({
          amount: (
            getPotSize(round) +
            totalIncentive -
            royaltyAmount
          ).toString(),
          token: { native: { denom: "ujunox" } },
        });
        expect(
          winnerClaim.rewards.find((x) => x.token.cw20 !== undefined)
        ).toEqual({
          amount: "10000",
          token: { cw20: { address: cw20ContractAddress } },
        });

        //verify that the expected claim amounts are transfered to
        // the winner
        const winner = wallets.find(
          (w) => w.sender.address === winnerClaim.wallet
        );

        expect(await lottery.fetchBalances()).toEqual({
          native: [{ denom: "ujunox", address: null, amount: "27000" }],
          cw20: [
            {
              denom: null,
              address: cw20ContractAddress,
              amount: "10000",
            },
          ],
        });

        expect(await lottery.fetchClaims()).toEqual([
          {
            wallet: winner.sender.address,
            rewards: [
              {
                token: {
                  cw20: {
                    address: cw20ContractAddress,
                  },
                },
                amount: "10000",
              },
              { token: { native: { denom: "ujunox" } }, amount: "26000" },
            ],
          },
          {
            wallet: sender.address,
            rewards: [
              { token: { native: { denom: "ujunox" } }, amount: "1000" },
            ],
          },
        ]);

        // claim as winner
        await lottery.claim({ ...winner });

        // verify that balances now reflect only the royalty recipient's claim
        expect(await lottery.fetchBalances()).toEqual({
          native: [{ denom: "ujunox", address: null, amount: "1000" }],
          cw20: [],
        });
        expect(await lottery.fetchClaims()).toEqual([
          {
            wallet: sender.address,
            rewards: [
              { token: { native: { denom: "ujunox" } }, amount: "1000" },
            ],
          },
        ]);

        // claim as royalty recipient
        await lottery.claim();

        // verify that balances and claims reflect only the royalty recipient
        expect(await lottery.fetchClaims()).toEqual([]);

        // verify that claim records are now completely expunged
        // with 0 balances
        expect(await lottery.fetchBalances()).toEqual({
          native: [],
          cw20: [],
        });
      }
    );
  });

  it(`ends when target ticket count has been reached`, async () => {
    await scenario(
      async ({ codeId, client, sender, wallets }: ScenarioParams) => {
        console.log("instantiating game...");
        const { lottery } = await Lottery.instantiate(client, sender, codeId, {
          activate: true,
          tournament: false,
          name: "Test Lottery",
          rounds: {
            count: 4,
            configs: [
              {
                name: "Foo Round",
                selection: {
                  method: { fixed: [100] },
                  with_replacement: false,
                },
                targets: {
                  ticket_count: 2,
                },
                ticket_price: "1000",
                royalties: [],
                token: {
                  native: { denom: "ujunox" },
                },
              },
              {
                name: "Bar Round",
                selection: {
                  method: { fixed: [100] },
                  with_replacement: false,
                },
                targets: {
                  ticket_count: 2,
                },
                ticket_price: "1000",
                royalties: [],
                token: {
                  native: { denom: "ujunox" },
                },
              },
            ],
          },
        });

        let round = await lottery.fetchRound();
        for (let i = 0; i < lottery.state.rounds.count; ++i) {
          expect(lottery.state.rounds.index).toStrictEqual(round.index);
          expect(lottery.state.rounds.index).toBe(i);
          expect(round.index).toBe(i);

          console.log(JSON.stringify(round.config));

          console.log(`player 0 buying tickets for round ${i}...`);
          await lottery.buyTickets({ ...wallets[0], count: 1 });
          console.log(`player 1 buying tickets for round ${i}...`);
          await lottery.buyTickets({ ...wallets[1], count: 1 });

          await lottery.refresh();
          round = await lottery.fetchRound();
        }
      }
    );
  });
});
