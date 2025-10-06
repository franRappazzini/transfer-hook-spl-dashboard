mod constants;
mod errors;
mod instructions;
mod states;

use anchor_lang::prelude::*;
use instructions::*;
use spl_discriminator::SplDiscriminate;
use spl_transfer_hook_interface::instruction::ExecuteInstruction;
use spl_transfer_hook_interface::instruction::InitializeExtraAccountMetaListInstruction;

declare_id!("4MGBD8eZQYLY1mBpuS6uXZw4qryZFccaUUySVTga7jZ9");

#[program]
pub mod transfer_hook_spl {

    use super::*;

    #[instruction(discriminator = ExecuteInstruction::SPL_DISCRIMINATOR_SLICE)]
    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        ctx.accounts.transfer_hook(amount)
    }

    #[instruction(discriminator = InitializeExtraAccountMetaListInstruction::SPL_DISCRIMINATOR_SLICE)]
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        ctx.accounts.initialize_extra_account_meta_list(
            ctx.program_id,
            ctx.bumps.extra_account_meta_list,
            ctx.bumps.token_state,
        )
    }
}
