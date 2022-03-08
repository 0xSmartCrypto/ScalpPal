import './App.css'

import { useEffect, useState } from 'react'
import {
  useWallet,
  useConnectedWallet,
  WalletStatus,
} from '@terra-money/wallet-provider'

import * as execute from './contract/execute'
import * as query from './contract/query'
import { ConnectWallet } from './components/ConnectWallet'

import { LCDClient, Coin, MsgSwap } from '@terra-money/terra.js'

const terra = new LCDClient({
  URL: 'https://lcd.terra.dev',
  chainID: 'columbus-5',
});

/* @dev: to something
  - get the price of LUNA 5 mins ago
  - if current price > price 5 mins ago, swap LUNA to UST
  - else swap UST to LUNA
  - UI
  - vercel deployment
 */ 
function App() {
  const [count, setCount] = useState(null)
  const [updating, setUpdating] = useState(true)
  const [resetValue, setResetValue] = useState(0)
  const [swapRate, setSwapRate] = useState(null)
  const [priceLuna, setPriceLuna] = useState(null)
  const [swapStr, setSwapStr] = useState("LUNA to UST")

  const { status } = useWallet()

  const connectedWallet = useConnectedWallet()

  useEffect(() => {
    terra.wasm.contractQuery(
      // bluna-luna pair contract address  
      "terra1jxazgm67et0ce260kvrpfv50acuushpjsz2y0p",
      {"pool": {}}
    )
    .then((result) => { 
      let bluna;
      let luna;
      try {
        // bluna address
        if (result.assets[0].info.token.contract_addr === "terra1kc87mu460fwkqte29rquh4hc20m54fxwtsx7gp") {
          bluna = result.assets[0].amount;
        }        
        luna = result.assets[1].amount;   
      } catch(e) {
        console.log("Error");
      }
      const rate = (luna/bluna) * 0.997;
      setSwapRate(rate);
      console.log("Swap Rate = " + rate + " bLUNA:LUNA"); //deducting 0.3% swap fee
    });
  }, [])

  useEffect(() => {
    terra.market.swapRate(new Coin('uluna', 10000), 'uusd')
    .then((result) => {
      console.log('LUNA price', result.amount.d[0]/10000, 'usd');
      setPriceLuna(result.amount.d[0]/10000);
    });
  }, [])

  const onClickIncrement = async () => {
    setUpdating(true)
    await execute.increment(connectedWallet)
    setCount((await query.getCount(connectedWallet)).count)
    setUpdating(false)
  }

  const onClickReset = async () => {
    setUpdating(true)
    console.log(resetValue)
    await execute.reset(connectedWallet, resetValue)
    setCount((await query.getCount(connectedWallet)).count)
    setUpdating(false)
  }

  const onClickSwap = async () => {
    console.log('swapping');
    setUpdating(true)
    
    // swap luna to ust
    // const swap = new MsgSwap(
    //   connectedWallet.walletAddress,
    //   new Coin('uluna', 1000000),
    //   'uusd'
    // )
    // swap ust to luna
    const swap = new MsgSwap(
      connectedWallet.walletAddress,
      new Coin('uusd', 10000000000),
      'uluna'
    )
    // const memo = "Swap luna to ust now!"
    const memo = "Swap ust to luna now!"
    /*
    export interface CreateTxOptions {
      msgs: Msg[];
      fee?: Fee;
      memo?: string;
      gas?: string;
      gasPrices?: Coins.Input;
      gasAdjustment?: Numeric.Input;
      feeDenoms?: string[];
      timeoutHeight?: number;
    }
    */
    const tx = await connectedWallet.sign({
      msgs: [swap],
      memo,
    })
    
    const result = await connectedWallet.post(tx)
    .catch((err) => { console.error(err) })

    console.log('swap result', result)
    setUpdating(false)
  }

  return (
    <div className="App">
      <header className="App-header">
        <div style={{ display: 'inline' }}>
          COUNT: {count} {updating ? '(updating . . .)' : ''}
          <button onClick={onClickIncrement} type="button">
            {' '}
            +{' '}
          </button>
        </div>
        {status === WalletStatus.WALLET_CONNECTED && (
          <div style={{ display: 'inline' }}>
            <input
              type="number"
              onChange={(e) => setResetValue(+e.target.value)}
              value={resetValue}
            />
            <button onClick={onClickReset} type="button">
              {' '}
              reset{' '}
            </button>
          </div>
        )}
        <ConnectWallet />
      </header>
      <div>
        <h1>Swap Rate: {swapRate} bLUNA:LUNA</h1>
        <h1>Price of LUNA (5m ago): ${priceLuna}</h1>
        <h1>Price of LUNA (now): ${priceLuna}</h1>        
      </div>
      <div>
        <button className="swap" onClick={onClickSwap}>Swap {swapStr}</button>
      </div>
    </div>
  )
}

export default App
