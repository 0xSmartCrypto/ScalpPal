/* eslint-disable no-console */
import './App.css';

import { useEffect, useState } from 'react';
import {
  useWallet,
  useConnectedWallet,
  // WalletStatus,
} from '@terra-money/wallet-provider';

import { LCDClient, Coin, MsgSwap } from '@terra-money/terra.js';
// import * as execute from './contract/execute';
// import * as query from './contract/query';
import ConnectWallet from './components/ConnectWallet';

import useInterval from './hooks/useInterval';

const terra = new LCDClient({
  URL: 'https://lcd.terra.dev',
  chainID: 'columbus-5',
});

/* @dev: do something
  x get the price of LUNA 5 mins ago
  x if current price > price 5 mins ago, swap LUNA to UST
  x else swap UST to LUNA
  x calculate profit
  x recommend swap only if price is favorable
  x UI
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
  const [priceLuna, setPriceLuna] = useState(null);
  const [price1mAgo, setPrice1mAgo] = useState(null);
  // const [swapStr, setSwapStr] = useState('');
  const [profit, setProfit] = useState(0.00);
  const [totalLunaBalance, setTotalLunaBalance] = useState(0);
  const [totalUstBalance, setTotalUstBalance] = useState(INITIAL_BALANCE);
  const [totalWorth, setTotalWorth] = useState(INITIAL_BALANCE);

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
    const result = await terra.market.swapRate(new Coin('uluna', 10000), 'uusd');
    const newPriceLuna = result.amount.d[0] / 10000;
    console.log('LUNA price', newPriceLuna, 'UST');
    setPriceLuna(newPriceLuna);
  };

  // Update profit
  const updateBalances = async () => {
    // Only after 1m
    if (price1mAgo > 0) {
      // console.log('Updating balances');
      if (priceLuna > price1mAgo) {
        if (totalLunaBalance > 0) {
          // Record a swap to UST
          // console.log('Swapping full LUNA balance to UST');
          setTotalUstBalance(totalLunaBalance * priceLuna);
          setTotalLunaBalance(0);
        }
      } else if (priceLuna < price1mAgo) {
        if (totalUstBalance > 0) {
          // Record a swap to LUNA
          // console.log('Swapping full UST balance to LUNA');
          setTotalLunaBalance(totalUstBalance / priceLuna);
          setTotalUstBalance(0);
        }
      }
      setTotalWorth(totalLunaBalance * priceLuna + totalUstBalance);
      setProfit(totalLunaBalance * priceLuna + totalUstBalance - INITIAL_BALANCE);
    }
  };

  // Get price of LUNA:UST on load
  useEffect(async () => {
    console.log('Getting initial price of LUNA');
    refreshLunaPrice();
  }, []);

  // Get the price of LUNA:UST every x seconds
  useInterval(async () => {
    setPrice1mAgo(priceLuna);
    console.log('Get the updated price of LUNA every %ss', INTERVAL_IN_MS / 1000);
    await refreshLunaPrice();
    await updateBalances();
  }, INTERVAL_IN_MS);

  const onClickSwap = async () => {
    console.log('swapping');
    setUpdating(true);
    let swap;
    let memo;
    if (priceLuna > price1mAgo) {
      // swap luna to ust
      swap = new MsgSwap(
        connectedWallet.walletAddress,
        new Coin('uluna', 1000000),
        'uusd',
      );
      memo = 'Swap luna to ust now!';
    } else if (priceLuna < price1mAgo) {
      // swap ust to luna
      swap = new MsgSwap(
        connectedWallet.walletAddress,
        new Coin('uusd', 10000000000),
        'uluna',
      );
      memo = 'Swap ust to luna now!';
    }

    const tx = await connectedWallet.sign({
      msgs: [swap],
      memo,
    });

    const result = await connectedWallet.post(tx)
      .catch((err) => {
        console.error(err);
      });

    console.log('swap result', result);
    setUpdating(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="explainer">
          <h3>Terra &quot;ScalpBuddy&quot;</h3>
          <p className="explainer">
            Every minute, ScalpBuddy checks the prices of
            LUNA:UST and recommends you to swap the balance
            of LUNA and UST if you can take advantage of
            price differences.
          </p>
        </div>
        <ConnectWallet />
      </header>
      {status !== 'WALLET_NOT_CONNECTED' && (
        <>
          <div>
            <h2>
              Price of LUNA is
              {' '}
              <span className="bolder">
                $
                {priceLuna}
                {' '}
              </span>
              UST now.
            </h2>
            {
              price1mAgo
              && price1mAgo > 0.0
              && (
                <h3>
                  It was
                  {' '}
                  <span className="bolder">
                    $
                    {price1mAgo}
                  </span>
                  {' '}
                  UST a minute ago.
                </h3>
              )
            }
          </div>
          <div>
            {
              price1mAgo !== null
            && (
              (priceLuna > price1mAgo && totalLunaBalance > 0)
              || (priceLuna < price1mAgo && totalUstBalance > 0)
            )
            && (
              <>
                <h3 className="goodNews">Price is favorable!</h3>
                <p>
                  You&apos;re holding
                  {' '}
                  {totalLunaBalance.toFixed(3)}
                  {' '}
                  LUNA and
                  {' '}
                  {totalUstBalance.toFixed(3)}
                  {' '}
                  UST
                </p>
                <button type="button" className="swap" onClick={onClickSwap}>
                  Swap
                  {' '}
                  {(priceLuna > price1mAgo && totalLunaBalance > 0) ? GETUST : GETLUNA}
                </button>
              </>
            )
            }
            {
              price1mAgo !== null
            && (
              (priceLuna > price1mAgo && totalUstBalance > 0)
            || (priceLuna < price1mAgo && totalLunaBalance > 0)
            )
          && (
            <>
              <p>
                You&apos;re holding
                {' '}
                {totalLunaBalance.toFixed(3)}
                {' '}
                LUNA and
                {' '}
                {totalUstBalance.toFixed(3)}
                {' '}
                UST
              </p>
              <h3 className="badNews">Sit tight. Price is not favorable!</h3>
            </>
          )
            }
          </div>
          <div id="updating">
            {updating && <div>Updating...</div>}
          </div>
          <div>
            {
              totalWorth > 0 && (
                <>
                  <hr />
                  <p>
                    Since being on this page, had you started with $10,000 and
                    made every recommended swap with your full balance, you
                    would&rsquo;ve made
                  </p>
                  <p>
                    {' '}
                    <span className="bolder">
                      $
                      {profit.toFixed(3)}
                    </span>
                    {' '}
                    in profit, with total balance of
                    {' '}
                    <span className="bolder">{totalLunaBalance.toFixed(3)}</span>
                    {' '}
                    LUNA and
                    {' '}
                    <span className="bolder">{totalUstBalance.toFixed(3)}</span>
                    {' '}
                    UST, and a total worth of
                    {' '}
                    <span className="bolder">
                      $
                      {totalWorth.toFixed(3)}
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
                </>
              )
            }
          </div>
        </>
      )}

    </div>
  );
}

export default App;
