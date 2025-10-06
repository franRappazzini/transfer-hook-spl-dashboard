use anchor_lang::error_code;

#[error_code]
pub enum HookSplError {
    #[msg("The account is not currently transferring")]
    IsNotCurrentlyTransferring,
}
