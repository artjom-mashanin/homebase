use chrono::{Local, Utc};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;
use walkdir::WalkDir;

const VAULT_VERSION: u32 = 1;

fn homebase_vault_root() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Failed to determine home directory".to_string())?;
    Ok(home.join("Homebase"))
}

fn validate_relative_path(path: &str) -> Result<PathBuf, String> {
    let rel = PathBuf::from(path);
    if rel.is_absolute() {
        return Err("Path must be relative".to_string());
    }
    for component in rel.components() {
        if matches!(component, Component::ParentDir) {
            return Err("Path must not contain '..'".to_string());
        }
    }
    Ok(rel)
}

fn resolve_vault_path(relative_path: &str) -> Result<PathBuf, String> {
    let root = homebase_vault_root()?;
    let rel = validate_relative_path(relative_path)?;
    Ok(root.join(rel))
}

fn ensure_vault_structure(vault_root: &Path) -> Result<(), String> {
    let dirs_to_create = [
        vault_root.join("notes/inbox"),
        vault_root.join("notes/archive"),
        vault_root.join("notes/folders"),
        vault_root.join("notes/projects"),
        vault_root.join("assets"),
        vault_root.join("config"),
        vault_root.join(".homebase"),
    ];

    for dir in dirs_to_create {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create {:?}: {}", dir, e))?;
    }

    let settings_path = vault_root.join("config/settings.json");
    if !settings_path.exists() {
        let default_settings = serde_json::json!({
            "version": VAULT_VERSION,
            "vaultPath": vault_root.to_string_lossy(),
            "createdAt": Utc::now().to_rfc3339(),
        });
        write_atomic(&settings_path, &serde_json::to_string_pretty(&default_settings).unwrap())?;
    }

    Ok(())
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid path (missing parent)".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create directory {:?}: {}", parent, e))?;

    let tmp_path = parent.join(format!(
        ".{}.tmp",
        path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    ));
    let tmp_path = tmp_path.with_extension(format!("tmp-{}", Uuid::new_v4()));

    fs::write(&tmp_path, contents)
        .map_err(|e| format!("Failed to write temp file {:?}: {}", tmp_path, e))?;

    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("Failed to replace {:?}: {}", path, e))?;
    }
    fs::rename(&tmp_path, path).map_err(|e| format!("Failed to rename {:?}: {}", tmp_path, e))?;
    Ok(())
}

fn path_to_forward_slashes(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn relative_from_vault_root(full_path: &Path) -> Result<String, String> {
    let vault_root = homebase_vault_root()?;
    let rel = full_path
        .strip_prefix(&vault_root)
        .map_err(|_| "Path is outside vault".to_string())?;
    Ok(path_to_forward_slashes(rel))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultInfo {
    pub vault_path: String,
    pub version: u32,
}

#[tauri::command]
pub fn vault_init() -> Result<VaultInfo, String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;
    Ok(VaultInfo {
        vault_path: vault_root.to_string_lossy().to_string(),
        version: VAULT_VERSION,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultNoteEntry {
    pub relative_path: String,
    pub kind: String,
    pub mtime_ms: i64,
    pub size: u64,
}

fn kind_from_relative_path(relative_path: &str) -> String {
    if relative_path.starts_with("notes/inbox/") {
        return "inbox".to_string();
    }
    if relative_path.starts_with("notes/archive/") {
        return "archive".to_string();
    }
    if relative_path.starts_with("notes/projects/") {
        return "project".to_string();
    }
    if relative_path.starts_with("notes/folders/") {
        return "folder".to_string();
    }
    "other".to_string()
}

#[tauri::command]
pub fn vault_list_notes(include_archived: bool) -> Result<Vec<VaultNoteEntry>, String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let notes_root = vault_root.join("notes");
    let mut entries: Vec<VaultNoteEntry> = Vec::new();

    for entry in WalkDir::new(&notes_root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let rel = relative_from_vault_root(path)?;
        if !include_archived && rel.starts_with("notes/archive/") {
            continue;
        }

        let meta = fs::metadata(path).map_err(|e| format!("Failed to stat {:?}: {}", path, e))?;
        let modified = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        let mtime_ms = modified
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        entries.push(VaultNoteEntry {
            relative_path: rel.clone(),
            kind: kind_from_relative_path(&rel),
            mtime_ms,
            size: meta.len(),
        });
    }

    entries.sort_by(|a, b| b.mtime_ms.cmp(&a.mtime_ms));
    Ok(entries)
}

#[tauri::command]
pub fn vault_read_note(relative_path: String) -> Result<String, String> {
    let full = resolve_vault_path(&relative_path)?;
    fs::read_to_string(&full).map_err(|e| format!("Failed to read {:?}: {}", full, e))
}

#[tauri::command]
pub fn vault_write_note(relative_path: String, contents: String) -> Result<(), String> {
    let full = resolve_vault_path(&relative_path)?;
    write_atomic(&full, &contents)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteResult {
    pub id: String,
    pub relative_path: String,
    pub contents: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteFromMarkdownArgs {
    pub id: String,
    pub target_dir: Option<String>,
    pub title_hint: Option<String>,
    pub contents: String,
}

#[tauri::command]
pub fn vault_create_note_from_markdown(args: CreateNoteFromMarkdownArgs) -> Result<String, String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let id = args.id.trim();
    if id.is_empty() {
        return Err("id is required".to_string());
    }

    let date = Local::now().format("%Y-%m-%d").to_string();
    let id_short: String = id.chars().filter(|c| *c != '-').take(8).collect();
    let id_short = if id_short.is_empty() {
        &Uuid::new_v4().simple().to_string()[..8]
    } else {
        id_short.as_str()
    };

    let slug = args
        .title_hint
        .as_deref()
        .map(slugify)
        .unwrap_or_else(|| "note".to_string());
    let file_name = format!("{}-{}-{}.md", date, slug, id_short);

    let target_dir = args.target_dir.unwrap_or_else(|| "notes/inbox".to_string());
    let target_dir_rel = validate_relative_path(&target_dir)?;
    let target_dir_str = path_to_forward_slashes(&target_dir_rel);
    if !target_dir_str.starts_with("notes/inbox")
        && !target_dir_str.starts_with("notes/folders")
        && !target_dir_str.starts_with("notes/projects")
    {
        return Err("Target directory must be under notes/inbox, notes/folders, or notes/projects"
            .to_string());
    }

    let rel_path = format!("{}/{}", target_dir_str.trim_end_matches('/'), file_name);
    let full_path = vault_root.join(&rel_path);
    if full_path.exists() {
        return Err("Note file already exists".to_string());
    }

    write_atomic(&full_path, &args.contents)?;
    Ok(rel_path)
}

#[tauri::command]
pub fn vault_create_note(target_dir: Option<String>) -> Result<CreateNoteResult, String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let id = Uuid::new_v4();
    let now_iso = Utc::now().to_rfc3339();
    let date = Local::now().format("%Y-%m-%d").to_string();
    let short = id.simple().to_string();
    let short = &short[..8];
    let file_name = format!("{}-untitled-{}.md", date, short);
    let target_dir = target_dir.unwrap_or_else(|| "notes/inbox".to_string());
    let target_dir_rel = validate_relative_path(&target_dir)?;
    let target_dir_str = path_to_forward_slashes(&target_dir_rel);
    if !target_dir_str.starts_with("notes/inbox")
        && !target_dir_str.starts_with("notes/folders")
        && !target_dir_str.starts_with("notes/projects")
    {
        return Err("Target directory must be under notes/inbox, notes/folders, or notes/projects"
            .to_string());
    }

    let rel_path = format!("{}/{}", target_dir_str.trim_end_matches('/'), file_name);
    let user_placed = !rel_path.starts_with("notes/inbox/");

    let contents = format!(
        "---\nid: {}\ncreated: {}\nmodified: {}\nprojects: []\ntopics: []\nuser_placed: {}\n---\n\n",
        id, now_iso, now_iso, user_placed
    );

    let full_path = vault_root.join(&rel_path);
    write_atomic(&full_path, &contents)?;

    Ok(CreateNoteResult {
        id: id.to_string(),
        relative_path: rel_path,
        contents,
    })
}

#[tauri::command]
pub fn vault_create_note_in_inbox() -> Result<CreateNoteResult, String> {
    vault_create_note(None)
}

#[tauri::command]
pub fn vault_archive_note(relative_path: String) -> Result<String, String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let rel = validate_relative_path(&relative_path)?;
    let source = vault_root.join(&rel);
    if !source.exists() {
        return Err("Note does not exist".to_string());
    }
    let rel_str = path_to_forward_slashes(&rel);
    if rel_str.starts_with("notes/archive/") {
        return Ok(rel_str);
    }
    if !rel_str.starts_with("notes/") {
        return Err("Can only archive notes under notes/".to_string());
    }

    let rel_under_notes = rel_str.trim_start_matches("notes/");
    let target_rel = format!("notes/archive/{}", rel_under_notes);
    let target = vault_root.join(&target_rel);

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create {:?}: {}", parent, e))?;
    }

    fs::rename(&source, &target).map_err(|e| format!("Failed to archive note: {}", e))?;
    Ok(target_rel)
}

#[tauri::command]
pub fn vault_move_note(relative_path: String, target_dir: String) -> Result<String, String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let rel = validate_relative_path(&relative_path)?;
    let src = vault_root.join(&rel);
    if !src.exists() {
        return Err("Note does not exist".to_string());
    }

    let target_dir_rel = validate_relative_path(&target_dir)?;
    let target_dir_str = path_to_forward_slashes(&target_dir_rel);
    if !target_dir_str.starts_with("notes/inbox/")
        && target_dir_str != "notes/inbox"
        && !target_dir_str.starts_with("notes/folders/")
        && target_dir_str != "notes/folders"
        && !target_dir_str.starts_with("notes/projects/")
        && target_dir_str != "notes/projects"
    {
        return Err("Target directory must be under notes/inbox, notes/folders, or notes/projects"
            .to_string());
    }

    let file_name = src
        .file_name()
        .ok_or_else(|| "Invalid source path".to_string())?;
    let dest_dir = vault_root.join(&target_dir_rel);
    fs::create_dir_all(&dest_dir)
        .map_err(|e| format!("Failed to create {:?}: {}", dest_dir, e))?;
    let dest = dest_dir.join(file_name);

    fs::rename(&src, &dest).map_err(|e| format!("Failed to move note: {}", e))?;
    relative_from_vault_root(&dest)
}

#[tauri::command]
pub fn vault_list_folders() -> Result<Vec<String>, String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let root = vault_root.join("notes/folders");
    let mut folders: Vec<String> = Vec::new();
    for entry in WalkDir::new(&root)
        .min_depth(1)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_dir() {
            continue;
        }
        folders.push(relative_from_vault_root(entry.path())?);
    }
    folders.sort();
    Ok(folders)
}

#[tauri::command]
pub fn vault_create_folder(relative_path: String) -> Result<(), String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let rel = validate_relative_path(&relative_path)?;
    let rel_str = path_to_forward_slashes(&rel);
    if !rel_str.starts_with("notes/folders/") {
        return Err("Folder path must start with notes/folders/".to_string());
    }
    let full = vault_root.join(rel);
    fs::create_dir_all(&full).map_err(|e| format!("Failed to create folder: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn vault_rename_folder(from_relative_path: String, to_name: String) -> Result<String, String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let from_rel = validate_relative_path(&from_relative_path)?;
    let from_rel_str = path_to_forward_slashes(&from_rel);
    if !from_rel_str.starts_with("notes/folders/") {
        return Err("Folder path must start with notes/folders/".to_string());
    }

    if to_name.trim().is_empty() {
        return Err("New name cannot be empty".to_string());
    }
    if to_name.contains('/') || to_name.contains('\\') {
        return Err("New name must not contain path separators".to_string());
    }
    if to_name.trim() == "." || to_name.trim() == ".." {
        return Err("Invalid folder name".to_string());
    }

    let from_full = vault_root.join(&from_rel);
    let parent = from_full
        .parent()
        .ok_or_else(|| "Invalid folder path".to_string())?;
    let to_full = parent.join(&to_name);

    fs::rename(&from_full, &to_full).map_err(|e| format!("Failed to rename folder: {}", e))?;
    relative_from_vault_root(&to_full)
}

#[tauri::command]
pub fn vault_delete_folder(relative_path: String) -> Result<(), String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let rel = validate_relative_path(&relative_path)?;
    let rel_str = path_to_forward_slashes(&rel);
    if !rel_str.starts_with("notes/folders/") {
        return Err("Folder path must start with notes/folders/".to_string());
    }

    let full = vault_root.join(rel);
    let mut walk = WalkDir::new(&full).min_depth(1).into_iter();
    if walk.next().is_some() {
        return Err("Folder is not empty".to_string());
    }
    fs::remove_dir(&full).map_err(|e| format!("Failed to delete folder: {}", e))?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    pub id: String,
    pub name: String,
    pub status: String,
    pub created: String,
    pub modified: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub status: String,
    pub created: String,
    pub modified: String,
    pub folder_relative_path: String,
}

fn slugify(input: &str) -> String {
    let mut out = String::new();
    let mut last_was_dash = false;
    for ch in input.trim().chars() {
        let lower = ch.to_ascii_lowercase();
        if lower.is_ascii_alphanumeric() {
            out.push(lower);
            last_was_dash = false;
        } else if !last_was_dash {
            out.push('-');
            last_was_dash = true;
        }
    }
    let out = out.trim_matches('-').to_string();
    if out.is_empty() {
        "project".to_string()
    } else {
        out
    }
}

fn read_project_meta(path: &Path) -> Result<ProjectMeta, String> {
    let raw = fs::read_to_string(path).map_err(|e| format!("Failed to read {:?}: {}", path, e))?;
    serde_json::from_str(&raw).map_err(|e| format!("Invalid JSON {:?}: {}", path, e))
}

fn write_project_meta(path: &Path, meta: &ProjectMeta) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
    write_atomic(path, &raw)
}

fn list_projects_internal(vault_root: &Path) -> Result<Vec<(PathBuf, ProjectMeta)>, String> {
    let projects_root = vault_root.join("notes/projects");
    let mut out: Vec<(PathBuf, ProjectMeta)> = Vec::new();
    for entry in fs::read_dir(&projects_root)
        .map_err(|e| format!("Failed to read {:?}: {}", projects_root, e))?
    {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let meta_path = path.join(".project.json");
        if !meta_path.exists() {
            continue;
        }
        let meta = read_project_meta(&meta_path)?;
        out.push((path, meta));
    }
    Ok(out)
}

#[tauri::command]
pub fn vault_list_projects() -> Result<Vec<ProjectInfo>, String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let mut projects: Vec<ProjectInfo> = Vec::new();
    for (folder_path, meta) in list_projects_internal(&vault_root)? {
        projects.push(ProjectInfo {
            id: meta.id.clone(),
            name: meta.name.clone(),
            status: meta.status.clone(),
            created: meta.created.clone(),
            modified: meta.modified.clone(),
            folder_relative_path: relative_from_vault_root(&folder_path)?,
        });
    }
    projects.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(projects)
}

#[tauri::command]
pub fn vault_create_project(name: String) -> Result<ProjectInfo, String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let status = "active".to_string();

    let base_slug = slugify(&name);
    let short = &Uuid::new_v4().simple().to_string()[..6];
    let mut folder_name = base_slug.clone();

    let projects_root = vault_root.join("notes/projects");
    let mut folder_path = projects_root.join(&folder_name);
    if folder_path.exists() {
        folder_name = format!("{}-{}", base_slug, short);
        folder_path = projects_root.join(&folder_name);
    }

    fs::create_dir_all(&folder_path).map_err(|e| format!("Failed to create project: {}", e))?;

    let meta = ProjectMeta {
        id: id.clone(),
        name: name.clone(),
        status: status.clone(),
        created: now.clone(),
        modified: now.clone(),
    };
    let meta_path = folder_path.join(".project.json");
    write_project_meta(&meta_path, &meta)?;

    Ok(ProjectInfo {
        id,
        name,
        status,
        created: now.clone(),
        modified: now,
        folder_relative_path: relative_from_vault_root(&folder_path)?,
    })
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectArgs {
    pub id: String,
    pub name: Option<String>,
    pub status: Option<String>,
}

#[tauri::command]
pub fn vault_update_project(args: UpdateProjectArgs) -> Result<ProjectInfo, String> {
    let vault_root = homebase_vault_root()?;
    ensure_vault_structure(&vault_root)?;

    let projects = list_projects_internal(&vault_root)?;
    let (folder_path, mut meta) = projects
        .into_iter()
        .find(|(_, m)| m.id == args.id)
        .ok_or_else(|| "Project not found".to_string())?;

    if let Some(name) = args.name.clone() {
        meta.name = name;
    }
    if let Some(status) = args.status.clone() {
        meta.status = status;
    }
    meta.modified = Utc::now().to_rfc3339();

    let mut final_folder_path = folder_path.clone();
    if args.name.is_some() {
        let projects_root = vault_root.join("notes/projects");
        let desired = slugify(&meta.name);
        let mut desired_path = projects_root.join(&desired);
        if desired_path.exists() && desired_path != folder_path {
            let short = &Uuid::new_v4().simple().to_string()[..6];
            desired_path = projects_root.join(format!("{}-{}", desired, short));
        }
        if desired_path != folder_path {
            fs::rename(&folder_path, &desired_path)
                .map_err(|e| format!("Failed to rename project folder: {}", e))?;
            final_folder_path = desired_path;
        }
    }

    let meta_path = final_folder_path.join(".project.json");
    write_project_meta(&meta_path, &meta)?;

    Ok(ProjectInfo {
        id: meta.id,
        name: meta.name,
        status: meta.status,
        created: meta.created,
        modified: meta.modified,
        folder_relative_path: relative_from_vault_root(&final_folder_path)?,
    })
}
