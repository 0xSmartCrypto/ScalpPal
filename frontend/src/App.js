/* eslint-disable no-console */
import './App.css';

import { useEffect, useState } from 'react';
import {
  useWallet,
  useConnectedWallet,
  UserDenied,
  // WalletStatus,
} from '@terra-money/wallet-provider';

import { LCDClient, Coin, MsgSwap } from '@terra-money/terra.js';
// import * as execute from './contract/execute';
// import * as query from './contract/query';
import ConnectWallet from './components/ConnectWallet';

import useInterval from './hooks/useInterval';

// const terra = new LCDClient({
//   URL: 'https://lcd.terra.dev',
//   chainID: 'columbus-5',
// });
// const terra = new LCDClient({
//   URL: 'https://bombay-lcd.terra.dev',
//   chainID: 'bombay-12',
// });
const terra = new LCDClient({
  URL: 'http://localhost:1317',
  chainID: 'localterra',
});

/* @dev: do something
  x get the price of LUNA 5 mins ago
  x if current price > price 5 mins ago, swap LUNA to UST
  x else swap UST to LUNA
  x calculate profit
  x recommend swap only if price is favorable
  x UI
  x check LUNA / UST balance in wallet
  x enable text input of balance (25, 50% or 100%)
  - swap for real with text input of balance
  - simulate with real user balance
  - vercel deployment
 */
function App() {
  const INITIAL_BALANCE = 10000;
  const INTERVAL_IN_MS = 30000;
  const GETUST = 'LUNA to UST';
  const GETLUNA = 'UST to LUNA';
  const [updating, setUpdating] = useState(false);
  // const [resetValue, setResetValue] = useState(0);
  // const [swapRate, setSwapRate] = useState(null);
  const [currentPriceLuna, setCurrentPriceLuna] = useState(null);
  const [previousPriceLuna, setPreviousPriceLuna] = useState(null);
  // const [swapStr, setSwapStr] = useState('');
  // simulated values
  const [profit, setProfit] = useState(0.00);
  const [totalLunaBalance, setTotalLunaBalance] = useState(0);
  const [totalUstBalance, setTotalUstBalance] = useState(INITIAL_BALANCE);
  const [totalWorth, setTotalWorth] = useState(INITIAL_BALANCE);
  // actual user wallet balances
  const [userTotalLunaBalance, setUserTotalLunaBalance] = useState(0);
  const [userTotalUstBalance, setUserTotalUstBalance] = useState(0);

  const { status } = useWallet();

  const connectedWallet = useConnectedWallet();

  // Get swap rate of bLUNA:LUNA
  // useEffect(() => {
  //   terra.wasm.contractQuery(
  //     // bluna-luna pair contract address
  //     'terra1jxazgm67et0ce260kvrpfv50acuushpjsz2y0p',
  //     { pool: {} },
  //   )
  //     .then((result) => {
  //       let bluna;
  //       let luna;
  //       try {
  //         // bluna address
  //         if (result.assets[0].info.token.contract_addr
  //           === 'terra1kc87mu460fwkqte29rquh4hc20m54fxwtsx7gp') {
  //           bluna = result.assets[0].amount;
  //         }
  //         luna = result.assets[1].amount;
  //       } catch (e) {
  //         console.log('Error getting swap rate');
  //       }
  //       // deducting 0.3% swap fee
  //       const rate = (luna / bluna) * 0.997;
  //       setSwapRate(rate);
  //       console.log(`Swap Rate = ${rate} bLUNA:LUNA`);
  //     });
  // }, []);

  const refreshLunaPrice = async () => {
    const result = await terra.market.swapRate(new Coin('uluna', 1000), 'uusd');
    const newPriceLuna = result.amount.d[0] / 1000;
    console.log('LUNA price', newPriceLuna, 'UST');
    setCurrentPriceLuna(newPriceLuna);
  };

  // Update profit
  const updateBalances = async () => {
    // Only after INTERVAL_IN_MS
    if (previousPriceLuna > 0) {
      // console.log('Updating balances');
      if (currentPriceLuna > previousPriceLuna) {
        if (totalLunaBalance > 0) {
          // Record a swap to UST
          // console.log('Swapping full LUNA balance to UST');
          setTotalUstBalance(totalLunaBalance * currentPriceLuna);
          setTotalLunaBalance(0);
        }
      } else if (currentPriceLuna < previousPriceLuna) {
        if (totalUstBalance > 0) {
          // Record a swap to LUNA
          // console.log('Swapping full UST balance to LUNA');
          setTotalLunaBalance(totalUstBalance / currentPriceLuna);
          setTotalUstBalance(0);
        }
      }
      setTotalWorth(totalLunaBalance * currentPriceLuna + totalUstBalance);
      setProfit(totalLunaBalance * currentPriceLuna + totalUstBalance - INITIAL_BALANCE);
    }
  };

  // Get the balance of LUNA and UST in connectedWallet
  const updateUserBalances = async () => {
    if (connectedWallet) {
      const result = await terra.bank.balance(connectedWallet.walletAddress);
      const [coins] = result;
      if (coins.get('uusd')) {
        setUserTotalUstBalance(coins.get('uusd').toAmino().amount / 1000000);
      }
      if (coins.get('uluna')) {
        setUserTotalLunaBalance(coins.get('uluna').toAmino().amount / 1000000);
      }
    }
  };

  useEffect(async () => {
    await updateUserBalances();
  }, [connectedWallet]);

  // Get price of LUNA:UST on load
  useEffect(async () => {
    refreshLunaPrice();
  }, []);

  // Get the price of LUNA:UST every x seconds
  useInterval(async () => {
    setPreviousPriceLuna(currentPriceLuna);
    console.log('Get the updated price of LUNA every %ss', INTERVAL_IN_MS / 1000);
    await refreshLunaPrice();
    await updateBalances();
    await updateUserBalances();
  }, INTERVAL_IN_MS);

  const onClickSwapUstToLuna = async () => {
    console.log('swapping ust to luna');
    setUpdating(true);
    let swap;
    let memo;
    const toSwap = document.getElementById('toSwap').value;
    console.log(toSwap);

    if (currentPriceLuna < previousPriceLuna) {
      // swap ust to luna
      swap = new MsgSwap(
        connectedWallet.walletAddress,
        new Coin('uusd', toSwap * 1000000),
        'uluna',
      );
      memo = `ScalpPal swapping ${toSwap} UST to LUNA!`;

      const tx = await connectedWallet.sign({
        msgs: [swap],
        memo,
      });

      const result = await connectedWallet.post(tx)
        .catch((err) => {
          if (err instanceof UserDenied) {
            console.log('User denied transaction');
          } else {
            console.error(err);
          }
        });
      console.log('swap result', result);
    }

    if (document.getElementById('toSwap')) {
      document.getElementById('toSwap').value = '';
    }
    setUpdating(false);
  };

  const onClickSwapLunaToUst = async () => {
    console.log('swapping luna to ust');
    setUpdating(true);
    let swap;
    let memo;
    const toSwap = document.getElementById('toSwap').value;
    console.log(toSwap);

    if (currentPriceLuna > previousPriceLuna) {
      // swap luna to ust
      swap = new MsgSwap(
        connectedWallet.walletAddress,
        new Coin('uluna', toSwap * 1000000),
        'uusd',
      );
      memo = `ScalpPal swapping ${toSwap} LUNA to UST!`;

      const tx = await connectedWallet.sign({
        msgs: [swap],
        memo,
      });

      const result = await connectedWallet.post(tx)
        .catch((err) => {
          if (err instanceof UserDenied) {
            console.log('User denied transaction');
          } else {
            console.error(err);
          }
        });
      console.log('swap result', result);
    }

    if (document.getElementById('toSwap')) {
      document.getElementById('toSwap').value = '';
    }
    setUpdating(false);
  };

  const onChangeLunaToSwap = (e) => {
    console.log('onChangeLunaBalance', e.target.value);
  };

  const onChangeUstToSwap = (e) => {
    console.log('onChangeUstBalance', e.target.value);
  };

  // const amountInMillion = (amount) => amount / 1000000;
  // const amountInBillion = (amount) => amount / 1000000000;

  return (
    <div className="App">
      <header className="App-header">
        <div className="explainer">
          <h3>ScalpPal</h3>
          <p className="explainer">
            Every
            {' '}
            { INTERVAL_IN_MS / 1000 }
            {' '}
            seconds, ScalpPal checks the price of
            LUNA (in UST) and recommends you to swap between
            LUNA and UST to take advantage of
            price differences.
          </p>
        </div>
        <ConnectWallet />
      </header>
      <div>
        {status !== 'WALLET_NOT_CONNECTED' && (
          <>
            <div>
              <div>
                <p>
                  You hold
                  {' '}
                  <span className="bolder">
                    {(userTotalLunaBalance).toFixed(2)}
                  </span>
                  {' '}
                  LUNA and
                  {' '}
                  <span className="bolder">
                    $
                    {(userTotalUstBalance).toFixed(2)}
                  </span>
                  {' '}
                  UST in your wallet.
                </p>
              </div>
              <h2>
                Price of LUNA is
                {' '}
                <span className="bolder">
                  $
                  {currentPriceLuna}
                  {' '}
                </span>
                UST now.
              </h2>
              {
                previousPriceLuna
              && previousPriceLuna > 0.0
              && (
                <h3>
                  It was
                  {' '}
                  <span className="bolder">
                    $
                    {previousPriceLuna}
                  </span>
                  {' '}
                  UST
                  {' '}
                  <span className="bolder">
                    {INTERVAL_IN_MS / 1000}
                    {' '}
                    seconds
                  </span>
                  {' '}
                  ago.
                </h3>
              )
              }
            </div>
            <div>
              <p>
                You&apos;re holding
                {' '}
                {totalLunaBalance.toFixed(2)}
                {' '}
                LUNA and
                {' '}
                {totalUstBalance.toFixed(2)}
                {' '}
                UST
              </p>
            </div>
            <div>
              { previousPriceLuna !== null
            && (currentPriceLuna > previousPriceLuna && totalLunaBalance > 0)
            && (
              <>
                <h3 className="goodNews">Price is favorable!</h3>
                <div className="textInput">
                  <span className="textInput">
                    <a
                      className="quickLink"
                      href="#25pc"
                      id="25pc"
                      onClick={() => {
                        document.getElementById('toSwap').value = (userTotalLunaBalance * 0.25).toFixed(2);
                      }}
                    >
                      25%
                    </a>
                    <a
                      className="quickLink"
                      href="#50pc"
                      id="50pc"
                      onClick={() => {
                        document.getElementById('toSwap').value = (userTotalLunaBalance * 0.5).toFixed(2);
                      }}
                    >
                      50%
                    </a>
                    <a
                      className="quickLink"
                      href="#100pc"
                      id="100pc"
                      onClick={() => {
                        document.getElementById('toSwap').value = (userTotalLunaBalance).toFixed(2);
                      }}
                    >
                      100%
                    </a>
                  </span>
                  <input
                    type="input"
                    id="toSwap"
                    className="textInput"
                    onChange={onChangeLunaToSwap}
                  />
                </div>
                <button type="button" className="swap" onClick={onClickSwapLunaToUst}>
                  Swap
                  {' '}
                  {GETUST}
                </button>
              </>
            )}
            </div>

            <div>
              { previousPriceLuna !== null
            && (currentPriceLuna < previousPriceLuna && totalUstBalance > 0)
            && (
              <>
                <h3 className="goodNews">Price is favorable!</h3>
                <div className="textInput">
                  <span className="textInput">
                    <a
                      className="quickLink"
                      href="#25pc"
                      id="25pc"
                      onClick={() => {
                        document.getElementById('toSwap').value = (userTotalLunaBalance * 0.25).toFixed(2);
                      }}
                    >
                      25%
                    </a>
                    <a
                      className="quickLink"
                      href="#50pc"
                      id="50pc"
                      onClick={() => {
                        document.getElementById('toSwap').value = (userTotalLunaBalance * 0.5).toFixed(2);
                      }}
                    >
                      50%
                    </a>
                    <a
                      className="quickLink"
                      href="#100pc"
                      id="100pc"
                      onClick={() => {
                        document.getElementById('toSwap').value = (userTotalLunaBalance).toFixed(2);
                      }}
                    >
                      100%
                    </a>
                  </span>
                  <input
                    type="input"
                    id="toSwap"
                    className="textInput"
                    onChange={onChangeUstToSwap}
                  />
                </div>
                <button type="button" className="swap" onClick={onClickSwapUstToLuna}>
                  Swap
                  {' '}
                  {GETLUNA}
                </button>
              </>
            )}
            </div>

            <div>
              {
                previousPriceLuna !== null
            && (
              (currentPriceLuna >= previousPriceLuna && totalUstBalance > 0)
            || (currentPriceLuna <= previousPriceLuna && totalLunaBalance > 0)
            )
          && (
            <h3 className="badNews">Sit tight. Price is not favorable!</h3>
          )
              }
            </div>

            <div id="updating">
              {updating && <div>Updating...</div>}
            </div>

            <hr />

            <div className="explainer">
              <p>
                Since loading this page, had you put your entire balance of
                {' '}
                <span className="bolder">
                  $10000
                  {' '}
                  UST
                </span>
                {' '}
                to work and made every recommended swap, you
                would&rsquo;ve made

                {' '}
                <span className="bolder">
                  $
                  {profit.toFixed(3)}
                </span>
                {' '}
                in profit, with a total balance of
                {' '}
                <span className="bolder">{totalLunaBalance.toFixed(2)}</span>
                {' '}
                LUNA and
                {' '}
                <span className="bolder">{totalUstBalance.toFixed(2)}</span>
                {' '}
                UST, for a total worth of
                {' '}
                <span className="bolder">
                  $
                  {totalWorth.toFixed(2)}
                </span>
                !
              </p>
              <p>
                Please wait up to
                {' '}
                <span className="bolder">
                  {INTERVAL_IN_MS / 1000}
                  {' '}
                  seconds

                </span>
                {' '}
                for the next update.
              </p>
            </div>

          </>
        )}
      </div>
    </div>
  );
}

export default App;
