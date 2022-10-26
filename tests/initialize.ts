import { TokenCc } from '../target/types/token_cc';
import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import assert from 'assert';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { NodeWallet } from '@project-serum/anchor/dist/cjs/provider';

describe('token_cc', () => {

  let provider = anchor.Provider.env();
  anchor.setProvider(provider)
  const program = anchor.workspace.TokenCc as Program<TokenCc>;
  const wallet = program.provider.wallet as NodeWallet;

  const totalTokens = new anchor.BN(500000000000); // Total tokens to send to vault
  const rewardPerSec = new anchor.BN(92600);       // Reward per sec to be given out to user

  it('Initialize Vault !', async () => {

    let eggplantMint = await Token.createMint(
      provider.connection,
      wallet.payer,
      provider.wallet.publicKey,
      null,
      9,
      TOKEN_PROGRAM_ID
    );

    let token = new Token(
      provider.connection,
      eggplantMint.publicKey,
      TOKEN_PROGRAM_ID,
      wallet.payer
    );
    let eggplantTokenAccount = await token.createAccount(provider.wallet.publicKey);

    await eggplantMint.mintTo(
      eggplantTokenAccount,
      provider.wallet.publicKey,
      [],
      100000000000000,
    );

    const [eggplantPool, eggplantPoolBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("eggplant_vault")],
      program.programId
    )


    const [globalVaultData, globalAccountBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("vault_data")],
      program.programId
    );

    console.log("mainAuthority Key : " + provider.wallet.publicKey.toBase58());
    console.log("eggplantMint Key : " + eggplantMint.publicKey.toBase58());
    console.log("eggplantTokenAccount Key : " + eggplantTokenAccount.toBase58());
    console.log("eggplantPool Key : " + eggplantPool.toBase58());
    console.log("globalVaultData Key : " + globalVaultData.toBase58());

    await program.rpc.initializeVault(
      new anchor.BN(globalAccountBump),
      totalTokens,
      rewardPerSec,
      {
        accounts: {
          mainAuthority: provider.wallet.publicKey,
          eggplantTokenAccount: eggplantTokenAccount,
          vaultData: globalVaultData,
          eggplantTokenMint: eggplantMint.publicKey,
          eggplantPool: eggplantPool,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      }
    );
  });
});
