use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct AiCallArgs {
    query: String,
    workflow_type: Option<String>,
}

#[derive(Serialize)]
struct AiResponse {
    success: bool,
    content: String,
}

#[tauri::command]
async fn call_ai(args: AiCallArgs) -> Result<AiResponse, String> {
    let api_key = std::env::var("DIFY_API_KEY")
        .or_else(|_| std::env::var("DIFY_API_KEY_BREAKDOWN"))
        .unwrap_or_default();

    if api_key.is_empty() {
        return Err("DIFY_API_KEY not set".into());
    }

    let base_url = std::env::var("DIFY_BASE_URL").unwrap_or_else(|_| "https://api.dify.ai".into());
    let workflow_type = args.workflow_type.unwrap_or_else(|| "breakdown".to_string());

    // 根据 type 选择输入变量名
    let input_var_name = if workflow_type == "meeting" { "raw_text" } else { "string" };

    let url = if base_url.ends_with("/v1") {
        format!("{}/workflows/run", base_url)
    } else {
        format!("{}/v1/workflows/run", base_url)
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "inputs": { input_var_name: args.query },
            "response_mode": "blocking",
            "user": "todo-app-client"
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let content = text["data"]["outputs"]["out"]
        .as_str()
        .unwrap_or("");

    Ok(AiResponse {
        success: true,
        content: content.to_string(),
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![call_ai])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
