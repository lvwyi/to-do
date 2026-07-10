use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct AiCallArgs {
    query: String,
    conversation_id: Option<String>,
}

#[derive(Serialize)]
struct AiResponse {
    success: bool,
    content: String,
}

#[tauri::command]
async fn call_ai(args: AiCallArgs) -> Result<AiResponse, String> {
    let api_key = std::env::var("DIFY_API_KEY").map_err(|e| format!("DIFY_API_KEY not set: {}", e))?;
    let base_url = std::env::var("DIFY_BASE_URL").unwrap_or_else(|_| "https://api.dify.ai".into());

    let url = if base_url.ends_with("/v1") {
        format!("{}/chat-messages", base_url)
    } else {
        format!("{}/v1/chat-messages", base_url)
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "query": args.query,
            "conversation_id": args.conversation_id.unwrap_or_default(),
            "inputs": {},
            "response_mode": "blocking"
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    // Dify chat-messages 同步模式返回顶层 answer 字段
    let content = text["answer"]
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
