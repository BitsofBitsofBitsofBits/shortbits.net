(() => {
  const tables = [
    "pronoun_profiles", "site_blog_posts", "site_changelog", "site_creators", "site_favorite_games",
    "site_hardware", "site_hardware_machine_order", "site_message_catalog", "site_now",
    "site_resume_certifications", "site_resume_education", "site_resume_entries",
    "site_resume_profile", "spotify_featured_playlists", "spotify_featured_tracks",
  ];
  function validate(backup) {
    if (!backup || typeof backup !== "object" || Array.isArray(backup)
      || backup.format !== "shortbits-content" || backup.version !== 1
      || !backup.tables || typeof backup.tables !== "object" || Array.isArray(backup.tables)
      || Object.keys(backup).sort().join() !== "exportedAt,format,tables,version"
      || Number.isNaN(Date.parse(backup.exportedAt))
      || Object.keys(backup.tables).sort().join() !== tables.join()) {
      throw new Error("This is not a supported shortbits.net content backup.");
    }
    let count = 0;
    for (const table of tables) {
      const rows = backup.tables[table];
      if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
        throw new Error(`Invalid rows in ${table}.`);
      }
      count += rows.length;
    }
    if (count > 10000) throw new Error("The backup exceeds 10,000 rows.");
    for (const table of ["pronoun_profiles", "site_now", "site_resume_profile"]) {
      if (backup.tables[table].length !== 1 || backup.tables[table][0].id !== "primary") {
        throw new Error(`Missing primary record in ${table}.`);
      }
    }
    return count;
  }
  window.BITS_CONTENT_BACKUP = { validate, tables };
  const section = document.querySelector("#backup-editor");
  if (!section) return;
  const status = document.querySelector("#backup-status");
  const exportButton = document.querySelector("#backup-export");
  const fileInput = document.querySelector("#backup-file");
  const confirmation = document.querySelector("#backup-confirm");
  const restoreButton = document.querySelector("#backup-restore");
  let selected = null;
  let busy = false;
  function report(message, state = "") {
    status.textContent = message;
    status.dataset.state = state;
  }
  function updateControls() {
    exportButton.disabled = busy;
    fileInput.disabled = busy;
    confirmation.disabled = busy;
    restoreButton.disabled = busy || !selected || confirmation.value !== "RESTORE";
  }
  function download(backup, prefix) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportContent() {
    const { data, error } = await adminClient.rpc("export_site_content");
    if (error) throw new Error(`Content export failed: ${error.message}. Ensure the content-backup migration is deployed.`);
    validate(data);
    return data;
  }
  exportButton.addEventListener("click", async () => {
    busy = true;
    updateControls();
    report("Exporting editorial content...");
    try {
      download(await exportContent(), "shortbits-content");
      report("Content backup downloaded. Store it privately; drafts are included.", "success");
    } catch (error) {
      console.error("Content backup failed:", error);
      report(error.message, "error");
    } finally {
      busy = false;
      updateControls();
    }
  });
  fileInput.addEventListener("change", async () => {
    selected = null;
    confirmation.value = "";
    const file = fileInput.files[0];
    if (!file) { report("No backup selected."); updateControls(); return; }
    busy = true;
    updateControls();
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Backups must be smaller than 10 MB.");
      const backup = JSON.parse(await file.text());
      const count = validate(backup);
      selected = backup;
      report(`Ready to replace ${tables.length} editorial tables with ${count} records from ${backup.exportedAt}. Type RESTORE to confirm.`);
    } catch (error) {
      console.error("Invalid content backup:", error);
      report(`Cannot restore this file: ${error.message}`, "error");
    } finally {
      busy = false;
      updateControls();
    }
  });
  confirmation.addEventListener("input", updateControls);
  restoreButton.addEventListener("click", async () => {
    if (!selected || confirmation.value !== "RESTORE" || busy) return;
    busy = true;
    updateControls();
    report("Downloading a safety backup, then restoring content atomically...");
    try {
      download(await exportContent(), "shortbits-before-restore");
      const { data, error } = await adminClient.rpc("restore_site_content", { p_backup: selected });
      if (error) throw new Error(`Restore failed; no changes were applied: ${error.message}`);
      selected = null;
      fileInput.value = "";
      confirmation.value = "";
      let cacheWarning = "";
      try {
        localStorage.removeItem("bits-public-content-v5");
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("bits-message-catalog-v1:")) localStorage.removeItem(key);
        }
      } catch (error) {
        console.warn("Content restored but the local public-content cache could not be cleared:", error);
        cacheWarning = " This browser's public content may stay cached for up to five minutes.";
      }
      report(`Restored ${data.rows} records across ${data.tables} tables. Reload the admin center before editing. Deploy again to regenerate blog pages and RSS.${cacheWarning}`, "success");
    } catch (error) {
      console.error("Content restore failed:", error);
      report(error.message, "error");
    } finally {
      busy = false;
      updateControls();
    }
  });
  updateControls();
})();
