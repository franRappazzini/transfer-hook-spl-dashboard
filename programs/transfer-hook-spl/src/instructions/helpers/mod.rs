use std::cell::RefMut;

use anchor_lang::prelude::*;
use anchor_spl::{
    token_2022::spl_token_2022::{
        extension::{
            transfer_hook::TransferHookAccount, BaseStateWithExtensionsMut,
            PodStateWithExtensionsMut,
        },
        pod::PodAccount,
    },
    token_interface::TokenAccount,
};

use crate::errors::HookSplError;

pub fn assert_is_transferring<'info>(
    source_token_account: &InterfaceAccount<'info, TokenAccount>,
) -> Result<()> {
    let source_token_info = source_token_account.to_account_info();
    let mut account_data_ref: RefMut<&mut [u8]> = source_token_info.try_borrow_mut_data()?;
    let mut account = PodStateWithExtensionsMut::<PodAccount>::unpack(*account_data_ref)?;
    let account_extension = account.get_extension_mut::<TransferHookAccount>()?;

    if !bool::from(account_extension.transferring) {
        return err!(HookSplError::IsNotCurrentlyTransferring);
    }

    Ok(())
}
