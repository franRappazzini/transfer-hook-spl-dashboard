import { type NextRequest, NextResponse } from "next/server"
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js"
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAccount,
} from "@solana/spl-token"

export async function POST(request: NextRequest) {
  try {
    const { tokenAddress, recipientAddress, network, tokenProgramId, decimals } = await request.json()

    if (!tokenAddress || !recipientAddress || !network || !tokenProgramId || decimals === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const mintKeypairString = process.env.MINT_KEYPAIR
    if (!mintKeypairString) {
      return NextResponse.json({ error: "MINT_KEYPAIR not configured in environment" }, { status: 500 })
    }

    let mintKeypair: Keypair
    try {
      const keypairArray = JSON.parse(mintKeypairString)
      mintKeypair = Keypair.fromSecretKey(new Uint8Array(keypairArray))
      console.log("[v0] Mint authority loaded:", mintKeypair.publicKey.toString())
    } catch (error) {
      console.error("[v0] Error parsing MINT_KEYPAIR:", error)
      return NextResponse.json({ error: "Invalid MINT_KEYPAIR format" }, { status: 500 })
    }

    const NETWORK_ENDPOINTS: Record<string, string> = {
      localhost: "http://localhost:8899",
      devnet: "https://api.devnet.solana.com",
      mainnet: "https://api.mainnet-beta.solana.com",
    }

    const endpoint = NETWORK_ENDPOINTS[network]
    if (!endpoint) {
      return NextResponse.json({ error: "Invalid network" }, { status: 400 })
    }

    const connection = new Connection(endpoint, "confirmed")

    const mintPubkey = new PublicKey(tokenAddress)
    const recipientPubkey = new PublicKey(recipientAddress)
    const programId = new PublicKey(tokenProgramId)

    const associatedTokenAddress = await getAssociatedTokenAddress(mintPubkey, recipientPubkey, false, programId)

    const transaction = new Transaction()

    try {
      await getAccount(connection, associatedTokenAddress, "confirmed", programId)
      console.log("[v0] ATA already exists:", associatedTokenAddress.toString())
    } catch {
      console.log("[v0] Creating ATA for recipient...")
      transaction.add(
        createAssociatedTokenAccountInstruction(
          mintKeypair.publicKey, // payer
          associatedTokenAddress,
          recipientPubkey,
          mintPubkey,
          programId,
        ),
      )
    }

    const mintAmount = 10 * Math.pow(10, decimals)
    transaction.add(
      createMintToInstruction(
        mintPubkey,
        associatedTokenAddress,
        mintKeypair.publicKey, // mint authority
        mintAmount,
        [],
        programId,
      ),
    )

    console.log("[v0] Sending mint transaction...")
    const signature = await sendAndConfirmTransaction(connection, transaction, [mintKeypair], {
      commitment: "confirmed",
    })

    console.log("[v0] Mint successful! Signature:", signature)

    return NextResponse.json({
      success: true,
      signature,
      message: "Successfully minted 10 tokens",
    })
  } catch (error) {
    console.error("[v0] Mint error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to mint tokens",
      },
      { status: 500 },
    )
  }
}
