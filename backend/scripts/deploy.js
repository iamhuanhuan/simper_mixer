const hre = require("hardhat");

async function main() {
  // 部署 Hasher 合约
  const Hasher = await hre.ethers.getContractFactory("Hasher");
  const hasher = await Hasher.deploy();
  await hasher.waitForDeployment(); 
  const hasherAddress = await hasher.getAddress();
  console.log("Hasher deployed at:", hasherAddress);

  // 部署 Verifier 合约
  const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment(); 
  const verifierAddress = await verifier.getAddress();
  console.log("Verifier deployed at:", verifierAddress);

  // 部署 Mixer 合约，假设只需要 hasherAddress
  const Mixer = await hre.ethers.getContractFactory("Mixer");
  const mixer = await Mixer.deploy(hasherAddress, verifierAddress);
  await mixer.waitForDeployment(); 
  const mixerAddress = await mixer.getAddress();
  console.log("Mixer deployed at:", mixerAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
