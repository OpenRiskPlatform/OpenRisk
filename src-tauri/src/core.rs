struct Scan {}

struct Project {
    name: String,
    description: String,
    audit: String,
    scans: Vec<Scan>,
}
