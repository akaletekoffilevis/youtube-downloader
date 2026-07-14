use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

fn clean_ytdlp_err(stderr: &str) -> String {
    stderr.lines()
        .filter(|l| l.starts_with("ERROR:"))
        .last()
        .map(|l| l.trim_start_matches("ERROR: ").to_string())
        .unwrap_or_else(|| "Échec de l'opération".into())
}

fn find_ytdlp(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app.path().resource_dir().map_err(|e| format!("Resource dir: {}", e))?;
    let bin_name = if cfg!(target_os = "windows") { "yt-dlp.exe" } else { "yt-dlp" };
    let sidecar = resource_dir.join(bin_name);
    if sidecar.exists() {
        return Ok(sidecar);
    }
    let fallback = [
        "/usr/local/bin/yt-dlp",
        "/usr/bin/yt-dlp",
    ];
    for p in &fallback {
        let pb = PathBuf::from(p);
        if pb.exists() { return Ok(pb); }
    }
    if let Ok(home) = std::env::var("HOME") {
        let pb = PathBuf::from(format!("{}/.local/bin/yt-dlp", home));
        if pb.exists() { return Ok(pb); }
    }
    Ok(PathBuf::from("yt-dlp"))
}

struct DownloadState {
    processes: Arc<Mutex<HashMap<String, Child>>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct VideoItem {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: String,
    pub author: String,
    pub duration: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filesize: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProgressPayload {
    pub id: String,
    pub percent: f64,
    pub status: String,
    pub filename: String,
    pub error: String,
}

fn extract_video(json: &serde_json::Value) -> VideoItem {
    let id = json["id"].as_str().unwrap_or("").to_string();
    let title = json["title"].as_str().unwrap_or("Inconnu").to_string();
    let url = json["webpage_url"]
        .as_str()
        .or_else(|| json["url"].as_str())
        .unwrap_or("")
        .to_string();
    let author = json["channel"]
        .as_str()
        .or_else(|| json["uploader"].as_str())
        .unwrap_or("Inconnu")
        .to_string();
    let thumbnail = if let Some(thumbs) = json["thumbnails"].as_array() {
        thumbs.last()
            .and_then(|t| t["url"].as_str())
            .unwrap_or(&format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id))
            .to_string()
    } else {
        format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id)
    };
    let duration = match json["duration"].as_i64() {
        Some(secs) => {
            let h = secs / 3600;
            let m = (secs % 3600) / 60;
            let s = secs % 60;
            if h > 0 { format!("{}:{:02}:{:02}", h, m, s) }
            else { format!("{}:{:02}", m, s) }
        }
        None => "Live".to_string(),
    };
    let filesize = json["filesize_approx"].as_i64().map(|bytes| format_size(bytes));
    VideoItem { id, title, url, thumbnail, author, duration, filesize }
}

fn format_size(bytes: i64) -> String {
    if bytes < 1024 { return format!("{} o", bytes); }
    let kb = bytes as f64 / 1024.0;
    if kb < 1024.0 { return format!("{:.0} Ko", kb); }
    let mb = kb / 1024.0;
    if mb < 1024.0 { return format!("{:.1} Mo", mb); }
    format!("{:.2} Go", mb / 1024.0)
}

#[tauri::command]
async fn search_videos(app: AppHandle, query: String) -> Result<Vec<VideoItem>, String> {
    let yt = find_ytdlp(&app)?;
    tokio::task::spawn_blocking(move || {
        let output = Command::new(yt)
            .args(["--dump-json", "--flat-playlist", "--no-download", "--ignore-errors", "--no-warnings",
                &format!("ytsearch100:{}", query)])
            .output()
            .map_err(|e| format!("yt-dlp introuvable: {}", e))?;
        if !output.status.success() {
            return Err(clean_ytdlp_err(&String::from_utf8_lossy(&output.stderr)));
        }
        Ok(String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|l| serde_json::from_str::<serde_json::Value>(l).ok())
            .map(|j| extract_video(&j))
            .collect())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_video_info(app: AppHandle, url: String) -> Result<VideoItem, String> {
    let yt = find_ytdlp(&app)?;
    let url2 = url.clone();
    let url3 = url.clone();
    tokio::task::spawn_blocking(move || {
        let output = Command::new(yt)
            .args(["--dump-json", "--no-download", "--ignore-errors", "--no-warnings", &url2])
            .output().map_err(|e| format!("yt-dlp introuvable: {}", e))?;
        if !output.status.success() {
            return Err(clean_ytdlp_err(&String::from_utf8_lossy(&output.stderr)));
        }
        let json: serde_json::Value =
            serde_json::from_str(&String::from_utf8_lossy(&output.stdout))
                .map_err(|e| format!("JSON: {}", e))?;
        if json.get("_type").and_then(|t| t.as_str()) == Some("playlist") {
            let entries = json["entries"].as_array().ok_or("Playlist vide")?;
            return Ok(VideoItem {
                id: json["id"].as_str().unwrap_or("").to_string(),
                title: json["title"].as_str().unwrap_or("Playlist").to_string(),
                url: url3, thumbnail: String::new(),
                author: json["channel"].as_str().unwrap_or("").to_string(),
                duration: format!("{} vidéos", entries.len()),
                filesize: None,
            });
        }
        Ok(extract_video(&json))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_playlist(app: AppHandle, url: String) -> Result<Vec<VideoItem>, String> {
    let yt = find_ytdlp(&app)?;
    tokio::task::spawn_blocking(move || {
        let output = Command::new(yt)
            .args(["--dump-json", "--no-download", "--ignore-errors", "--no-warnings", "--flat-playlist", &url])
            .output().map_err(|e| format!("yt-dlp introuvable: {}", e))?;
        if !output.status.success() {
            return Err(format!("Playlist: {}", clean_ytdlp_err(&String::from_utf8_lossy(&output.stderr))));
        }
        Ok(String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|l| serde_json::from_str::<serde_json::Value>(l).ok())
            .map(|j| extract_video(&j))
            .collect())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn get_download_dir() -> String {
    let base = dirs::download_dir()
        .or_else(|| dirs::desktop_dir())
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    format!("{}/YoutubeDownloader", base.display())
}

#[tauri::command]
async fn download_video(
    app: AppHandle, id: String, url: String, output_dir: String, format: String,
) -> Result<(), String> {
    std::fs::create_dir_all(&output_dir).map_err(|e| format!("Dossier impossible: {}", e))?;
    let output_template = format!("{}/%(title)s.%(ext)s", output_dir);
    let app2 = app.clone();
    let id2 = id.clone();
    let url2 = url.clone();
    let processes = app.state::<DownloadState>().processes.clone();
    let is_playlist = url.contains("playlist") || url.contains("&list=");

    tokio::task::spawn_blocking(move || {
        let mut args: Vec<String> = vec![
            "--newline".into(), "--ignore-errors".into(), "--no-part".into(),
            "--restrict-filenames".into(), "-o".into(), output_template,
            "--progress-template".into(),
            "progress:%(progress.percent)s|%(progress.speed)s|%(progress.eta)s".into(),
        ];
        match format.as_str() {
            "audio" => {
                args.push("--extract-audio".into());
                args.push("--audio-format".into());
                args.push("mp3".into());
                args.push("--audio-quality".into());
                args.push("0".into());
            }
            "1080" => { args.push("-f".into()); args.push("bestvideo[height<=1080]+bestaudio/best[height<=1080]".into()); }
            "720" => { args.push("-f".into()); args.push("bestvideo[height<=720]+bestaudio/best[height<=720]".into()); }
            "480" => { args.push("-f".into()); args.push("bestvideo[height<=480]+bestaudio/best[height<=480]".into()); }
            "360" => { args.push("-f".into()); args.push("bestvideo[height<=360]+bestaudio/best[height<=360]".into()); }
            _ => {}
        }
        if !is_playlist { args.push("--no-playlist".into()); }
        args.push(url2.clone());

        let yt = match find_ytdlp(&app2) {
            Ok(p) => p,
            Err(e) => {
                app2.emit("download-progress", ProgressPayload {
                    id: id2.clone(), percent: 0.0, status: "error".into(),
                    filename: String::new(), error: format!("Impossible de lancer yt-dlp: {}", e),
                }).ok();
                return;
            }
        };
        let mut child = match Command::new(yt).args(&args)
            .stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()
        {
            Ok(c) => c,
            Err(e) => {
                app2.emit("download-progress", ProgressPayload {
                    id: id2.clone(), percent: 0.0, status: "error".into(),
                    filename: String::new(), error: format!("Impossible de lancer yt-dlp: {}", e),
                }).ok();
                return;
            }
        };

        let pid_str = id2.clone();

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        { let mut p = processes.lock().unwrap(); p.insert(pid_str.clone(), child); }

        // Read stdout for progress-template output
        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let trimmed = line.trim();
                    if trimmed.starts_with("progress:") {
                        let data: Vec<&str> = trimmed[9..].split('|').collect();
                        let percent: f64 = data.first().and_then(|s| s.parse().ok()).unwrap_or(0.0);
                        app2.emit("download-progress", ProgressPayload {
                            id: id2.clone(), percent, status: "downloading".into(),
                            filename: String::new(), error: String::new(),
                        }).ok();
                    }
                }
            }
        }

        // Drain stderr in a thread to avoid deadlock
        if let Some(stderr) = stderr {
            std::thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for _ in reader.lines() {}
            });
        }

        let mut child = { let mut p = processes.lock().unwrap(); p.remove(&pid_str) };
        let success = child.as_mut().map(|c| c.wait().ok()).flatten()
            .map(|s| s.success()).unwrap_or(false);

        app2.emit("download-progress", ProgressPayload {
            id: id2.clone(), percent: if success { 100.0 } else { 0.0 },
            status: if success { "finished".into() } else { "error".into() },
            filename: String::new(),
            error: if success { String::new() } else { "Échec du téléchargement".into() },
        }).ok();
    }).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn pause_download(state: State<'_, DownloadState>, id: String) -> Result<(), String> {
    let procs = state.processes.lock().unwrap();
    if let Some(child) = procs.get(&id) {
        let pid = child.id() as i32;
        #[cfg(unix)]
        unsafe { libc::kill(pid, libc::SIGSTOP); }
        #[cfg(windows)]
        { let _ = pid; return Err("Pause non supporté sur Windows".into()); }
        Ok(())
    } else {
        Err("Téléchargement introuvable".into())
    }
}

#[tauri::command]
fn resume_download(state: State<'_, DownloadState>, id: String) -> Result<(), String> {
    let procs = state.processes.lock().unwrap();
    if let Some(child) = procs.get(&id) {
        let pid = child.id() as i32;
        #[cfg(unix)]
        unsafe { libc::kill(pid, libc::SIGCONT); }
        #[cfg(windows)]
        { let _ = pid; return Err("Resume non supporté sur Windows".into()); }
        Ok(())
    } else {
        Err("Téléchargement introuvable".into())
    }
}

#[tauri::command]
fn cancel_download(state: State<'_, DownloadState>, id: String) -> Result<(), String> {
    let mut procs = state.processes.lock().unwrap();
    if let Some(mut child) = procs.remove(&id) {
        let _ = child.kill();
        let _ = child.wait();
        Ok(())
    } else {
        Err("Téléchargement introuvable".into())
    }
}

#[tauri::command]
async fn check_network() -> bool {
    let hosts = ["1.1.1.1:80", "8.8.8.8:53", "208.67.222.222:53"];
    for host in &hosts {
        let addr: std::net::SocketAddr = match host.parse() {
            Ok(a) => a,
            Err(_) => continue,
        };
        if tokio::task::spawn_blocking(move || {
            std::net::TcpStream::connect_timeout(
                &addr, std::time::Duration::from_secs(2),
            ).is_ok()
        }).await.unwrap_or(false) {
            return true;
        }
    }
    false
}

#[tauri::command]
async fn pick_folder(app: AppHandle) -> Option<String> {
    let app = app.clone();
    tokio::task::spawn_blocking(move || {
        app.dialog().file().blocking_pick_folder().map(|p| p.to_string())
    }).await.unwrap_or(None)
}

#[tauri::command]
fn open_in_browser(url: String) -> Result<(), String> {
    opener::open(&url).map_err(|e| format!("Impossible d'ouvrir le navigateur: {}", e))
}

#[tauri::command]
fn check_dir_exists(path: String) -> bool {
    std::path::Path::new(&path).is_dir()
}

#[tauri::command]
async fn get_file_size(app: AppHandle, url: String, format: String) -> Result<String, String> {
    let yt = find_ytdlp(&app)?;
    let fmt = format.clone();
    tokio::task::spawn_blocking(move || {
        let mut args: Vec<String> = vec![
            "--dump-json".into(), "--no-download".into(), "--no-warnings".into(),
        ];
        match fmt.as_str() {
            "audio" => {
                args.push("--extract-audio".into());
                args.push("--audio-format".into());
                args.push("mp3".into());
            }
            "1080" => { args.push("-f".into()); args.push("bestvideo[height<=1080]+bestaudio/best[height<=1080]".into()); }
            "720" => { args.push("-f".into()); args.push("bestvideo[height<=720]+bestaudio/best[height<=720]".into()); }
            "480" => { args.push("-f".into()); args.push("bestvideo[height<=480]+bestaudio/best[height<=480]".into()); }
            "360" => { args.push("-f".into()); args.push("bestvideo[height<=360]+bestaudio/best[height<=360]".into()); }
            _ => {}
        }
        args.push(url);
        let output = Command::new(yt).args(&args).output()
            .map_err(|e| format!("yt-dlp introuvable: {}", e))?;
        if !output.status.success() {
            return Err(clean_ytdlp_err(&String::from_utf8_lossy(&output.stderr)));
        }
        let json: serde_json::Value = serde_json::from_str(&String::from_utf8_lossy(&output.stdout))
            .map_err(|e| format!("JSON: {}", e))?;
        let bytes = json["filesize_approx"].as_i64()
            .or_else(|| json["filesize"].as_i64())
            .unwrap_or(0);
        Ok(format_size(bytes))
    }).await.map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(DownloadState { processes: Arc::new(Mutex::new(HashMap::new())) })
        .invoke_handler(tauri::generate_handler![
            search_videos, get_video_info, get_playlist, get_download_dir,
            download_video, pause_download, resume_download, cancel_download,
            check_network, pick_folder, open_in_browser, check_dir_exists,
            get_file_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
