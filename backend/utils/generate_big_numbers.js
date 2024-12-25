const { ethers } = require("ethers");

const num = 10;

async function generate() {
    for (let i = 0; i < num; i++) {
        // 使用 toBigInt 将 32 字节随机数转换为大整数
        let randomBigInt = ethers.toBigInt(ethers.getBytes(ethers.randomBytes(32)));
        // ethers.randomBytes(32) 生成的是高质量的加密随机数，符合加密随机数生成器（CSPRNG）的要求，确保每一位的分布是均匀的。
        console.log(randomBigInt.toString());
    }
}

generate()
    .catch((err) => { console.log(err); process.exit(1); });
