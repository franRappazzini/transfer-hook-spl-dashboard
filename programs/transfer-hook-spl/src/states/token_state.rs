use anchor_lang::prelude::*;

use crate::constants::DISCRIMINATOR_SIZE;

#[account]
#[derive(InitSpace)]
pub struct TokenState {
    pub total_transfers: u64,
    pub total_amount_transferred: u64,
    pub bump: u8,
}

impl TokenState {
    pub const SIZE: usize = DISCRIMINATOR_SIZE + TokenState::INIT_SPACE;
}
