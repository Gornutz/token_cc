import { TokenCc } from '../target/types/token_cc';
import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SystemProgram, PublicKey, LAMPORTS_PER_SOL, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import assert from 'assert';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { NodeWallet } from '@project-serum/anchor/dist/cjs/provider';

describe('token_cc', () => {

  let provider = anchor.Provider.env();
  anchor.setProvider(provider)
  const program = anchor.workspace.TokenCc as Program<TokenCc>;
  const wallet = program.provider.wallet as NodeWallet;
  const mintAuthority = new anchor.web3.Keypair();
  const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new anchor.web3.PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
  );

  const DEMO_WALLET_SECRET_KEY = new Uint8Array([
    55, 120, 252, 207, 243, 10, 75, 178, 253, 12, 118,
    168, 28, 151, 130, 195, 192, 200, 243, 22, 69, 121,
    24, 189, 50, 238, 211, 155, 226, 249, 44, 65, 32,
    32, 74, 163, 135, 38, 117, 170, 51, 208, 203, 214,
    134, 188, 60, 32, 92, 73, 11, 8, 138, 131, 168,
    197, 206, 128, 116, 171, 178, 228, 46, 45
  ]);
  let payer = anchor.web3.Keypair.fromSecretKey(DEMO_WALLET_SECRET_KEY);
  //payer = anchor.web3.Keypair.generate();
  let mintAccount = null;
  let tokenAccount = null;

  console.log("Payer " + payer.publicKey.toBase58());
  const getAtaForMint = async (
    mint: anchor.web3.PublicKey,
    buyer: anchor.web3.PublicKey
  ): Promise<[anchor.web3.PublicKey, number]> => {
    return await anchor.web3.PublicKey.findProgramAddress(
      [buyer.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    );
  };

  before(async () => {

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(payer.publicKey, 0.1 * LAMPORTS_PER_SOL),
      "confirmed"
    );

    mintAccount = await Token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );


    tokenAccount = await mintAccount.createAccount(payer.publicKey);
    await mintAccount.mintTo(
      tokenAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      1
    );
  });

  it('Claim Rewards!', async () => {

    const [mutantMetadataPDA, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("metadata"), mintAccount.publicKey.toBuffer()],
      program.programId
    );

    await program.rpc.addMetadata(
      true,
      {
        accounts: {
          authority: wallet.publicKey,
          mutantMetadata: mutantMetadataPDA,
          mint: mintAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        }
      }
    );

    const [mintAccountPda, mintAccountPdaBump] = await anchor.web3.PublicKey.findProgramAddress(
      [mintAccount.publicKey.toBuffer(), Buffer.from("mint")],
      program.programId
    );

    const [globalVaultData, globalAccountBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("vault_data")],
      program.programId
    );

    const eggplantMint = new anchor.web3.PublicKey("BvRDU1Q7MHrQVPfBMG3hq5dwgZ1d4mYN6BXUAtRav5tx");
    const eggplantPool = new anchor.web3.PublicKey("GTutqVBiU3MPk9zSbvK9gunwzsQR2SLHFruwrrZcXzfR");



    const claimantEggPlantATA = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      eggplantMint,
      payer.publicKey
    );

    console.log("mintAccount : " + mintAccount.publicKey.toBase58());
    console.log("tokenAccount : " + tokenAccount.toBase58());
    console.log("mutantMetadataPDA : " + mutantMetadataPDA.toBase58());
    console.log("userEggPlantAta : " + claimantEggPlantATA.toBase58());
    console.log("globalVaultData : " + globalVaultData.toBase58());
    console.log("mintAccountPDA : " + mintAccountPda.toBase58());


    await program.rpc.claimReward(
      {
        accounts: {
          claimant: payer.publicKey,
          greenpawMintMetadata: mintAccountPda,
          mutantMetadata: mutantMetadataPDA,
          mutantMintAccount: mintAccount.publicKey,
          userEgglplantTokenAccount: claimantEggPlantATA,
          eggplantTokenMint: eggplantMint,
          eggplantPool: eggplantPool,
          vaultData: globalVaultData,
          mutantTokenAccount: tokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
        },
        signers: [payer]
      }
    );


    let data = await program.account.mintData.fetch(mintAccountPda);
    console.log("\n ============================================================= \n");
    console.log("\n Register Owner \n");
    console.log("\nRegister Owner : " + data.owner);
    console.log("Last Claim Date : " + new Date(data.lastClaimTime.toNumber() * 1000));
    console.log("Last Reward : " + data.lastReward.toNumber());
    console.log("Total Rewards : " + data.totalRewards.toNumber());


    await sleep(15);


    await program.rpc.claimReward(
      {
        accounts: {
          claimant: payer.publicKey,
          greenpawMintMetadata: mintAccountPda,
          mutantMetadata: mutantMetadataPDA,
          mutantMintAccount: mintAccount.publicKey,
          userEgglplantTokenAccount: claimantEggPlantATA,
          eggplantTokenMint: eggplantMint,
          eggplantPool: eggplantPool,
          vaultData: globalVaultData,
          mutantTokenAccount: tokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
        },
        signers: [payer]
      }
    );

    let data1 = await program.account.mintData.fetch(mintAccountPda);
    console.log("\n ============================================================= \n");
    console.log("\n Claim Reward after 15 seconds\n");
    console.log("\nCurrent Owner : " + data1.owner);
    console.log("Last Claim Date : " + new Date(data1.lastClaimTime.toNumber() * 1000));
    console.log("Last Reward : " + data1.lastReward.toNumber());
    console.log("Total Rewards : " + data1.totalRewards.toNumber());



    // Transfer token to different owner and claim.
    // console.log("\n ============================================================= \n");
    // console.log("\n Transfer Token to different owner and try claiming the reward. \n");
    // await sleep(15);

    // let payer1 = anchor.web3.Keypair.generate();

    // await provider.connection.confirmTransaction(
    //   await provider.connection.requestAirdrop(payer1.publicKey, 0.1 * LAMPORTS_PER_SOL),
    //   "confirmed"
    // );


    // var ourToken = new Token(
    //   program.provider.connection,
    //   mintAccount.publicKey,
    //   TOKEN_PROGRAM_ID,
    //   payer
    // );

    // // Create associated token accounts for my token if they don't exist yet
    // let fromWalletATA = (await getAtaForMint(mintAccount.publicKey, payer.publicKey))[0];
    // let toWalletATA = (await getAtaForMint(mintAccount.publicKey, payer1.publicKey))[0];

    // console.log("fromWalletATA " + fromWalletATA);
    // console.log("toWalletATA " + toWalletATA);

    // // Add token transfer instructions to transaction
    // var transaction = new Transaction()
    //   .add(
    //     Token.createTransferInstruction(
    //       TOKEN_PROGRAM_ID,
    //       fromWalletATA,
    //       toWalletATA,
    //       payer.publicKey,
    //       [],
    //       1
    //     )
    //   );
   
    // await sendAndConfirmTransaction(
    //   program.provider.connection,
    //   transaction,
    //   [payer]
    // );

    // console.log("HELLO  ");

    // await program.rpc.claimReward(
    //   {
    //     accounts: {
    //       claimant: payer1.publicKey,
    //       greenpawMintMetadata: mintAccountPda,
    //       mutantMetadata: mutantMetadataPDA,
    //       mutantMintAccount: mintAccount.publicKey,
    //       userEgglplantTokenAccount: claimantEggPlantATA,
    //       eggplantTokenMint: eggplantMint,
    //       eggplantPool: eggplantPool,
    //       vaultData: globalVaultData,
    //       mutantTokenAccount: tokenAccount,
    //       tokenProgram: TOKEN_PROGRAM_ID,
    //       systemProgram: anchor.web3.SystemProgram.programId,
    //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    //       associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
    //     },
    //     signers: [payer1]
    //   }
    // );

    // let data2 = await program.account.mintData.fetch(mintAccountPda);
    // console.log("\n\nCurrent Owner : " + data2.owner);
    // console.log("Last Claim Date : " + new Date(data2.lastClaimTime.toNumber() * 1000));
    // console.log("Last Reward : " + data2.lastReward.toNumber());
    // console.log("Total Rewards : " + data2.totalRewards.toNumber());
  });
});


const sleep = seconds => new Promise(awaken => setTimeout(awaken, seconds * 1000));
