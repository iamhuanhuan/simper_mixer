const ethers = require("ethers");

const utils = {
    insertDecimalPoint: (str, count) => {
        // 使用 padStart 进行前导零填充
        const paddedStr = str.padStart(count + 1, '0');
        const decimalIndex = paddedStr.length - count;
        let result = `${paddedStr.slice(0, decimalIndex)}.${paddedStr.slice(decimalIndex)}`;
        // 确保小数点前至少有一个零
        if (result.startsWith('.')) {
            result = `0${result}`;
        }
        return result;
    },

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
