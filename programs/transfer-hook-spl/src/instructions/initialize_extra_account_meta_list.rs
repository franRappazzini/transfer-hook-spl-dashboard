use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenInterface},
};

use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

use crate::{
    constants::{EXTRA_ACCOUNT_METAS_SEED, TOKEN_STATE_SEED},
    states::TokenState,
};

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList Account, must use these seeds
    #[account(
        mut,
        seeds = [EXTRA_ACCOUNT_METAS_SEED, mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = payer,
        space = TokenState::SIZE,
        seeds = [TOKEN_STATE_SEED], 
        bump,
    )]
    pub token_state: Account<'info, TokenState>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> InitializeExtraAccountMetaList<'info> {
    pub fn initialize_extra_account_meta_list(
        &mut self,
        program_id: &Pubkey,
        extra_account_meta_list_bump: u8,
        token_state_bump: u8,
    ) -> Result<()> {
        // The `addExtraAccountsToInstruction` JS helper function resolving incorrectly
        let account_metas = vec![ExtraAccountMeta::new_with_seeds(
            &[Seed::Literal {
                bytes: TOKEN_STATE_SEED.to_vec(),
            }],
            false, // is_signer
            true,  // is_writable
        )?];

        // calculate account size
        let account_size = ExtraAccountMetaList::size_of(account_metas.len()).unwrap() as u64;
        // calculate minimum required lamports
        let lamports = Rent::get()?.minimum_balance(account_size as usize);

        let mint = self.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            EXTRA_ACCOUNT_METAS_SEED,
            &mint.as_ref(),
            &[extra_account_meta_list_bump],
        ]];

        // create ExtraAccountMetaList account
        system_program::create_account(
            CpiContext::new(
                self.system_program.to_account_info(),
                system_program::CreateAccount {
                    from: self.payer.to_account_info(),
                    to: self.extra_account_meta_list.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            lamports,
            account_size,
            program_id,
        )?;

        // initialize ExtraAccountMetaList account with extra accounts
        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut self.extra_account_meta_list.try_borrow_mut_data()?,
            &account_metas,
        )
        .unwrap();

        self.token_state.set_inner(TokenState{
            total_transfers: 0,
            total_amount_transferred: 0,
            bump: token_state_bump,
        });

        Ok(())
    }
}
