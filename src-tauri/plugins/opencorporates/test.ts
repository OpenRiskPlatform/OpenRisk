import searchCompanies, { searchOfficers } from "./index.ts";

function requireToken(): string {
  const token = Deno.env.get("OPENCORPORATES_TOKEN")?.trim();
  if (!token) {
    throw new Error("OPENCORPORATES_TOKEN is required in the environment");
  }
  return token;
}

async function main(): Promise<void> {
  const token = requireToken();
  const companyQuery = Deno.args[0] ?? "barclays bank";
  const officerQuery = Deno.args[1] ?? "Christopher Taggart";

  const [companies, officers] = await Promise.all([
    searchCompanies({
      search_input: companyQuery,
      token,
      limit: 2,
    }),
    searchOfficers({
      search_input: officerQuery,
      token,
      limit: 2,
    }),
  ]);

  if (companies.length === 0) {
    throw new Error(`No companies returned for query: ${companyQuery}`);
  }

  if (officers.length === 0) {
    throw new Error(`No officers returned for query: ${officerQuery}`);
  }

  console.log(
    JSON.stringify(
      {
        companyQuery,
        officerQuery,
        companyCount: companies.length,
        officerCount: officers.length,
        firstCompanyId: companies[0]?.$id ?? null,
        firstOfficerId: officers[0]?.$id ?? null,
        firstCompanyName: companies[0]?.$props?.name?.[0]?.value ?? null,
        firstOfficerName: officers[0]?.$props?.name?.[0]?.value ?? null,
      },
      null,
      2
    )
  );
}

if (import.meta.main) {
  await main();
}
