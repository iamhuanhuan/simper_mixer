pragma circom 2.0.0;

include "./utils/mimc5sponge.circom";
include "./commitment.circom";

template Withdraw() {
    /* 
        root : root hash
        recepient ： 接收者
    */
    signal input root;
    signal input nullifierHash;
    signal input recipient;

    // 不需要commitment输入，可以从secret和nullifier计算出
    signal input secret[256];
    signal input nullifier[256];
    signal input hashPairings[10];
    signal input hashDirections[10];

    // 检测nullifier是否相等
    component cHasher = CommitmentHasher();
    cHasher.secret <== secret;
    cHasher.nullifier <== nullifier;

    // 验证输出是否和提交的nullifierHash相等
    cHasher.nullifierHash === nullifierHash;


    // 检测merkel tree的hash
    component leafHashers[10];

    signal currentHash[10 + 1];
    currentHash[0] <== cHasher.commitment;

    signal left[10];
    signal right[10];

    for(var i = 0; i < 10; i++){
        var d = hashDirections[i];

        leafHashers[i] = MiMC5Sponge(2);

        /* 
            使用下面这种系数的方式避免了电路中的动态条件问题
            在电路中，所有的信息都必须是确定的，所以不能使用条件语句
        */
        left[i] <== (1 - d) * currentHash[i];
        leafHashers[i].ins[0] <== left[i] + d * hashPairings[i];

        right[i] <== d * currentHash[i];
        leafHashers[i].ins[1] <== right[i] + (1 - d) * hashPairings[i];

        leafHashers[i].k <== cHasher.commitment;
        currentHash[i + 1] <== leafHashers[i].o;
    }


    // 验证提交的是否和计算得到的root hash一致
    root === currentHash[10];


    // 给接受者的地址的添加一个约束，否则没法出现在proof中
    signal recipientSquare;
    recipientSquare <== recipient * recipient;
}

// 以下三个变量是公共变量，体现在生成的Verfifier.sol中，可以附加这三个变量作为输入
component main {public [root, nullifierHash, recipient]} = Withdraw();
