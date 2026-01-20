mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            vault::vault_init,
            vault::vault_list_notes,
            vault::vault_read_note,
            vault::vault_create_note,
            vault::vault_create_note_from_markdown,
            vault::vault_create_note_in_inbox,
            vault::vault_write_note,
            vault::vault_archive_note,
            vault::vault_move_note,
            vault::vault_list_folders,
            vault::vault_create_folder,
            vault::vault_rename_folder,
            vault::vault_delete_folder,
            vault::vault_list_projects,
            vault::vault_create_project,
            vault::vault_update_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
