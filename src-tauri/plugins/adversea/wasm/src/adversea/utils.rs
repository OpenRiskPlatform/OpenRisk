use serde::{de::DeserializeOwned, Serialize};

use crate::adversea::{
    models::Error, ADVERSEA_TOKEN, URL
};

fn get_adversea_token() -> &'static str {
    &ADVERSEA_TOKEN
}

pub(crate) async fn adversea_request<T>(
    endpoint: &'static str,
    target: String
)-> Result<T, Error>
where
    T: Serialize + DeserializeOwned
{
    let url = format!("{}/{}", URL, endpoint);

    let client = reqwest::Client::new();

    let request = client
        .get(url)
        .header("Accept", "Application/Json")
        .header("X-Adversea-Api-Key", get_adversea_token())
        .query(&[
            ("targetName", target.clone()),
            ("forceRecreate", "false".to_string()),
        ]);

    
    let response = match request.send().await {
        Ok(resp) => resp,
        Err(_) => {
            return Err(Error::internal("Request failed"))
        },
    };

    let status = response.status();

    if !status.is_success() {
        match response.text().await {
            Ok(message) => {
                return Err(Error::external(format!("{}: {}", status, message)))
            },
            Err(err) => {
                return Err(Error::internal(
                    format!("Failed to parse error message body: {:?}", err)
                ));
            },
        }
    }

    let body: T = match response.json().await {
        Ok(body) => body,
        Err(err) => {
            return Err(Error::internal(
                format!("Failed to parse json body: {:?}", err)
            ));
        }
    };

    tracing::info!("OK: {}?targetName={}", endpoint, target);

    Ok(body)
}