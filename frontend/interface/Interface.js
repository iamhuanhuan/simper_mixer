import React, { useState } from "react";
import { ethers, formatEther, toBeHex } from 'ethers';
import { Interface as EthersInterface } from 'ethers';
import utils from "../utils/utils";
import { recoverAddress } from "ethers";

// 导入电路中的 witness calculator，根据实际路径修改
const wc = require("../circuit/witness_calculator.js");

// 导入合约JSON，根据实际路径修改
const mixerJSON = require("../json/Mixer.json");
const mixerABI = mixerJSON.abi;
const mixerInterface = new EthersInterface(mixerABI);

const mixerAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

// 导入CSS Module
import styles from './Interface.module.css';

// 导入图片
import Image from 'next/image';
import mixer from './mixer.png';

const Interface = () => {
    console.log(mixer);
    const [account, updateAccount] = useState(null);
    const [proofElements, updateProofElements] = useState(null);
    const [proofStringEl, updateProofStringEl] = useState(null);
    const [textArea, updateTextArea] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 新增: currentOperation用来区分是deposit还是withdraw
    const [currentOperation, setCurrentOperation] = useState(null); 
    // currentOperation 取值:
    // null: 无操作
    // 'depositing': 正在存款
    // 'withdrawing': 正在取款

    const fetchBalance = async (address) => {
        try {
            const balanceHex = await window.ethereum.request({
                method: "eth_getBalance",
                params: [address, "latest"]
            });
            const formattedBalance = formatEther(balanceHex);
            updateAccount((prev) => ({
                ...prev,
                balance: formattedBalance
            }));
        } catch (e) {
            console.log('Error fetching balance:', e);
            setError("Failed to fetch balance.");
        }
    };

    const connectWallet = async () => {
        try {
            if (!window.ethereum){
                alert("Please install Metamask.");
                throw "no-metamask";
            }

            setLoading(true);
            setError(null);

            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            const chainId = window.ethereum.networkVersion;
            const currentAccount = accounts[0];

            const balanceHex = await window.ethereum.request({
                method: "eth_getBalance",
                params: [currentAccount, "latest"]
            });

            const formattedBalance = formatEther(balanceHex);

            updateAccount({
                chainId: chainId,
                address: currentAccount,
                balance: formattedBalance
            });

            setLoading(false);

        } catch (e) {
            console.log('Error in connectWallet:', e);
            setError("Failed to connect wallet.");
            setLoading(false);
        }
    };

    const depositEther = async () => {
        try {
            setLoading(true);
            setError(null);
            setCurrentOperation('depositing'); // 开始存款操作

            const secret = ethers.toBigInt(ethers.getBytes(ethers.randomBytes(32))).toString();
            const nullifier = ethers.toBigInt(ethers.getBytes(ethers.randomBytes(32))).toString();

            const input = {
                secret: utils.BN256ToBin(secret).split(""),
                nullifier: utils.BN256ToBin(nullifier).split("")
            };

            var res = await fetch("/deposit.wasm");
            var buffer = await res.arrayBuffer();
            var depositWitnessCalculator = await wc(buffer);

            const r = await depositWitnessCalculator.calculateWitness(input, 0);

            const commitment = r[1];
            const nullifierHash = r[2];

            const value = toBeHex(BigInt("100000000000000000")); // 0.1 ETH

            const tx = {
                to: mixerAddress,
                from: account.address,
                value: value,
                data: mixerInterface.encodeFunctionData("deposit", [commitment])
            };

            const txHash = await window.ethereum.request({ method: "eth_sendTransaction", params: [tx] });
            const receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [txHash] });
            const log = receipt.logs[0];

            const decodedData = mixerInterface.decodeEventLog("Deposit", log.data, log.topics);
            console.log("decodedData:", decodedData);

            const proofElements = {
                root: utils.BNToDecimal(decodedData.root),
                nullifierHash: `${nullifierHash}`,
                secret: secret,
                nullifier: nullifier,
                hashPairings: decodedData.hashPairings.map((n) => (utils.BNToDecimal(n))),
                hashDirections: decodedData.pairDirection.map((n) => (utils.BNToDecimal(n))),
                commitment: `${commitment}`
            };

            console.log(proofElements);

            updateProofElements(btoa(JSON.stringify(proofElements)));

            await fetchBalance(account.address);

            setLoading(false);
            setCurrentOperation(null); // 操作完成重置操作状态

        } catch(e) {
            console.log(e);
            setError("Deposit failed.");
            setLoading(false);
            setCurrentOperation(null);
        }
    };

    const withdraw = async () => {
        try {
            if(!textArea || !textArea.value){
                alert("Please input the proof of deposit");
                return;
            }

            setLoading(true);
            setError(null);
            setCurrentOperation('withdrawing'); // 开始取款操作

            const SnarkJS = window['snarkjs'];

            const proofString = textArea.value;
            const proofEl = JSON.parse(atob(proofString));

            const proofInput = {
                "root": proofEl.root,
                "nullifierHash": proofEl.nullifierHash,
                "recipient": utils.BNToDecimal(account.address),
                "secret": utils.BN256ToBin(proofEl.secret).split(""),
                "nullifier": utils.BN256ToBin(proofEl.nullifier).split(""),
                "hashPairings": proofEl.hashPairings,
                "hashDirections": proofEl.hashDirections
            };

            const { proof, publicSignals } = await SnarkJS.groth16.fullProve(proofInput, "/withdraw.wasm", "/setup_final.zkey");

            const callInputs = [
                proof.pi_a.slice(0, 2).map(utils.BN256ToHex),
                proof.pi_b.slice(0, 2).map((row) => (utils.reverseCoordinate(row.map(utils.BN256ToHex)))),
                proof.pi_c.slice(0, 2).map(utils.BN256ToHex),
                publicSignals.slice(0, 2).map(utils.BN256ToHex)
            ];

            const callData = mixerInterface.encodeFunctionData("withdraw", callInputs);
            const tx = {
                to: mixerAddress,
                from: account.address,
                data: callData
            };

            const txHash = await window.ethereum.request({ method: "eth_sendTransaction", params: [tx] });
            const receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [txHash] });
            console.log(receipt);

            await fetchBalance(account.address);

            setLoading(false);
            setCurrentOperation(null); // 操作完成重置操作状态

        } catch(e) {
            console.log(e);
            setError("Withdraw failed.");
            setLoading(false);
            setCurrentOperation(null);
        }
    };

    const copyProof = () => {
        if(proofStringEl){
            navigator.clipboard.writeText(proofStringEl.innerHTML);
        }  
    };


    // 根据currentOperation和loading状态决定按钮文字
    const depositButtonText = currentOperation === 'depositing' && loading ? "Depositing..." : "Deposit 0.1 ETH";
    const withdrawButtonText = currentOperation === 'withdrawing' && loading ? "Withdrawing..." : "Withdraw 0.1 ETH";
    const copyButtonText = loading && currentOperation === 'depositing' ? "Copying..." : "Copy Proof"; 
    // 当存款时显示Copying...不一定是必须的，这里仅作为示例，如果不想区分，可以直接copyButtonText = "Copy Proof";

    return (
        <div className={styles.interfaceContainer}>
            <div className={styles.interfaceCard}>
                {/* 显示图片作为标题的一部分 */}
                <Image
                    src={mixer}
                    alt="mixer"
                    className={styles.titleImage}
                    width={800}   // 你想要的宽度
                    height={200}  // 根据比例选择高度，或仅指定width让Next.js自动等比缩放
                />
                <h1 className={styles.interfaceTitle}>ETH 混币程序</h1>

                <div className={styles.walletSection}>
                    {account ? (
                        <div className={styles.walletInfo}>
                            <h2>Wallet Information</h2>
                            <p><strong>Chain ID:</strong> {account.chainId}</p>
                            <p><strong>Address:</strong> {account.address}</p>
                            <p><strong>Balance:</strong> {account.balance} ETH</p>
                        </div>
                    ) : (
                        <div className={styles.buttonContainer}>
                            <button 
                                onClick={connectWallet} 
                                className={styles.button}
                                disabled={loading}
                            >
                                {loading ? "Connecting..." : "Connect Wallet"}
                            </button>
                        </div>
                    )}
                </div>

                <hr className={styles.separator} />

                {account && (
                    <div className="deposit-section">
                        {proofElements ? (
                            <div className={styles.proofSection}>
                                <h2>Proof of Deposit</h2>
                                <pre ref={(proofStringEl) => { updateProofStringEl(proofStringEl); }}>
                                    {proofElements}
                                </pre>
                                <button 
                                    onClick={copyProof} 
                                    className={`${styles.button} ${styles.copy}`}
                                    disabled={loading}
                                >
                                    {copyButtonText}
                                </button>
                            </div>
                        ) : (
                            <div className={styles.buttonContainer}>
                                <button 
                                    onClick={depositEther} 
                                    className={`${styles.button} ${styles.deposit}`}
                                    disabled={loading || currentOperation === 'withdrawing'}
                                >
                                    {depositButtonText}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <hr className={styles.separator} />

                {account ? (
                    <div className="withdraw-section">
                        <label htmlFor="proof" className={styles.label}>Enter Proof of Deposit</label>
                        <textarea 
                            id="proof"
                            ref={(ta) => {updateTextArea(ta);}}
                            className={styles.textarea}
                            rows="4"
                            placeholder="Paste your proof here..."
                            disabled={loading || currentOperation === 'depositing'}
                        ></textarea>
                        <div className={styles.buttonContainer}>
                            <button 
                                onClick={withdraw} 
                                className={`${styles.button} ${styles.withdraw}`}
                                disabled={loading || currentOperation === 'depositing'}
                            >
                                {withdrawButtonText}
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className={styles.errorMessage}>Please connect your Metamask wallet to proceed.</p>
                )}

                {error && (
                    <p className={styles.errorMessage}>{error}</p>
                )}
            </div>
        </div>
    );
};

export default Interface;
