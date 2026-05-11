pub const REGISTRY_JURISDICTION_CODE_TYPE_NAME: &str = "registry-jurisdiction-code";

pub const REGISTRY_JURISDICTION_CODES: &[&str] = &[
    "ae_az", "ae_du", "al", "au", "aw", "bb", "bd", "be", "bg", "bh", "bl", "bm", "bo", "br", "bs",
    "by", "bz", "ca", "ca_bc", "ca_nb", "ca_nl", "ca_ns", "ca_nu", "ca_on", "ca_pe", "ca_qc", "ch",
    "cw", "cy", "cz", "de", "dk", "do", "es", "fi", "fr", "gb", "gf", "gg", "gi", "gl", "gp", "gr",
    "hk", "hr", "ie", "il", "im", "in", "ir", "is", "je", "jm", "jp", "kh", "li", "lu", "lv", "md",
    "me", "mf", "mm", "mq", "mt", "mu", "mx", "my", "nc", "nl", "no", "nz", "pa", "pf", "pk", "pl",
    "pm", "pr", "re", "ro", "rw", "se", "sg", "si", "sk", "th", "tj", "tn", "to", "tz", "ua", "ug",
    "us_ak", "us_al", "us_ar", "us_az", "us_ca", "us_co", "us_ct", "us_dc", "us_de", "us_fl",
    "us_ga", "us_hi", "us_ia", "us_id", "us_il", "us_in", "us_ks", "us_ky", "us_la", "us_ma",
    "us_md", "us_me", "us_mi", "us_mn", "us_mo", "us_ms", "us_mt", "us_nc", "us_nd", "us_ne",
    "us_nh", "us_nj", "us_nm", "us_nv", "us_ny", "us_oh", "us_ok", "us_or", "us_pa", "us_ri",
    "us_sc", "us_sd", "us_tn", "us_tx", "us_ut", "us_va", "us_vt", "us_wa", "us_wi", "us_wv",
    "us_wy", "vn", "vu", "wf", "yt", "za",
];

pub fn values_for_type_name(type_name: &str) -> Option<Vec<String>> {
    match type_name {
        REGISTRY_JURISDICTION_CODE_TYPE_NAME => Some(
            REGISTRY_JURISDICTION_CODES
                .iter()
                .map(|value| (*value).to_string())
                .collect(),
        ),
        _ => None,
    }
}

pub fn is_registry_jurisdiction_code(value: &str) -> bool {
    REGISTRY_JURISDICTION_CODES.contains(&value)
}
