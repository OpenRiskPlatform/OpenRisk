use crate::adversea::{
    models::{
        Error, 
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


#[tauri::command]
pub async fn screening_rpo(name: String) -> Result<Vec<ScreeningRPO>, Error> {
    adversea_request("/screening/rpo", name).await?
}

 /*
Example request: 

curl -X 'GET' \
  'https://adversea.com/api/gateway-service/screening/socialMedia?targetName=Filip%20%C4%8Euri%C5%A1&forceRecreate=false' \
  -H 'accept: application/json' \
  -H 'X-Adversea-Api-Key: ABC...
*/
#[tauri::command]
pub async fn social_media_scan(name: String) -> Result<Vec<MediaScan>, Error> {
    adversea_request("/screening/socialMedia", name).await?
}