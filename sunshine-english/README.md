# Sunshine English

An English course for a French speaker in Tampa: interactive lessons, a 9-level journey, grammar foundations, a conventions gym, career English (dental hygiene, sales, hair & makeup), citizenship, and Love & Relationships.

It's a static website (plain HTML, CSS and JavaScript, with no build step), so it runs anywhere, including GitHub Pages.

## Put it online with GitHub Pages
1. Put this folder in your repository.
   - It can be the whole repo, or a subfolder.
   - Keep the hidden `.nojekyll` file next to `index.html`. On a Mac, press Cmd+Shift+. in Finder to see it.
2. On github.com, open the repo and go to **Settings → Pages**.
   - Set **Source** to **Deploy from a branch**.
   - Choose branch **main**, then pick a folder:
     - **/ (root)** if this folder *is* the repo;
     - **/docs** if you named this folder `docs`.
   - If it's in another subfolder, choose **/ (root)**, and the site will be at `https://<you>.github.io/<repo>/<folder>/`.
3. Wait 1–2 minutes, then open the link.

The web uploader only takes 100 files at a time. GitHub Desktop is easier: copy the folder into the repo, commit and push.

## Saving progress online (optional, about 10 minutes)
Without setup, progress saves in the browser, and she can download a backup file in Settings.

To make progress survive clearing the cache or cookies, follow `SETUP_ONLINE_SAVE.md`:
1. Create a free Supabase project.
2. Run one SQL snippet.
3. Paste two values into `js/cloud-config.js`.

After that, the site asks once for her first name and birthday, and restores her progress whenever the browser has been cleared.

## Updating
Copy the new files over the old ones and push. Every file link carries a version tag, so browsers load the update.
