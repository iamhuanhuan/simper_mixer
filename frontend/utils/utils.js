const ethers = require("ethers");

const utils = {
    BN256ToBin: (str) => {
        const binaryStr = BigInt(str).toString(2);
        // 使用 padStart 确保二进制字符串长度为256
        return binaryStr.padStart(256, '0');
    },

    BN256ToHex: (n) => {
        let hexStr = BigInt(n).toString(16).padStart(64, '0');
        return `0x${hexStr}`;
    },

    BNToDecimal: (bn) => {
        if (typeof bn === 'string' && bn.startsWith('0x')) {
          return BigInt(bn).toString();
        } else if (typeof bn === 'string') {
          return bn;
        } else if (bn.toString) {
          return bn.toString();
        } else {
          throw new Error('Invalid input type for bn');
        }
      },

    reverseCoordinate: ([x, y]) => [y, x],
};

module.exports = utils;
