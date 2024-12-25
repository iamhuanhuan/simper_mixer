import { useState } from "react";
import { ethers, formatEther, toBeHex } from 'ethers';
import { Interface as EthersInterface } from 'ethers';
import utils from "../utils/utils";
import { recoverAddress } from "ethers";

// 导入电路中的 witness calculator
const wc = require("../circuit/witness_calculator.js");

const mixerJSON = require("../json/Mixer.json");
const mixerABI = mixerJSON.abi;
const mixerInterface = new EthersInterface(mixerABI);

const mixerAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const Interface = () => {
    // 默认使用metamask钱包
    const [account, updateAccount] = useState(null);
    const [proofElements, updateProofElements] = useState(null);
    const [proofStringEl, updateProofStringEl] = useState(null);
    const [textArea, updateTextArea] = useState(null);

    // 连接钱包
    const connectWallet = async () => {
        try {
            if (!window.ethereum){
                alert("Please install Metamask.");
                throw "no-metamask";
            }
    
            const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            const chainId = window.ethereum.networkVersion;
    
            const currentAccount = accounts[0];
    
            // console.log('ethers:', ethers);
    
            const balanceHex = await window.ethereum.request({
                method: "eth_getBalance",
                params: [currentAccount, "latest"]
            });
    
            const formattedBalance = formatEther(balanceHex);
    
            // console.log('Formatted Balance:', formattedBalance);
    
            // 更新用户账户信息
            updateAccount({
                chainId: chainId,
                address: currentAccount,
                balance: formattedBalance
            });

        } catch (e) {
            console.log('Error in connectWallet:', e);
        }
    };

    // 存 0.1 ether
    const depositEther = async () => {
        // 随机生成 secret 和 nullifier 
        const secret = ethers.toBigInt(ethers.getBytes(ethers.randomBytes(32))).toString();
        const nullifier = ethers.toBigInt(ethers.getBytes(ethers.randomBytes(32))).toString();

        // 将生成的大数转换成二进制
        const input = {
            secret: utils.BN256ToBin(secret).split(""),
            nullifier: utils.BN256ToBin(nullifier).split("")
        };

        // console.log(input);

        var res = await fetch("/deposit.wasm");
        var buffer = await res.arrayBuffer();
        var depositWitnessCalculator = await wc(buffer);

        // 使用witness calculator计算结果
        const r = await depositWitnessCalculator.calculateWitness(input, 0);

        const commitment = r[1];
        const nullifierHash = r[2];

        // console.log(commitment);
        // console.log(nullifierHash);

        const value = toBeHex(BigInt("100000000000000000"));;
        // console.log(value);

        const tx = {
            to: mixerAddress,
            from: account.address,
            value: value,
            data: mixerInterface.encodeFunctionData("deposit", [commitment])
        };

        try{
            const txHash = await window.ethereum.request({ method: "eth_sendTransaction", params: [tx] });
            const receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [txHash] });
            const log = receipt.logs[0];
            // console.log(receipt);

            const decodedData = mixerInterface.decodeEventLog("Deposit", log.data, log.topics);
            console.log("decodedData:");
            console.log(decodedData);

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
        }catch(e){
            console.log(e);
        }
    };

    // 取 0.1 ether
    const withdraw = async () => {
        // updateWithdrawButtonState(ButtonState.Disabled);

        // textArea里就是构造的proof
        if(!textArea || !textArea.value){ alert("Please input the proof of deposite"); }

        try{
            // 导入snarkjs构造零知识证明
            const SnarkJS = window['snarkjs'];

            const proofString = textArea.value;
            const proofElements = JSON.parse(atob(proofString));

            // receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [proofElements.txHash] });
            // console.log(receipt);
            // if(!receipt){ throw "empty-receipt"; }

            // const log = receipt.logs[0];
            // const decodedData = mixerInterface.decodeEventLog("Deposit", log.data, log.topics);

            const proofInput = {
                "root": proofElements.root,
                "nullifierHash": proofElements.nullifierHash,
                "recipient": utils.BNToDecimal(account.address),
                "secret": utils.BN256ToBin(proofElements.secret).split(""),
                "nullifier": utils.BN256ToBin(proofElements.nullifier).split(""),
                "hashPairings": proofElements.hashPairings,
                "hashDirections": proofElements.hashDirections
            };

            // 构造证明，得到proof和公开的信息
            const { proof, publicSignals } = await SnarkJS.groth16.fullProve(proofInput, "/withdraw.wasm", "/setup_final.zkey");
            // console.log(proof);
            // console.log(publicSignals);

            /*
            callInputs要和Mix.sol的withdraw保持一致
            function withdraw(
                uint[2] memory a,
                uint[2][2] memory b,
                uint[2] memory c,
                uint[2] memory input    // 最后一项recipient不作为变量输入，而是直接读取msg.sender，以防止盗取proof修改地址
            ) external payable nonReentrant
            */
            const callInputs = [
                proof.pi_a.slice(0, 2).map(utils.BN256ToHex),
                proof.pi_b.slice(0, 2).map((row) => (utils.reverseCoordinate(row.map(utils.BN256ToHex)))),
                proof.pi_c.slice(0, 2).map(utils.BN256ToHex),
                publicSignals.slice(0, 2).map(utils.BN256ToHex)
            ];
            // console.log(callInputs);

            const callData = mixerInterface.encodeFunctionData("withdraw", callInputs);
            const tx = {
                to: mixerAddress,
                from: account.address,
                data: callData
            };
            // console.log(tx);
            const txHash = await window.ethereum.request({ method: "eth_sendTransaction", params: [tx] });
            const receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [txHash] });
            console.log(receipt);

            // var receipt;
            // while(!receipt){
            //     receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [txHash] });
            //     await new Promise((resolve, reject) => { setTimeout(resolve, 1000); });
            // }

            // if(receipt){ updateWithdrawalSuccessful(true); }
        }catch(e){
            console.log(e);
        }
    };

    // 该函数用来复制proof
    const copyProof = () => {
        if(proofStringEl){
            // flashCopiedMessage();
            navigator.clipboard.writeText(proofStringEl.innerHTML);
        }  
    };
    


    return (
        <div>
            {
                account ? (
                    <div>
                        <p>Chain ID: {account.chainId}</p>
                        <p>Address: {account.address}</p>
                        <p>Balance: {account.balance} ETH</p>
                    </div>
                ) : (
                    <button onClick={connectWallet}>Connect Wallet</button>
                )
            }

            <div>
                <hr/>
            </div>

            {
                account ? (
                    <div>
                        {
                            proofElements ? (
                                <div> 
                                    <p><strong>Proof of Deposite:</strong></p>
                                    <div style={{maxWidth: "100vw", overflowWrap: "break-word"}}>
                                        <span ref={(proofStringEl) => { updateProofStringEl(proofStringEl);}}>{proofElements}</span>
                                    </div>
                                    {
                                        proofStringEl && (
                                            <button onClick={copyProof}>Copy Proof of Deposit</button>
                                        )
                                    }
                                    
                                </div>
                            ) : (
                                <button onClick={depositEther}>Deposite 0.1 ETH</button>
                            )
                        }
                    </div>
                ) : (
                    <p>Please Connect Metamask</p>
                )
            }

            <div>
                <hr/>
            </div>

            {
                account ? (
                    <div>
                        <div>
                            <textarea ref={(ta) => {updateTextArea(ta);}}></textarea>
                        </div> 
                        <button onClick={withdraw}>Withdraw 0.1 ETH</button>
                    </div>
                ) : (
                    <p>Please Connect Metamask</p>
                )
            }

        </div>
    
    )
};

export default Interface;