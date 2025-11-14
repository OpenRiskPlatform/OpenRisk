use wasm_bindgen::prelude::*;

use crate::adversea::{
    models::{
        JsError, 
        MediaScan, 
        ScreeningRPO
    }, 
    utils::adversea_request,
};

/*
 * curl -X 'GET' \
  'https://adversea.com/api/gateway-service/screening/rpo?targetName=Filip%20Duris&forceRecreate=false' \
  -H 'accept: application/json' \
  -H 'X-Adversea-Api-Key: ABC'
 */


#[wasm_bindgen]
pub async fn screening_rpo(name: String) -> Result<Vec<ScreeningRPO>, JsError> {
    match adversea_request("/screening/rpo", name).await {
        Ok(out) => Ok(out),
        Err(error) => Err(error.into())
    }
}

 /*
Example request: 

curl -X 'GET' \
  'https://adversea.com/api/gateway-service/screening/socialMedia?targetName=Filip%20%C4%8Euri%C5%A1&forceRecreate=false' \
  -H 'accept: application/json' \
  -H 'X-Adversea-Api-Key: ABC...
*/
// #[wasm_bindgen]
// pub async fn social_media_scan(name: String) -> Result<Vec<MediaScan>, JsError> {
//     adversea_request("/screening/socialMedia", name).await?
// }