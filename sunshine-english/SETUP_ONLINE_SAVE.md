# Put Sunshine English online, with progress saved by name + birthday

About 10 minutes, free. When you're done:
- Morgane opens the site from a link (GitHub Pages) on her phone or computer.
- The first time, it asks **"What's your first name and birthday?"** (month + day). Her progress then saves in the browser **and** online under that, automatically. No email, no password.
- If she clears the cache, cookies or history, or uses a new phone, the site asks again. She types the same name and birthday, and everything comes back.
- A friend can use it too: she types her own name and birthday and gets her own progress.

The site still works without these steps. Progress then lives only in the browser, and she can download a backup file in Settings.

**The trade-off:** anyone who knows her first name and birthday could open (or overwrite) her progress on this site. For learning progress that's fine, and it's the price of not needing a password. Nobody can list or browse the saved progress: they'd need the exact name and birthday.

---

## 1. Create a free Supabase project (this is where the progress is stored)
1. Go to **https://supabase.com** → **Start your project** → sign in with GitHub.
2. Click **New project**:
   - name it `sunshine-english`;
   - for the database password, click **Generate** (you won't need it);
   - region **East US**, plan **Free**.
   Then click **Create new project** and wait about a minute.

## 2. Create the storage (copy and paste)
In the left sidebar, open **SQL Editor** → **New query**, paste all of this, and click **Run**:

```sql
-- One row per person: the key is first name + birthday, e.g. "morgane-0412".
create table if not exists public.progress_by_key (
  k          text primary key,
  data       jsonb not null,
  saved_at   bigint,
  updated_at timestamptz not null default now()
);

-- Lock the table: no direct reading or listing. Only the two functions below can touch it.
alter table public.progress_by_key enable row level security;
revoke all on public.progress_by_key from anon, authenticated;

-- Read one person's progress (needs the exact key).
create or replace function public.get_progress(p_key text)
returns table (data jsonb, saved_at bigint)
language sql security definer set search_path = public
as $$ select t.data, t.saved_at from public.progress_by_key t where t.k = p_key $$;

-- Save one person's progress. The newer save always wins (two devices can't overwrite newer work).
create or replace function public.save_progress(p_key text, p_data jsonb, p_saved_at bigint)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare cur bigint;
begin
  if p_key is null or length(p_key) < 3 or length(p_key) > 40 then raise exception 'bad key'; end if;
  insert into public.progress_by_key as t (k, data, saved_at, updated_at)
  values (p_key, p_data, p_saved_at, now())
  on conflict (k) do update
    set data = excluded.data, saved_at = excluded.saved_at, updated_at = now()
    where t.saved_at is null or excluded.saved_at >= t.saved_at;
  select t.saved_at into cur from public.progress_by_key t where t.k = p_key;
  return cur;
end $$;

revoke all on function public.get_progress(text) from public;
revoke all on function public.save_progress(text, jsonb, bigint) from public;
grant execute on function public.get_progress(text) to anon, authenticated;
grant execute on function public.save_progress(text, jsonb, bigint) to anon, authenticated;
```
You should see "Success. No rows returned".

## 3. Connect the site to your project
1. Open **Project Settings** (the gear icon) → **API Keys** (or **Data API / API** in older dashboards).
2. Copy:
   - the **Project URL**, which looks like `https://abcdefghijk.supabase.co`;
   - the **anon public** key (starts with `eyJ…`) or the **publishable** key (starts with `sb_publishable_…`). Either one works.
3. Open **`site/js/cloud-config.js`** in a text editor and fill them in:
```js
window.SE_CLOUD = { url: "https://abcdefghijk.supabase.co", anonKey: "eyJhbGciOi…" };
```
Both values are meant to be public, so it's fine that they end up in a public GitHub repo. **Never** put the `service_role` / secret key there.

## 4. Put the site on GitHub Pages
GitHub Pages serves the repo's root folder, so upload what is **inside** `site/`.
1. Install **GitHub Desktop**, then choose **File → New repository** → name it `sunshine-english` → **Create**.
2. Copy **everything inside** `French Website/site/` into that repo folder, so `index.html` sits at the top. That includes the hidden `.nojekyll` file; on a Mac, press Cmd+Shift+. in Finder to see it.
3. In GitHub Desktop, click **Commit to main** → **Publish repository**, and untick "Keep this code private". Pages on a private repo needs a paid plan, and the repo only holds lessons and the public key.
4. On github.com, open the repo → **Settings → Pages** → set Source to **Deploy from a branch**, Branch to **main / (root)** → **Save**.
5. Wait 1–2 minutes. Your link looks like `https://<your-username>.github.io/sunshine-english/`.

**Updating later:** copy the new files over the old ones in the repo folder, then commit and push in GitHub Desktop.

## 5. On Morgane's phone or computer
1. Open the link, and add it to the home screen:
   - Safari: **Share → Add to Home Screen**;
   - Chrome: **⋮ → Add to Home screen**.
2. Type her first name and birthday when asked. That's it.
3. The little dot on the "M" avatar shows the save status:
   - green: saved online;
   - yellow: offline or saving (it catches up by itself);
   - red: a problem (it keeps retrying).
   Settings shows "Saving as Morgane · April 12", with **Save now** and **Switch person**.

## Good to know
- **Spelling matters:** "Morgane" + April 12 is a different key from "Morgan" + April 12. Accents and capitals don't matter ("Élodie" = "elodie").
- **Saving is automatic:** a few seconds after each change, and again when she switches apps or closes the tab.
- **Offline:** everything keeps working, and it uploads when she's back online.
- **Two devices:** the most recent save wins.
- **Free-plan pause:** Supabase pauses free projects after about a week with no activity at all. The site keeps working and saving in the browser. Open supabase.com → the project → **Restore project**, and nothing is lost. Daily use keeps it awake.
