use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::{constants::{EXTRA_ACCOUNT_METAS_SEED, TOKEN_STATE_SEED}, instructions::assert_is_transferring, states::TokenState};

// Order of accounts matters for this struct.
// The first 4 accounts are the accounts required for token transfer (source, mint, destination, owner)
// Remaining accounts are the extra accounts required from the ExtraAccountMetaList account
// These accounts are provided via CPI to this program from the token2022 program
#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(
        token::mint = mint, 
        token::authority = owner,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        token::mint = mint,
    )]
    pub destination_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: source token account owner, can be SystemAccount or PDA owned by another program
    pub owner: UncheckedAccount<'info>,

    /// CHECK: ExtraAccountMetaList Account,
    #[account(
        seeds = [EXTRA_ACCOUNT_METAS_SEED, mint.key().as_ref()], 
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [TOKEN_STATE_SEED],
        bump = token_state.bump
    )]
    pub token_state: Account<'info, TokenState>
}


impl <'info> TransferHook<'info> {
    pub fn transfer_hook(&mut self, amount: u64) -> Result<()> {
        msg!("Transfer Hook Invoked");
        assert_is_transferring(&self.owner_token_account)?;

        self.token_state.total_transfers += 1;  
        self.token_state.total_amount_transferred += amount;
        
        Ok(())        
    }
}
