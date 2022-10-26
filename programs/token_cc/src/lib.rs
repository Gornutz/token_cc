use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{Mint, Token, TokenAccount}};
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_spl::token::{self, Transfer};
use std::str::FromStr;

declare_id!("4JXPnRBhruBCc2fxxGguCYpWwsHYNBrSQYxUPsjNPVAC");

const VAULT_SEED: &str = "eggplant_vault";
const VAULT_DATA_SEED : &str = "vault_data";
const PREFIX: &str = "metadata";
const CENTRAL_AUTHORITY : &str ="MuTDgPfuKagHBdi8A2QZPmV8bb6cSyqcbhvKQxysaCv";


#[program]
pub mod token_cc {

    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>, nonce: u8 ,total_tokens: u64, reward_per_sec: u64) -> ProgramResult {

        msg!("Initialize Vault");
        //Setting Global Vault Data
        let vault_data = &mut ctx.accounts.vault_data;
        vault_data.main_authority = ctx.accounts.main_authority.key();
        vault_data.reward_per_sec = reward_per_sec;
        vault_data.eggplant_token_mint = ctx.accounts.eggplant_token_mint.key();
        vault_data.total_tokens += total_tokens;
        vault_data.bump = nonce;

        // Transfer eggplant token from authority to vault pool
        let cpi_accounts = Transfer {
            from: ctx.accounts.eggplant_token_account.to_account_info(),
            to: ctx.accounts.eggplant_pool.to_account_info(),
            authority: ctx.accounts.main_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, total_tokens)?;
        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> ProgramResult { 
        msg!("CLAIM REWARD CALL !!!");

        //TODO add mint check for update authority

        let cub_metadata = &mut ctx.accounts.mutant_metadata;
        let is_green_paw =  cub_metadata.is_green_paw;
        if is_green_paw == true {
         msg!("Claiming as Green Paw Owner !!!");
         let greenpaw_mint_metadata = &mut ctx.accounts.greenpaw_mint_metadata;
         if greenpaw_mint_metadata.owner != ctx.accounts.claimant.key() {
                msg!("Changing Owner !!!");
                greenpaw_mint_metadata.owner = ctx.accounts.claimant.key();
                greenpaw_mint_metadata.last_claim_time = Clock::get()?.unix_timestamp;
        }  else {
                msg!("Claiming Token !!!");
                let last_claim_time = greenpaw_mint_metadata.last_claim_time;
                let current_time = Clock::get()?.unix_timestamp;
                let reward_per_sec = ctx.accounts.vault_data.reward_per_sec;
                let reward = (current_time - last_claim_time) as u64 * reward_per_sec; 
                greenpaw_mint_metadata.total_rewards += reward;
                greenpaw_mint_metadata.last_reward = reward;

                let seeds = &[VAULT_DATA_SEED.as_bytes(), &[ctx.accounts.vault_data.bump]];
                let signer_seeds = &[&seeds[..]];
            
                let cpi_accounts = Transfer {
                     from: ctx.accounts.eggplant_pool.to_account_info(),
                     to: ctx.accounts.user_egglplant_token_account .to_account_info(),
                     authority: ctx.accounts.vault_data.to_account_info(),
                };
                let cpi_program = ctx.accounts.token_program.to_account_info();
                let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts).with_signer(signer_seeds);
                token::transfer(
                    cpi_ctx,
                  reward,
                )?;

                greenpaw_mint_metadata.owner = ctx.accounts.claimant.key();
                greenpaw_mint_metadata.last_claim_time = Clock::get()?.unix_timestamp;
            }
        }
        else{
            msg!("Not a Green Paw !!!");
            return Err(ErrorCode::NotGreenPaw.into());
        }
        Ok(())
    }


    pub fn change_owner(ctx: Context<ChangeOwner>) -> ProgramResult {
        let mutant_metadata = &mut ctx.accounts.mutant_metadata;
        let is_green_paw =  mutant_metadata.is_green_paw;
        if is_green_paw == true {
            msg!("Changing Owner");
            let greenpaw_mint_metadata = &mut ctx.accounts.greenpaw_mint_metadata;
            if greenpaw_mint_metadata.owner != ctx.accounts.owner.key() {
                greenpaw_mint_metadata.owner = ctx.accounts.owner.key();
                greenpaw_mint_metadata.last_claim_time = Clock::get()?.unix_timestamp;
           }
        }
        Ok(())
    }

    pub fn add_metadata(ctx: Context<AddMetadata> , is_green_paw: bool) -> ProgramResult {
        let state = &mut ctx.accounts.mutant_metadata;
        msg!("Add metadata");
        state.is_green_paw = is_green_paw;
        state.authority = ctx.accounts.authority.to_account_info().key();
        Ok(())
    }

    pub fn update_metadata(ctx: Context<UpdateMetadata> ,  is_green_paw: bool) -> ProgramResult {
        let state = &mut ctx.accounts.mutant_metadata;
        state.is_green_paw = is_green_paw;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(nonce: u8)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub main_authority: Signer<'info>,
   
    #[account(mut,
        constraint = eggplant_token_account.owner == main_authority.key(),
        constraint = eggplant_token_account.mint == eggplant_token_mint.key()
    )]
    pub eggplant_token_account: Box<Account<'info, TokenAccount>>,
   
    #[account(init_if_needed,
              seeds = [VAULT_DATA_SEED.as_bytes()],
              bump= nonce,
              payer = main_authority 
    )]
    pub vault_data: Box<Account<'info, VaultAccount>>,
   
    #[account(init_if_needed,
              token::mint = eggplant_token_mint,
              token::authority = vault_data,
              seeds = [VAULT_SEED.as_bytes()],
              bump,
              payer = main_authority
    )]
    pub eggplant_pool: Box<Account<'info, TokenAccount>>,
   
    #[account(
        constraint = eggplant_token_mint.key() == eggplant_token_account.mint
    )]
    pub eggplant_token_mint: Box<Account<'info, Mint>>,
   
    pub system_program: Program<'info, System>,
   
    pub token_program: Program<'info, Token>,
   
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {

    #[account(mut, signer)]
    pub claimant: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = claimant,
        seeds = [mutant_mint_account.key().as_ref(), "mint".as_bytes()],
        bump
    )]
    pub greenpaw_mint_metadata: Account<'info, MintData>,

    #[account(
        init_if_needed,
        payer = claimant,
        associated_token::mint = eggplant_token_mint,
        associated_token::authority = claimant
    )]
    pub user_egglplant_token_account : Account<'info, TokenAccount>,

    #[account(mut, 
        seeds = [PREFIX.as_bytes(),mutant_mint_account.key().as_ref()],
        bump
    )]
    pub mutant_metadata: Account<'info, Metadata>,

    #[account(mut)]
    pub eggplant_token_mint: Account<'info, Mint>,

    #[account(mut,
        seeds = [VAULT_SEED.as_bytes()],
        bump
    )]
    pub eggplant_pool: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub vault_data: Box<Account<'info, VaultAccount>>,

    #[account(mut,  
        constraint = mutant_token_account.amount == 1 @ErrorCode::TokenAmountZero, 
        constraint = mutant_token_account.owner == claimant.key() @ErrorCode::TokenOwnerNotSigner,
        
    )]
    pub mutant_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = mutant_token_account.mint == mutant_mint_account.to_account_info().key() @ErrorCode::TokenMintMismatch)]
    pub mutant_mint_account: Account<'info, Mint>,


    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>
}

#[derive(Accounts)]
pub struct ChangeOwner<'info> {

    #[account(mut, signer)]
    pub owner: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [mutant_mint_account.key().as_ref(), "mint".as_bytes()],
        bump
    )]
    pub greenpaw_mint_metadata: Account<'info, MintData>,

    #[account(mut, 
        seeds = [PREFIX.as_bytes(),mutant_mint_account.key().as_ref()],
        bump
    )]
    pub mutant_metadata: Account<'info, Metadata>,

    #[account(mut,  
        constraint = mutant_token_account.amount == 1, 
        constraint = mutant_token_account.owner == owner.key(),
        
    )]
    pub mutant_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = mutant_token_account.mint == mutant_mint_account.to_account_info().key())]
    pub mutant_mint_account: Account<'info, Mint>,


    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}


///Admin only function -Add metadata on mints for GP cubs
#[derive(Accounts)]
pub struct AddMetadata<'info> {

    #[account(mut, address =Pubkey::from_str(CENTRAL_AUTHORITY).unwrap() @ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed ,
        seeds = [PREFIX.as_bytes(),mint.key().as_ref()],
        bump, 
        payer = authority, 
        space= 8 + std::mem::size_of::<Metadata>()
    )]
    pub mutant_metadata: Account<'info, Metadata>,

    pub system_program: Program<'info, System>,
}


///Admin only function -Update metadata on mints for GP cubs
#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(mut,address = Pubkey::from_str(CENTRAL_AUTHORITY).unwrap() @ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [PREFIX.as_bytes(), mint.key().as_ref()],
        bump
    )]
    pub mutant_metadata: ProgramAccount<'info, Metadata>,
    pub mint: Account<'info, Mint>
}


#[account]
#[derive(Default)]
pub struct VaultAccount {
    pub main_authority: Pubkey,
    pub eggplant_token_mint: Pubkey,
    pub eggplant_pool: Pubkey,
    pub reward_per_sec: u64,
    pub total_tokens: u64,
    pub is_initialized:bool,
    pub bump: u8
}


#[account]
#[derive(Default)]
pub struct MintData {
    pub bump: u8,
    pub owner: Pubkey,
    pub last_claim_time: i64,
    pub total_rewards: u64,
    pub last_reward: u64
}

#[account]
pub struct Metadata {
    pub is_green_paw: bool,
    pub authority: Pubkey
}

#[error]
pub enum ErrorCode {
    #[msg("You are not authorized to call this action.")]
    Unauthorized,
    #[msg("The token is not a valid green paw token.")]
    NotGreenPaw,
    #[msg("The token account and mint passed aren't related")]
    TokenMintMismatch,
    #[msg("The token account is not owned by signer")]
    TokenOwnerNotSigner,
    #[msg("The owner does'nt hold the token")]
    TokenAmountZero
}
