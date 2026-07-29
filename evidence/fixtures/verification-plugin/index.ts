const text = (value: string) => ({ $type: "string", value });
const bool = (value: boolean) => ({ $type: "boolean", value });

export async function pepRca() {
  return [
    {
      $modelVersion: "0.0.3",
      $entity: "entity.person",
      $id: "verification-svetlana-ficova",
      $sources: [
        {
          name: "OpenRisk deterministic verification fixture",
          source: "https://example.invalid/verification",
        },
      ],
      $props: {
        name: [text("Svetlana Ficová")],
        aliases: [text("Svetlana Svobodová")],
        birthDate: [{ $type: "date-iso8601", value: "1964-09-06" }],
        nationalities: [text("Slovakia")],
        pepStatus: [bool(false)],
        isPepRca: [bool(true)],
        sanctioned: [bool(false)],
        relativeCloseAssociates: [
          {
            $type: "relative-close-associate",
            value: {
              name: "Robert Fico",
              relation: "spouse",
            },
          },
        ],
      },
    },
  ];
}

export async function emptyResult() {
  return [];
}
