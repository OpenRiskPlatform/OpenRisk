export default async function run(inputs: { name?: string; country?: string }) {
    const fullName = (inputs?.name || "John Doe").trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const first = parts[0] || "John";
    const last = parts.slice(1).join(" ") || "Doe";
    const country = inputs?.country || "cz";

    return [
        {
            $entity: "entity.person",
            $id: `persondemo:${first.toLowerCase()}-${last.toLowerCase()}`,
            $sources: [
                {
                    name: "Person Demo",
                    source: "https://example.org/persondemo",
                },
            ],
            $props: {
                name: [{ $type: "string", value: first }],
                surname: [{ $type: "string", value: last }],
                position: [{ $type: "string", value: "Director" }],
                country: [{ $type: "string", value: country }],
                age: [{ $type: "number", value: 41 }],
                birthDate: [{ $type: "date-partial-iso8601", value: "1984-05" }],
                nationality: [{ $type: "string", value: "Czech" }],
                personId: [{ $type: "string", value: "PID-001" }],
                documentId: [{ $type: "string", value: "DOC-ABC-1" }],
                residenceAddress: [{ $type: "address", value: "Prague, CZ" }],
            },
            $extra: [
                {
                    $type: "key-value",
                    value: {
                        key: { $type: "string", value: "note" },
                        value: { $type: "string", value: "demo payload" },
                    },
                },
            ],
        },
    ];
}
