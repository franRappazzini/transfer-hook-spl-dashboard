use anchor_lang::constant;

pub const DISCRIMINATOR_SIZE: usize = 8;

#[constant]
pub const TOKEN_STATE_SEED: &[u8] = b"token-state";

#[constant]
pub const EXTRA_ACCOUNT_METAS_SEED: &[u8] = b"extra-account-metas";
