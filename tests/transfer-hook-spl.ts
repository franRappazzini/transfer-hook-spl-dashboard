import * as anchor from "@coral-xyz/anchor";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createMintToInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
} from "@solana/spl-token";
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import { Program } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { TransferHookSpl } from "../target/types/transfer_hook_spl";

describe("transfer-hook-spl", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  const { connection, wallet } = provider;

  anchor.setProvider(provider);

  const program = anchor.workspace.transferHookSpl as Program<TransferHookSpl>;

  // Generate keypair to use as address for the transfer-hook enabled mint
  // const mint = new anchor.web3.Keypair();
  const mint = new anchor.web3.PublicKey("8VmaC3gSi64NepD5yf6fkT5hfixbNKbU7mGD7oipWbdv"); // Replace with your mint address created by the CLI
  const decimals = 9;

  // Sender token account address
  const ownerTokenAccount = getAssociatedTokenAddressSync(
    mint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Recipient token account address
  const recipient = anchor.web3.Keypair.generate();
  const destinationTokenAccount = getAssociatedTokenAddressSync(
    mint,
    recipient.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // ExtraAccountMetaList address
  // Store extra accounts required by the custom transfer hook instruction
  // const [extraAccountMetaListPDA] = anchor.web3.PublicKey.findProgramAddressSync(
  //   [Buffer.from("extra-account-metas"), mint.toBuffer()],
  //   program.programId
  // );

  // const [tokenStatePDA] = anchor.web3.PublicKey.findProgramAddressSync(
  //   [Buffer.from("token-state")],
  //   program.programId
  // );

  it.skip("Create Mint Account with Transfer Hook Extension", async () => {
    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(mintLen);

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferHookInstruction(
        mint,
        wallet.publicKey,
        program.programId, // Transfer Hook Program ID
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(mint, decimals, wallet.publicKey, null, TOKEN_2022_PROGRAM_ID)
    );

    const txSig = await sendAndConfirmTransaction(provider.connection, transaction, [
      wallet.payer,
      mint,
    ]);
    console.log(`Transaction Signature: ${txSig}`);
  });

  // Create the two token accounts for the transfer-hook enabled mint
  // Fund the sender token account with 100 tokens
  it("Create Token Accounts and Mint Tokens", async () => {
    // 100 tokens
    const amount = 100 * LAMPORTS_PER_SOL;

    const transaction = new Transaction().add(
      // createAssociatedTokenAccountInstruction(
      //   wallet.publicKey,
      //   ownerTokenAccount,
      //   wallet.publicKey,
      //   mint,
      //   TOKEN_2022_PROGRAM_ID,
      //   ASSOCIATED_TOKEN_PROGRAM_ID
      // ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        destinationTokenAccount,
        recipient.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mint,
        ownerTokenAccount,
        wallet.publicKey,
        amount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer], {
      skipPreflight: true,
    });

    console.log(`Transaction Signature: ${txSig}`);
  });

  // Account to store extra accounts required by the transfer hook instruction
  it("Create ExtraAccountMetaList Account", async () => {
    const initializeExtraAccountMetaListInstruction = await program.methods
      .initializeExtraAccountMetaList()
      .accounts({
        mint: mint,

        // extraAccountMetaList: extraAccountMetaListPDA,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();

    const transaction = new Transaction().add(initializeExtraAccountMetaListInstruction);

    const txSig = await sendAndConfirmTransaction(
      provider.connection,
      transaction,
      [wallet.payer],
      { skipPreflight: true, commitment: "confirmed" }
    );
    console.log("Transaction Signature:", txSig);
  });

  it("Transfer Hook with Extra Account Meta", async () => {
    const amount = 50 * LAMPORTS_PER_SOL;
    const bigIntAmount = BigInt(amount);

    // Standard token transfer instruction
    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      ownerTokenAccount,
      mint,
      destinationTokenAccount,
      wallet.publicKey,
      bigIntAmount,
      decimals,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    const transaction = new Transaction().add(transferInstruction);

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer], {
      skipPreflight: true,
    });
    console.log("Transfer Signature:", txSig);
  });
});
