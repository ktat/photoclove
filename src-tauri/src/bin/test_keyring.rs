use chrono::{DateTime, Utc};
use keyring::Entry;

fn main() {
    println!("🔍 Testing PhotoClove Keyring Storage...\n");

    // Check if tokens exist
    match Entry::new("photoclove", "google_oauth_tokens") {
        Ok(entry) => {
            match entry.get_password() {
                Ok(data) => {
                    println!("✅ Tokens found in keyring!");
                    println!("📊 Data length: {} bytes", data.len());

                    // Try to parse as JSON
                    match serde_json::from_str::<serde_json::Value>(&data) {
                        Ok(json) => {
                            println!("✅ Valid JSON structure");

                            // Check access token
                            if let Some(access_token) =
                                json.get("access_token").and_then(|v| v.as_str())
                            {
                                println!(
                                    "✅ Has access_token field ({} chars)",
                                    access_token.len()
                                );
                                let preview = if access_token.len() > 10 {
                                    format!(
                                        "{}...{}",
                                        &access_token[..6],
                                        &access_token[access_token.len() - 4..]
                                    )
                                } else {
                                    "too short".to_string()
                                };
                                println!("   Preview: {}", preview);
                            } else {
                                println!("❌ Missing or invalid access_token");
                            }

                            // Check refresh token
                            if let Some(refresh_token) =
                                json.get("refresh_token").and_then(|v| v.as_str())
                            {
                                println!(
                                    "✅ Has refresh_token field ({} chars)",
                                    refresh_token.len()
                                );
                                let preview = if refresh_token.len() > 10 {
                                    format!(
                                        "{}...{}",
                                        &refresh_token[..6],
                                        &refresh_token[refresh_token.len() - 4..]
                                    )
                                } else {
                                    "too short".to_string()
                                };
                                println!("   Preview: {}", preview);
                            } else {
                                println!("❌ Missing or invalid refresh_token");
                            }

                            // Check expiration
                            if let Some(expires_at) =
                                json.get("expires_at").and_then(|v| v.as_str())
                            {
                                println!("✅ Has expires_at field");
                                match DateTime::parse_from_rfc3339(expires_at) {
                                    Ok(exp_time) => {
                                        let exp_utc: DateTime<Utc> = exp_time.with_timezone(&Utc);
                                        let now = Utc::now();
                                        let duration = exp_utc.signed_duration_since(now);

                                        println!("   Expires at: {}", expires_at);
                                        if duration.num_seconds() > 0 {
                                            println!(
                                                "   ⏱️  Valid for: {} minutes",
                                                duration.num_minutes()
                                            );
                                        } else {
                                            println!(
                                                "   ⚠️  EXPIRED {} minutes ago",
                                                -duration.num_minutes()
                                            );
                                        }
                                    }
                                    Err(e) => println!("   ❌ Invalid date format: {}", e),
                                }
                            } else {
                                println!("❌ Missing expires_at field");
                            }
                        }
                        Err(e) => {
                            println!("❌ Invalid JSON: {}", e);
                            println!(
                                "Raw data preview: {}",
                                &data.chars().take(50).collect::<String>()
                            );
                        }
                    }
                }
                Err(keyring::Error::NoEntry) => {
                    println!("ℹ️  No tokens found in keyring");
                    println!("   This is normal if you haven't logged in yet");
                }
                Err(e) => {
                    println!("❌ Error accessing keyring: {:?}", e);
                    println!("   Make sure your keyring service is running");
                }
            }
        }
        Err(e) => {
            println!("❌ Failed to create keyring entry: {:?}", e);
            println!("   This might indicate a keyring service issue");
        }
    }

    println!("\n🔒 Keyring Info:");
    println!("   Service: photoclove");
    println!("   Username: google_oauth_tokens");

    #[cfg(target_os = "linux")]
    println!("\n💡 Linux Tip: You can also check with:");
    println!("   secret-tool lookup service photoclove username google_oauth_tokens");

    #[cfg(target_os = "macos")]
    println!("\n💡 macOS Tip: You can also check in:");
    println!("   Keychain Access app → search for 'photoclove'");

    #[cfg(target_os = "windows")]
    println!("\n💡 Windows Tip: You can also check in:");
    println!("   Control Panel → Credential Manager → Windows Credentials");
}
