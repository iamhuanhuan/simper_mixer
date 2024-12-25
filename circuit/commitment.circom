pragma circom 2.0.0;

include "./utils/pedersen.circom";

template CommitmentHasher() {
    signal input secret[256];
    signal input nullifier[256];
    signal output commitment;
    signal output nullifierHash;

    component commitHasher = Pedersen(512);
    component nullifierHasher = Pedersen(256);

    for(var i = 0; i < 256; i++){
        commitHasher.in[i] <== nullifier[i];
        commitHasher.in[i + 256] <== secret[i];
        nullifierHasher.in[i] <== nullifier[i];
    }

    commitment <== commitHasher.o;
    nullifierHash <== nullifierHasher.o;
}