alter table public.portfolio_edition_cases
  add column if not exists display_title text,
  add column if not exists description text;

alter table public.portfolio_edition_cases
  drop constraint if exists portfolio_edition_cases_display_title_length,
  add constraint portfolio_edition_cases_display_title_length
    check (display_title is null or char_length(display_title) <= 120),
  drop constraint if exists portfolio_edition_cases_description_length,
  add constraint portfolio_edition_cases_description_length
    check (description is null or char_length(description) <= 1000);
