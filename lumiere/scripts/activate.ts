// scripts/activate.ts
// Run: npx tsx scripts/activate.ts
// Requires: SOLANA_WALLET_PRIVATE_KEY in .env

import * as anchor from '@coral-xyz/anchor'
import { Connection, PublicKey, Keypair } from '@solana/web3.js'
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token'
import axios from 'axios'
import bs58 from 'bs58'

const API_ORIGIN = 'https://txline.txodds.com'
const RPC_URL = 'https://api.mainnet-beta.solana.com'
const PROGRAM_ID = new PublicKey('9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA')
const TXL_MINT = new PublicKey('Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL')

async function activate() {
  const privateKeyBase58 = process.env.SOLANA_WALLET_PRIVATE_KEY
  if (!privateKeyBase58) {
    console.log('Skipping activation: SOLANA_WALLET_PRIVATE_KEY not found in .env.local')
    return
  }

  const keypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58))
  const connection = new Connection(RPC_URL, 'confirmed')
  const wallet = new anchor.Wallet(keypair)
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  anchor.setProvider(provider)

  const authRes = await axios.post(`${API_ORIGIN}/auth/guest/start`)
  const jwt = authRes.data.token
  console.log('Guest JWT obtained:', jwt)

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from('token_treasury_v2')], PROGRAM_ID)
  const tokenTreasuryVault = getAssociatedTokenAddressSync(TXL_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from('pricing_matrix')], PROGRAM_ID)
  const userTokenAccount = getAssociatedTokenAddressSync(TXL_MINT, keypair.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)

  console.log('PDAs Derived:')
  console.log('  tokenTreasuryPda:', tokenTreasuryPda.toBase58())
  console.log('  tokenTreasuryVault:', tokenTreasuryVault.toBase58())
  console.log('  pricingMatrixPda:', pricingMatrixPda.toBase58())
  console.log('  userTokenAccount:', userTokenAccount.toBase58())
}

activate().catch(console.error)
