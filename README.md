# Transfer Hook SPL Dashboard

Monorepo that combines:

1. **On-chain program (Anchor)** implementing logic for an **SPL Token-2022** mint that uses the **Transfer Hook** extension (and is prepared to also leverage the **Metadata** extension).
2. **Next.js dashboard** (App Router) to visualize metrics, run test transfers and interact with the token + hook logic.

---

## 📦 Repository Structure

```
root
├─ Anchor.toml
├─ Cargo.toml                # Rust workspace
├─ programs/
│  └─ transfer-hook-spl/     # Anchor program source
├─ migrations/               # Anchor deploy scripts
├─ tests/                    # TypeScript tests (ts-mocha / Anchor)
├─ target/                   # Build artifacts + generated IDL & types
├─ app/                      # Next.js frontend (dashboard)
│  ├─ app/                   # Routes (App Router)
│  ├─ components/            # UI components (charts, modals, cards…)
│  ├─ hooks/                 # React hooks (wallet, toast, responsive)
│  ├─ lib/                   # Frontend utilities
│  └─ public/ / styles/      # Assets & global styles
├─ scripts/                  # Utility scripts (keypairs, etc.)
└─ README.md
```

---

## 🪙 What Is an SPL Token-2022 with Transfer Hook?

`spl-token-2022` is an evolution of the original SPL token program adding **modular extensions** to mint and token accounts. Relevant extensions here:

- **Transfer Hook**: Forces every (hook-enabled) transfer to invoke an additional program prior to completion, enabling custom logic: allow/deny lists, dynamic fees, KYC gating, accounting, emission throttling, etc.
- **Metadata / Metadata Pointer**: Lets you embed or reference structured metadata (name, symbol, URI, attributes) natively via Token-2022 without depending solely on external metadata protocols (can coexist with Metaplex/NFT metadata).

### Simplified Transfer Hook Flow

1. Client sends a `TransferCheckedWithTransferHook` instruction.
2. The Token-2022 runtime sees the mint has the `TransferHook` extension initialized.
3. An optional `ExtraAccountMetaList` supplies additional accounts needed by your hook program.
4. Your hook program is invoked before the token state mutates.
5. If it returns success, the transfer finalizes; otherwise it aborts.

> In this repo the Anchor program exposes `initialize_extra_account_meta_list` (IDL: `initializeExtraAccountMetaList`) to configure/persist the extra account metas required for subsequent transfers.

---

## ⚙️ Prerequisites

Install / have available:

- Node.js >= 18 (you may use yarn/npm/pnpm; Anchor.toml points to yarn)
- Yarn (or npm/pnpm) for JS dependencies
- Rust toolchain + cargo
- Anchor CLI >= 0.31.1
- Solana CLI >= 1.18.x

Verify:

```
solana --version
anchor --version
rustc --version
node -v
```

Optional: `solana-test-validator` (bundled in Solana CLI) for a fresh local cluster.

---

## 🧪 Quick Local Environment Setup

### 1. Start Local Validator

```bash
solana config set --url localhost
solana-test-validator --reset --limit-ledger-size 2000 \
  --account-dir test-ledger/accounts \
  --ledger test-ledger
```

In another terminal airdrop SOL:

```bash
solana airdrop 5
```

### 2. Generate / Use Keypairs

If you do not yet have `~/.config/solana/id.json`:

```bash
solana-keygen new --outfile ~/.config/solana/id.json
```

Utility script example (TypeScript):

```bash
npx ts-node scripts/createKeypairs.ts
```

### 3. Install Dependencies

```bash
# Anchor workspace + tests (root)


# Next.js dashboard
cd app && npm install   # (or: yarn install / pnpm install)
```

### 4. Build the Anchor Program

From repo root:

```bash
anchor build
```

Generates IDL at `target/idl/transfer_hook_spl.json` and TS types at `target/types/`.

### 5. (Optional) Update Program ID

If you produced a fresh deploy key:

1. Replace the address in `[programs.localnet]` inside `Anchor.toml`.
2. Ensure it matches any `declare_id!` macro in your Rust program (if added).

### 6. Deploy to Localnet

```bash
anchor deploy
```

The `.so` artifact is placed into `target/deploy/`.

### 7. Run Tests (Anchor + Token-2022)

Main suites:

- `tests/transfer-hook-spl-creating-tokens.test.ts`: Creates a mint with TransferHook, accounts and performs transfer.
- `tests/transfer-hook-spl.ts`: Assumes an existing mint (replace the hardcoded public key).

Run:

```bash
---
# Internally: ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*spl.ts
```

### 8. Manual Mint Creation with Transfer Hook

Steps (mirrors test logic):

1. Compute mint size: `getMintLen([ExtensionType.TransferHook])`.
2. Create mint account via `SystemProgram.createAccount` targeting `TOKEN_2022_PROGRAM_ID`.
3. Initialize extension: `createInitializeTransferHookInstruction(mint, authority, hookProgramId, TOKEN_2022_PROGRAM_ID)`.
4. Initialize mint: `createInitializeMintInstruction`.
5. Create associated token accounts (ATAs) and mint tokens.
6. Initialize `ExtraAccountMetaList` using `program.methods.initializeExtraAccountMetaList()`.
7. Transfer using `createTransferCheckedWithTransferHookInstruction`.

### 9. Launch the Next.js Dashboard

```bash
cd app
npm run dev
```

Open: http://localhost:3000

Dashboard uses `@solana/wallet-adapter` plus Radix UI + Tailwind for modals, charts and interaction surfaces.

## 🧩 Dashboard ↔ Anchor Integration

- Frontend can import the generated IDL (`target/idl/transfer_hook_spl.json`) or TS types (`target/types/transfer_hook_spl.ts`) to instantiate an Anchor `Program` client.
- For Token-2022 actions rely on helpers from `@solana/spl-token` and always pass `TOKEN_2022_PROGRAM_ID`.
- Transfer Hook executes on-chain only when using `createTransferCheckedWithTransferHookInstruction`.

### Suggested UI Flow

1. Connect wallet.
2. Display mint status (supply, decimals, authority).
3. Button to create `ExtraAccountMetaList` (if missing).
4. Transfer form (uses hook) → show transaction signature.
5. Metrics: total volume, holders, failed attempts (once hook logic enforces rules).

---

## 🗂 Metadata Extension

While current tests only initialize `TransferHook`, you can add Metadata support:

1. Include `ExtensionType.MetadataPointer` when computing `mintLen`.
2. Call `createInitializeMetadataPointerInstruction` (when available in your lib version) before `createInitializeMintInstruction`.
3. Write or reference on-chain metadata (name, symbol, URI) and surface it in the dashboard.

This enables richer UX without external metadata services.

---

## 🛠 Troubleshooting

| Issue                                       | Common Cause                                      | Fix                                                               |
| ------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `Program failed to complete`                | Program ID mismatch (Anchor.toml vs deployed key) | Run `anchor keys list`, update Anchor.toml, rebuild.              |
| `Account does not exist` when creating ATAs | Instruction order or insufficient rent SOL        | Airdrop more SOL and create ATAs before minting.                  |
| `Extension mismatch`                        | Mint space didn’t include all needed extensions   | Recompute `mintLen` with every extension before account creation. |
| Transfer doesn’t trigger hook               | Used standard `transfer` instruction              | Use `createTransferCheckedWithTransferHookInstruction`.           |
| Serialization / IDL errors in tests         | Stale IDL/types                                   | Delete `target/` then `anchor build` again.                       |

---

## 🧪 Command Cheatsheet

```bash
# Build + Deploy
anchor build
anchor deploy

# Tests
yarn test

# Local validator (separate terminal)
solana-test-validator -r

# Airdrop
solana airdrop 5

# Show Program IDs
anchor keys list
```

---

## 🚀 Next Ideas

- Add meaningful hook logic (whitelist / dynamic fee scheduler).
- Persist metrics on-chain or via a lightweight indexer and surface them in the dashboard.
- Implement full Metadata extension and NFT-style preview.
- Add negative tests (expected rejections) to demonstrate hook value.
- Provide wallet-specific quick-connect UI (Phantom / Solflare buttons).

---

## 📄 License

MIT License. See `LICENSE` file for details.

---

## 🤝 Contributing

PRs and suggestions welcome. Please run lint + tests before submitting.
