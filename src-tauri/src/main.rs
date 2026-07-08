use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct AiCallArgs {
    model: Option<String>,
    messages: Vec<Message>,
}

#[derive(Deserialize, Serialize, Clone)]
struct Message {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct AiResponse {
    success: bool,
    content: String,
}

#[tauri::command]
async fn call_ai(args: AiCallArgs) -> Result<AiResponse, String> {
    let api_key = "sk-ws-H.RXIHRIL.iLUo.MEYCIQDEkt0bC7SOrIV3vHGvggPDipGl1iiv-VUWSDG-tBGyXgIhAJ_kmA7btLzoJyl6pSwFH96ZKN7uHGJTFrVisLZCwcma";

    let client = reqwest::Client::new();
    let model = args.model.unwrap_or_else(|| "qwen-plus".into());

    let resp = client
        .post("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("X-DashScope-SSE", "disable")
        .json(&serde_json::json!({
            "model": model,
            "input": { "messages": args.messages },
            "parameters": { "incremental_output": false }
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let content = text["output"]["text"]
        .as_str()
        .or_else(|| text["output"]["choices"][0]["message"]["content"].as_str())
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
