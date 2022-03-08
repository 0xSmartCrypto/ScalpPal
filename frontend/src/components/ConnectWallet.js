/* eslint-disable import/no-extraneous-dependencies */
import { useWallet, WalletStatus } from '@terra-dev/use-wallet';

function ConnectWallet() {
  const {
    status,
    availableConnectTypes,
    availableInstallTypes,
    connect,
    install,
    disconnect,
  } = useWallet();

  return (
    <div className="walletSection">
      {status === WalletStatus.WALLET_NOT_CONNECTED && (
        <>
          <p>Connect your wallet to use this app</p>
          {availableInstallTypes.map((connectType) => (
            <button
              key={`install-${connectType}`}
              onClick={() => install(connectType)}
              type="button"
              className="walletButton"
            >
              Install
              {' '}
              {connectType}
            </button>
          ))}
          {availableConnectTypes.map((connectType) => (
            <button
              key={`connect-${connectType}`}
              onClick={() => connect(connectType)}
              type="button"
              className="walletButton"
            >
              Connect
              {' '}
              {connectType}
            </button>
          ))}
        </>
      )}
      {status === WalletStatus.WALLET_CONNECTED && (
        <button onClick={() => disconnect()} type="button" className="walletButton">
          Disconnect
        </button>
      )}
    </div>
  );
}

export default ConnectWallet;
